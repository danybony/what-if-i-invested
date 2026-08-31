#!/usr/bin/env node
/**
 * Refresh the static market data the site is built on.
 *
 *   TWELVEDATA_API_KEY=... node scripts/fetch-market-data.mjs [options]
 *
 *   --only VWCE.DE,AAPL   refresh just these
 *   --interval 8000       minimum ms between API calls (free tier: 8/min)
 *   --dividend-age 7      refetch dividends older than N days (0 = always)
 *
 * Reads the curated universe in data-source/symbol-universe.json, fetches each
 * symbol's monthly history plus the ECB deposit-rate series, and writes them
 * into public/data/ as plain JSON that GitHub Pages serves directly.
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
import {
  buildHistory,
  fetchAlphaVantageHistory,
  fetchDividends,
  fetchEcbRates,
  fetchTimeSeries,
  fileNameFor,
} from './market-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UNIVERSE_FILE = join(ROOT, 'data-source', 'symbol-universe.json')
const DATA_DIR = join(ROOT, 'public', 'data')
const PRICES_DIR = join(DATA_DIR, 'prices')

const FAILURE_BUDGET = 0.25

function parseArgs(argv) {
  const args = { only: null, minIntervalMs: 8000, dividendMaxAgeDays: 7, alphaBudget: 20 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') {
      args.only = new Set(argv[++i].split(',').map((s) => s.trim().toUpperCase()))
    } else if (argv[i] === '--interval') args.minIntervalMs = Number(argv[++i])
    else if (argv[i] === '--dividend-age') args.dividendMaxAgeDays = Number(argv[++i])
    else if (argv[i] === '--alpha-budget') args.alphaBudget = Number(argv[++i])
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
  const apiKey = process.env.TWELVEDATA_API_KEY
  const alphaKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) throw new Error('TWELVEDATA_API_KEY is not set')
  if (!alphaKey) throw new Error('ALPHAVANTAGE_API_KEY is not set')

  const args = parseArgs(process.argv.slice(2))
  const universe = JSON.parse(await readFile(UNIVERSE_FILE, 'utf8')).symbols
  const wanted = args.only
    ? universe.filter((s) => args.only.has(s.symbol.toUpperCase()))
    : universe

  await mkdir(PRICES_DIR, { recursive: true })
  const previousIndex = await readJson(join(DATA_DIR, 'symbols.json'), { symbols: [] })
  const existing = new Map(previousIndex.symbols.map((entry) => [entry.symbol, entry]))

  /**
   * Twelve Data's quota comfortably covers its whole US slice every day.
   * Alpha Vantage's ~25 calls a day does not cover its 107, so it takes the
   * stalest first — a rotation that needs no cursor file and heals itself, since
   * anything that fails simply stays stale and comes back to the front.
   */
  const mapped = wanted.filter((entry) =>
    entry.provider === 'alphavantage' ? Boolean(entry.av) : Boolean(entry.td)
  )
  const unmapped = wanted.filter((entry) => !mapped.includes(entry))

  const staleness = new Map()
  for (const entry of mapped) {
    const published = await readJson(join(PRICES_DIR, fileNameFor(entry.symbol)), null)
    staleness.set(entry.symbol, published?.fetchedAt ? Date.parse(published.fetchedAt) : 0)
  }

  const twelve = mapped.filter((entry) => entry.provider !== 'alphavantage')
  const alpha = mapped
    .filter((entry) => entry.provider === 'alphavantage')
    .sort((a, b) => staleness.get(a.symbol) - staleness.get(b.symbol))
    .slice(0, args.alphaBudget)

  const queue = [...twelve, ...alpha]

  if (unmapped.length > 0) {
    console.log(
      `${unmapped.length} symbol(s) are not mapped to a provider yet and are skipped ` +
        `(run scripts/map-symbols.mjs / map-alphavantage.mjs).\n`
    )
  }
  console.log(
    `Twelve Data: ${twelve.length} symbol(s). ` +
      `Alpha Vantage: ${alpha.length} of ` +
      `${mapped.filter((e) => e.provider === 'alphavantage').length} (stalest first).\n`
  )

  const options = { apiKey, minIntervalMs: args.minIntervalMs }
  const dividendCutoff = Date.now() - args.dividendMaxAgeDays * 24 * 60 * 60 * 1000

  const entries = []
  const failures = []

  for (const [index, entry] of queue.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${queue.length}] ${entry.symbol}`
    const file = fileNameFor(entry.symbol)
    const filePath = join(PRICES_DIR, file)

    try {
      const published = await readJson(filePath, null)
      let history
      let extra = {}

      if (entry.provider === 'alphavantage') {
        // Adjusted closes come straight from the provider here.
        history = await fetchAlphaVantageHistory(entry, {
          apiKey: alphaKey,
          minIntervalMs: 1000,
        })
      } else {
        // Twelve Data gives split-adjusted closes only, so the adjusted series
        // is rebuilt from the dividend record. Dividends move quarterly at
        // best, so a recent one is reused rather than spending quota again.
        const cachedFresh =
          published?.dividends &&
          published.dividendsFetchedAt &&
          Date.parse(published.dividendsFetchedAt) > dividendCutoff

        const series = await fetchTimeSeries(entry, options)
        const dividends = cachedFresh ? published.dividends : await fetchDividends(entry, options)
        history = buildHistory(entry, series, dividends)
        extra = {
          dividends,
          dividendsFetchedAt: cachedFresh ? published.dividendsFetchedAt : new Date().toISOString(),
        }
      }

      const fetchedAt = new Date().toISOString()
      await writeFile(filePath, JSON.stringify({ ...history, ...extra, fetchedAt }), 'utf8')

      entries.push({
        symbol: history.symbol,
        name: history.name,
        type: history.type,
        currency: history.currency,
        category: entry.category,
        file,
        firstMonth: history.points[0].month,
        lastMonth: history.points[history.points.length - 1].month,
      })

      console.log(
        `${label} ok — ${history.points.length} months, ${history.currency}, ` +
          `${history.points[0].month} to ${history.points.at(-1).month}` +
          `, ${history.dividendCount} dividend month(s) [${entry.provider ?? 'twelvedata'}]`
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
