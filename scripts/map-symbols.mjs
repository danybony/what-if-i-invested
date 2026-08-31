#!/usr/bin/env node
/**
 * Resolve every Yahoo-style ticker in the universe to its Twelve Data identity.
 *
 *   node scripts/map-symbols.mjs [--write]
 *
 * Yahoo identifies a listing with a suffix (VWCE.DE); Twelve Data uses a bare
 * symbol plus a MIC code (VWCE + XETR). The same fund is listed on several
 * exchanges in different currencies, so picking the wrong row would silently
 * change a backtest's currency — hence matching on MIC first and currency
 * second, and reporting anything ambiguous rather than guessing.
 *
 * symbol_search needs no API key, so this runs without one.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep } from './market-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UNIVERSE_FILE = join(ROOT, 'data-source', 'symbol-universe.json')

/** Yahoo exchange suffix → the MIC code Twelve Data uses for that venue. */
const SUFFIX_TO_MIC = {
  DE: ['XETR', 'XFRA'],
  MI: ['XMIL', 'MTAA'],
  AS: ['XAMS'],
  PA: ['XPAR'],
  L: ['XLON'],
  SW: ['XSWX', 'XVTX'],
  MC: ['XMAD'],
  BR: ['XBRU'],
  HE: ['XHEL'],
  ST: ['XSTO'],
  CO: ['XCSE'],
  OL: ['XOSL'],
  VI: ['XWBO'],
  LS: ['XLIS'],
}

/** No suffix means a US listing. */
const US_MICS = ['XNGS', 'XNMS', 'XNCM', 'XNAS', 'XNYS', 'ARCX', 'BATS', 'XASE']

function splitTicker(symbol) {
  const parts = symbol.split('.')
  if (parts.length === 1) return { base: parts[0], mics: US_MICS, suffix: null }
  const suffix = parts.pop()
  return { base: parts.join('.'), mics: SUFFIX_TO_MIC[suffix] ?? [], suffix }
}

/**
 * Yahoo separates a share class with a hyphen (BRK-B, ERIC-B.ST); Twelve Data
 * uses a dot (BRK.B, ERIC.B). Accept either spelling as the same ticker.
 */
function tickerVariants(base) {
  const variants = new Set([base, base.replace(/-/g, '.')])
  return [...variants].map((variant) => variant.toUpperCase())
}

async function search(term) {
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(term)}&outputsize=30`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = await response.json()
  if (!Array.isArray(body?.data)) throw new Error(body?.message ?? 'unexpected response')
  return body.data
}

/**
 * Prefer a row on the expected venue; fall back to any row in the expected
 * currency. Yahoo's base ticker must match exactly either way — a fuzzy name
 * match is how you end up backtesting the wrong fund.
 */
function pickMatch(entry, rows) {
  const { base, mics } = splitTicker(entry.symbol)
  const accepted = tickerVariants(base)
  const exact = rows.filter((row) => accepted.includes(row.symbol?.toUpperCase()))
  if (exact.length === 0) return { match: null, reason: 'no exact ticker match' }

  const onVenue = exact.filter((row) => mics.includes(row.mic_code))
  if (onVenue.length > 0) {
    const sameCurrency = onVenue.filter((row) => row.currency === entry.currency)
    return { match: (sameCurrency[0] ?? onVenue[0]), reason: null }
  }

  const sameCurrency = exact.filter((row) => row.currency === entry.currency)
  if (sameCurrency.length > 0) {
    return { match: sameCurrency[0], reason: `no ${mics.join('/')} listing; used ${sameCurrency[0].mic_code}` }
  }

  return { match: null, reason: `found on ${exact.map((r) => r.mic_code).join(',')} but none in ${entry.currency}` }
}

async function main() {
  const write = process.argv.includes('--write')
  const universe = JSON.parse(await readFile(UNIVERSE_FILE, 'utf8'))

  const resolved = []
  const problems = []

  for (const [index, entry] of universe.symbols.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${universe.symbols.length}] ${entry.symbol}`
    try {
      const rows = await search(splitTicker(entry.symbol).base)
      const { match, reason } = pickMatch(entry, rows)

      if (!match) {
        problems.push({ symbol: entry.symbol, reason })
        console.log(`${label} UNRESOLVED — ${reason}`)
        resolved.push(entry)
      } else {
        if (reason) problems.push({ symbol: entry.symbol, reason })
        resolved.push({
          ...entry,
          name: match.instrument_name || entry.name,
          currency: match.currency || entry.currency,
          td: { symbol: match.symbol, mic: match.mic_code, exchange: match.exchange },
        })
        console.log(
          `${label} -> ${match.symbol} @ ${match.mic_code} (${match.currency})` +
            (reason ? `  [${reason}]` : '')
        )
      }
    } catch (error) {
      problems.push({ symbol: entry.symbol, reason: error.message })
      console.log(`${label} ERROR — ${error.message}`)
      resolved.push(entry)
    }
    await sleep(400)
  }

  const mapped = resolved.filter((entry) => entry.td).length
  console.log(`\nResolved ${mapped}/${universe.symbols.length}`)
  if (problems.length > 0) {
    console.log(`\n${problems.length} needing attention:`)
    for (const problem of problems) console.log(`  ${problem.symbol}: ${problem.reason}`)
  }

  if (write) {
    await writeFile(
      UNIVERSE_FILE,
      `${JSON.stringify({ ...universe, symbols: resolved }, null, 2)}\n`,
      'utf8'
    )
    console.log(`\nWrote ${UNIVERSE_FILE}`)
  } else {
    console.log('\n(dry run — pass --write to update the universe file)')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
