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
  const args = { only: null, minIntervalMs: 8000, dividendMaxAgeDays: 7 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') {
      args.only = new Set(argv[++i].split(',').map((s) => s.trim().toUpperCase()))
    } else if (argv[i] === '--interval') args.minIntervalMs = Number(argv[++i])
    else if (argv[i] === '--dividend-age') args.dividendMaxAgeDays = Number(argv[++i])
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
  if (!apiKey) throw new Error('TWELVEDATA_API_KEY is not set')

  const args = parseArgs(process.argv.slice(2))
  const universe = JSON.parse(await readFile(UNIVERSE_FILE, 'utf8')).symbols
  const wanted = args.only
    ? universe.filter((s) => args.only.has(s.symbol.toUpperCase()))
    : universe

  const unmapped = wanted.filter((entry) => !entry.td)
  if (unmapped.length > 0) {
    throw new Error(
      `${unmapped.length} symbol(s) have no Twelve Data mapping (${unmapped
        .map((e) => e.symbol)
        .join(', ')}). Run scripts/map-symbols.mjs --write.`
    )
  }

  await mkdir(PRICES_DIR, { recursive: true })
  const previousIndex = await readJson(join(DATA_DIR, 'symbols.json'), { symbols: [] })
  const existing = new Map(previousIndex.symbols.map((entry) => [entry.symbol, entry]))

  const options = { apiKey, minIntervalMs: args.minIntervalMs }
  const dividendCutoff = Date.now() - args.dividendMaxAgeDays * 24 * 60 * 60 * 1000

  console.log(
    `Refreshing ${wanted.length} of ${universe.length} symbols ` +
      `(${args.minIntervalMs}ms apart, dividends older than ${args.dividendMaxAgeDays}d)\n`
  )

  const entries = []
  const failures = []

  for (const [index, entry] of wanted.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${wanted.length}] ${entry.symbol}`
    const file = fileNameFor(entry.symbol)
    const filePath = join(PRICES_DIR, file)

    try {
      // Dividends move quarterly at best, so reuse a recent record rather than
      // spending half the daily quota re-fetching what has not changed.
      const published = await readJson(filePath, null)
      const cachedFresh =
        published?.dividends &&
        published.dividendsFetchedAt &&
        Date.parse(published.dividendsFetchedAt) > dividendCutoff

      const series = await fetchTimeSeries(entry, options)
      const dividends = cachedFresh ? published.dividends : await fetchDividends(entry, options)
      const dividendsFetchedAt = cachedFresh
        ? published.dividendsFetchedAt
        : new Date().toISOString()

      const history = buildHistory(entry, series, dividends)
      await writeFile(
        filePath,
        JSON.stringify({ ...history, dividends, dividendsFetchedAt }),
        'utf8'
      )

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
          `, ${history.dividendCount} dividend month(s)${cachedFresh ? ' (cached)' : ''}`
      )
    } catch (error) {
      failures.push({ symbol: entry.symbol, reason: error.message })
      console.log(`${label} FAILED — ${error.message}`)
      const previous = existing.get(entry.symbol.toUpperCase())
      if (previous) entries.push(previous)
    }
  }

  // A partial run (--only) must not delete the symbols it did not touch.
  if (args.only) {
    const refreshed = new Set(entries.map((e) => e.symbol))
    for (const [symbol, entry] of existing) if (!refreshed.has(symbol)) entries.push(entry)
  }
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

  const failureRate = wanted.length === 0 ? 0 : failures.length / wanted.length
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
