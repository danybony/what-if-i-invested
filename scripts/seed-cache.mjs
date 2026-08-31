#!/usr/bin/env node
/**
 * Seed the price cache from a saved Yahoo chart response.
 *
 *   node scripts/seed-cache.mjs VWCE.DE ./vwce.json
 *
 * Yahoo rate-limits an IP hard, which makes offline development and CI awkward.
 * Dropping a previously captured response straight into the cache lets the app
 * run the full Advanced-mode path with real prices and no network.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [symbol, file] = process.argv.slice(2)
if (!symbol || !file) {
  console.error('usage: node scripts/seed-cache.mjs <SYMBOL> <yahoo-chart.json>')
  process.exit(1)
}

const result = JSON.parse(readFileSync(file, 'utf8')).chart?.result?.[0]
if (!result?.timestamp) {
  console.error(`${file} is not a Yahoo chart response with timestamps.`)
  process.exit(1)
}

const closes = result.indicators?.quote?.[0]?.close ?? []
const adjcloses = result.indicators?.adjclose?.[0]?.adjclose ?? closes

// Mirrors monthKeyInTimeZone() in lib/yahoo.ts — monthly bars sit at midnight
// in the exchange's timezone, so UTC filing puts them in the wrong month.
const timeZone = result.meta?.exchangeTimezoneName ?? 'UTC'
const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' })
const monthKey = (epochSeconds) => {
  const parts = formatter.formatToParts(new Date(epochSeconds * 1000))
  return `${parts.find((p) => p.type === 'year').value}-${parts.find((p) => p.type === 'month').value}`
}

const points = []
for (let i = 0; i < result.timestamp.length; i++) {
  const close = closes[i]
  if (close === null || close === undefined) continue
  points.push({ month: monthKey(result.timestamp[i]), close, adjclose: adjcloses[i] ?? close })
}

const value = {
  symbol: symbol.toUpperCase(),
  name: result.meta?.longName ?? result.meta?.shortName ?? symbol,
  currency: result.meta?.currency ?? 'EUR',
  type: result.meta?.instrumentType ?? '',
  points,
}

// Must match historyCacheKey() and the entry shape in lib/cache.ts.
const key = `history:${symbol.toUpperCase()}`
const directory = join(tmpdir(), 'what-if-i-invested-cache')
mkdirSync(directory, { recursive: true })
const target = join(directory, `${createHash('sha1').update(key).digest('hex')}.json`)
writeFileSync(target, JSON.stringify({ value, fetchedAt: Date.now() }))

console.log(
  `seeded ${value.symbol} (${value.currency}) — ${points.length} months, ` +
    `${points[0].month} to ${points.at(-1).month}\n  ${target}`
)
