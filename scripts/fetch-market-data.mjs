#!/usr/bin/env node
/**
 * Refresh the static market data the site is built on.
 *
 *   node scripts/fetch-market-data.mjs [--only VWCE.DE,AAPL] [--delay 1500]
 *
 * Reads the curated universe in data-source/symbol-universe.json, fetches each
 * symbol's full monthly history from Yahoo plus the ECB deposit-rate series,
 * and writes them into public/data/ as plain JSON that GitHub Pages can serve.
 *
 * Yahoo rate-limits an IP hard, so requests are spaced out and retried, and a
 * symbol that fails is reported and skipped rather than failing the run — one
 * dead ticker must not cost us the other two hundred. Existing files for failed
 * symbols are left in place, so a bad run degrades to stale data, never to no
 * data.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchEcbRates, fetchYahooHistory, fileNameFor, sleep } from './market-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UNIVERSE_FILE = join(ROOT, 'data-source', 'symbol-universe.json')
const DATA_DIR = join(ROOT, 'public', 'data')
const PRICES_DIR = join(DATA_DIR, 'prices')

/** Abort if more than this share of the universe fails — that is a real outage. */
const FAILURE_BUDGET = 0.25

function parseArgs(argv) {
  const args = { only: null, delayMs: 1500 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') args.only = new Set(argv[++i].split(',').map((s) => s.trim().toUpperCase()))
    else if (argv[i] === '--delay') args.delayMs = Number(argv[++i])
  }
  return args
}

async function readExistingSymbols() {
  try {
    const parsed = JSON.parse(await readFile(join(DATA_DIR, 'symbols.json'), 'utf8'))
    return new Map(parsed.symbols.map((entry) => [entry.symbol, entry]))
  } catch {
    return new Map()
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const universe = JSON.parse(await readFile(UNIVERSE_FILE, 'utf8')).symbols
  const wanted = args.only ? universe.filter((s) => args.only.has(s.symbol.toUpperCase())) : universe

  await mkdir(PRICES_DIR, { recursive: true })
  const existing = await readExistingSymbols()

  console.log(`Refreshing ${wanted.length} of ${universe.length} symbols (${args.delayMs}ms apart)\n`)

  const entries = []
  const failures = []

  for (const [index, entry] of wanted.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${wanted.length}] ${entry.symbol}`
    try {
      const history = await fetchYahooHistory(entry.symbol)
      const file = fileNameFor(entry.symbol)
      await writeFile(join(PRICES_DIR, file), JSON.stringify(history), 'utf8')

      entries.push({
        symbol: history.symbol,
        // Yahoo is the authority on these; the universe file only holds hints.
        name: history.name || entry.name,
        type: history.type || entry.type,
        currency: history.currency || entry.currency,
        category: entry.category,
        file,
        firstMonth: history.points[0].month,
        lastMonth: history.points[history.points.length - 1].month,
      })
      console.log(
        `${label} ok — ${history.points.length} months, ${history.currency}, ` +
          `${history.points[0].month} to ${history.points.at(-1).month}`
      )
    } catch (error) {
      failures.push({ symbol: entry.symbol, reason: error.message })
      console.log(`${label} FAILED — ${error.message}`)
      // Keep whatever we published last time rather than dropping the symbol.
      const previous = existing.get(entry.symbol.toUpperCase())
      if (previous) entries.push(previous)
    }
    if (index < wanted.length - 1) await sleep(args.delayMs)
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
    try {
      rates = JSON.parse(await readFile(join(DATA_DIR, 'rates.json'), 'utf8'))
      console.log('reusing the previously published rates')
    } catch {
      throw new Error('ECB rates unavailable and nothing published to fall back on')
    }
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
