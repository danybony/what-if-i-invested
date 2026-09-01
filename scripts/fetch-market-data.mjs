#!/usr/bin/env node
/**
 * Refresh the static market data the site is built on.
 *
 *   ALPHAVANTAGE_API_KEY=... node scripts/fetch-market-data.mjs [options]
 *
 *   --only VWCE.DE,AAPL   refresh just these
 *   --interval 1000       minimum ms between API calls
 *   --budget 20           how many symbols to refresh this run
 *
 * Reads the curated universe in data-source/symbol-universe.json, fetches each
 * symbol's monthly history plus the ECB deposit-rate series, and writes them
 * into public/data/ as plain JSON that GitHub Pages serves directly.
 *
 * Alpha Vantage allows roughly 25 calls a day, far fewer than the universe, so
 * each run takes the symbols that need it most: those with no adjusted closes
 * yet, then the stalest. That rotation needs no cursor and heals itself — a
 * symbol that fails simply stays at the front of the queue.
 *
 * A symbol that fails is reported and skipped rather than failing the run — one
 * dead ticker must not cost us the other two hundred — and it keeps whatever was
 * last published, so a bad run degrades to stale data, never to no data. If more
 * than a quarter of the universe fails, that is an upstream outage rather than
 * bad tickers, and nothing is published at all.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchAlphaVantageHistory, fetchEcbRates, fileNameFor } from './market-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UNIVERSE_FILE = join(ROOT, 'data-source', 'symbol-universe.json')
const DATA_DIR = join(ROOT, 'public', 'data')
const PRICES_DIR = join(DATA_DIR, 'prices')

const FAILURE_BUDGET = 0.25

function parseArgs(argv) {
  const args = { only: null, minIntervalMs: 1000, budget: 20 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') {
      args.only = new Set(argv[++i].split(',').map((s) => s.trim().toUpperCase()))
    } else if (argv[i] === '--interval') args.minIntervalMs = Number(argv[++i])
    else if (argv[i] === '--budget') args.budget = Number(argv[++i])
  }
  return args
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

async function main() {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) throw new Error('ALPHAVANTAGE_API_KEY is not set')

  const args = parseArgs(process.argv.slice(2))
  const universe = JSON.parse(await readFile(UNIVERSE_FILE, 'utf8')).symbols
  const wanted = args.only
    ? universe.filter((s) => args.only.has(s.symbol.toUpperCase()))
    : universe

  await mkdir(PRICES_DIR, { recursive: true })
  const previousIndex = await readJson(join(DATA_DIR, 'symbols.json'), { symbols: [] })
  const existing = new Map(previousIndex.symbols.map((entry) => [entry.symbol, entry]))

  const mapped = wanted.filter((entry) => entry.av)
  const unmapped = wanted.filter((entry) => !entry.av)

  /**
   * Order by need, not by name. A symbol still carrying price-return-only data
   * from the old provider is worth more than one that is merely a few days
   * stale, so it goes first; after that, oldest fetch wins. A never-fetched
   * symbol sorts ahead of everything.
   */
  const published = new Map()
  for (const entry of mapped) {
    published.set(entry.symbol, await readJson(join(PRICES_DIR, fileNameFor(entry.symbol)), null))
  }
  const rank = (entry) => {
    const file = published.get(entry.symbol)
    if (!file) return { tier: 0, at: 0 }
    return { tier: file.adjustedAvailable === false ? 1 : 2, at: Date.parse(file.fetchedAt ?? 0) || 0 }
  }

  const queue = mapped
    .sort((a, b) => {
      const left = rank(a)
      const right = rank(b)
      return left.tier - right.tier || left.at - right.at
    })
    .slice(0, args.budget)

  if (unmapped.length > 0) {
    console.log(
      `${unmapped.length} symbol(s) not mapped yet and skipped ` +
        `(run scripts/map-alphavantage.mjs).\n`
    )
  }
  console.log(
    `Refreshing ${queue.length} of ${mapped.length} mapped symbol(s), neediest first.\n`
  )

  const entries = []
  const failures = []

  for (const [index, entry] of queue.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${queue.length}] ${entry.symbol}`
    const file = fileNameFor(entry.symbol)
    const filePath = join(PRICES_DIR, file)

    try {
      const history = await fetchAlphaVantageHistory(entry, {
        apiKey,
        minIntervalMs: args.minIntervalMs,
      })

      const fetchedAt = new Date().toISOString()
      await writeFile(
        filePath,
        JSON.stringify({ ...history, adjustedAvailable: true, fetchedAt }),
        'utf8'
      )

      entries.push({
        symbol: history.symbol,
        name: history.name,
        type: history.type,
        currency: history.currency,
        category: entry.category,
        file,
        adjustedAvailable: true,
        firstMonth: history.points[0].month,
        lastMonth: history.points[history.points.length - 1].month,
      })

      console.log(
        `${label} ok — ${history.points.length} months, ${history.currency}, ` +
          `${history.points[0].month} to ${history.points.at(-1).month}` +
          `, ${history.dividendCount} dividend month(s)`
      )
    } catch (error) {
      failures.push({ symbol: entry.symbol, reason: error.message })
      console.log(`${label} FAILED — ${error.message}`)
      const previous = existing.get(entry.symbol.toUpperCase())
      if (previous) entries.push(previous)
    }
  }

  // Anything not in this run's queue — an unmapped symbol, or one waiting its
  // turn in the Alpha Vantage rotation — keeps its published entry, so the
  // search index never loses a symbol just because it was not refreshed today.
  const refreshed = new Set(entries.map((e) => e.symbol))
  for (const [symbol, entry] of existing) if (!refreshed.has(symbol)) entries.push(entry)
  entries.sort((a, b) => a.symbol.localeCompare(b.symbol))

  console.log('\nFetching ECB deposit rates…')
  let rates
  try {
    rates = await fetchEcbRates()
    console.log(
      `ok — ${Object.keys(rates.monthlyRates).length} months, latest ` +
        `${rates.latest.month} = ${(rates.latest.rate * 100).toFixed(2)}%`
    )
  } catch (error) {
    console.log(`FAILED — ${error.message}`)
    rates = await readJson(join(DATA_DIR, 'rates.json'), null)
    if (!rates) throw new Error('ECB rates unavailable and nothing published to fall back on')
    console.log('reusing the previously published rates')
  }

  const generatedAt = new Date().toISOString()
  await writeFile(
    join(DATA_DIR, 'symbols.json'),
    `${JSON.stringify({ generatedAt, symbols: entries }, null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    join(DATA_DIR, 'rates.json'),
    `${JSON.stringify({ generatedAt, ...rates }, null, 2)}\n`,
    'utf8'
  )

  const priceFiles = await readdir(PRICES_DIR)
  console.log(
    `\nWrote ${entries.length} symbols (${priceFiles.length} price files) and ` +
      `${Object.keys(rates.monthlyRates).length} months of ECB rates to public/data/`
  )

  if (failures.length > 0) {
    console.log(`\n${failures.length} symbol(s) failed:`)
    for (const failure of failures) console.log(`  ${failure.symbol}: ${failure.reason}`)
  }

  const failureRate = queue.length === 0 ? 0 : failures.length / queue.length
  if (failureRate > FAILURE_BUDGET) {
    throw new Error(
      `${(failureRate * 100).toFixed(0)}% of symbols failed, over the ${FAILURE_BUDGET * 100}% budget — ` +
        'treating this as an upstream outage rather than publishing it'
    )
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  process.exit(1)
})
