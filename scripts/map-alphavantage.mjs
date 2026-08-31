#!/usr/bin/env node
/**
 * Resolve the non-US half of the universe to Alpha Vantage symbols.
 *
 *   ALPHAVANTAGE_API_KEY=... node scripts/map-alphavantage.mjs [--limit 20] [--write]
 *
 * Alpha Vantage uses its own venue suffixes (VWCE.DEX, SHEL.LON) — a third
 * naming scheme after Yahoo's and Twelve Data's. It also does not carry Borsa
 * Italiana at all, so Milan-listed entries are matched to their XETRA, Frankfurt
 * or Amsterdam listing instead; those are the same instruments in the same
 * currency, quoted on a different venue.
 *
 * The free tier allows only ~25 calls a day, far fewer than the 107 symbols to
 * map, so this is **resumable**: it skips anything already mapped and stops at
 * `--limit`. Run it across a few days, or let the workflow do it.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep } from './market-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const UNIVERSE_FILE = join(ROOT, 'data-source', 'symbol-universe.json')

/**
 * Where we would prefer each Yahoo venue to resolve, in order. Milan has no
 * Alpha Vantage equivalent, so it falls back to the EUR venues that do.
 */
const VENUE_PREFERENCE = {
  DE: ['DEX', 'FRK'],
  MI: ['DEX', 'FRK', 'AMS'],
  AS: ['AMS', 'DEX', 'FRK'],
  PA: ['PAR', 'DEX', 'FRK'],
  L: ['LON'],
  SW: ['DEX', 'FRK', 'LON'],
  MC: ['MCE', 'DEX', 'FRK'],
  BR: ['BRU', 'AMS', 'DEX'],
  HE: ['HEL', 'DEX', 'FRK'],
  ST: ['STO', 'DEX', 'FRK'],
  CO: ['CPH', 'DEX', 'FRK'],
  OL: ['OSL', 'DEX', 'FRK'],
}

/** Currencies that are the same money as the target, just a different unit. */
const EQUIVALENT = { GBP: ['GBP', 'GBX', 'GBp'], GBX: ['GBP', 'GBX', 'GBp'] }

function currencyMatches(want, got) {
  return (EQUIVALENT[want] ?? [want]).includes(got)
}

function suffixOf(symbol) {
  const parts = symbol.split('.')
  return parts.length > 1 ? parts.pop() : null
}

async function search(keywords, apiKey) {
  const url =
    'https://www.alphavantage.co/query?function=SYMBOL_SEARCH' +
    `&keywords=${encodeURIComponent(keywords)}&apikey=${apiKey}`
  const response = await fetch(url)
  const body = await response.json()

  // Alpha Vantage signals throttling with a 200 and a prose field.
  if (body.Note || body.Information) {
    throw new Error(`rate limited: ${(body.Note ?? body.Information).slice(0, 120)}`)
  }
  if (!Array.isArray(body.bestMatches)) throw new Error('unexpected response')
  return body.bestMatches.map((match) => ({
    symbol: match['1. symbol'],
    name: match['2. name'],
    region: match['4. region'],
    currency: match['8. currency'],
  }))
}

/**
 * Prefer the venue this listing actually trades on, then any venue quoting the
 * currency we expect. A same-currency match on another exchange is the same
 * instrument; a different-currency match would silently change a portfolio.
 */
function pickMatch(entry, rows) {
  const preferences = VENUE_PREFERENCE[suffixOf(entry.symbol)] ?? []
  const usable = rows.filter((row) => row.symbol.includes('.'))

  for (const venue of preferences) {
    const onVenue = usable.filter((row) => row.symbol.endsWith(`.${venue}`))
    const right = onVenue.find((row) => currencyMatches(entry.currency, row.currency))
    if (right) {
      return {
        match: right,
        note: venue === preferences[0] ? null : `substituted ${venue} for ${suffixOf(entry.symbol)}`,
      }
    }
  }

  const anyCurrency = usable.find((row) => currencyMatches(entry.currency, row.currency))
  if (anyCurrency) {
    return { match: anyCurrency, note: `unexpected venue ${anyCurrency.symbol.split('.').pop()}` }
  }
  return { match: null, note: `nothing in ${entry.currency} (saw ${usable.map((r) => r.currency).join(',') || 'nothing'})` }
}

async function main() {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY
  if (!apiKey) throw new Error('ALPHAVANTAGE_API_KEY is not set')

  const write = process.argv.includes('--write')
  const limitIndex = process.argv.indexOf('--limit')
  const limit = limitIndex === -1 ? 20 : Number(process.argv[limitIndex + 1])

  const universe = JSON.parse(await readFile(UNIVERSE_FILE, 'utf8'))
  const pending = universe.symbols.filter((s) => s.provider === 'alphavantage' && !s.av)
  const target = pending.slice(0, limit)

  console.log(
    `${pending.length} symbol(s) still unmapped; resolving up to ${limit} this run.\n`
  )

  const notes = []
  let resolved = 0

  for (const [index, entry] of target.entries()) {
    const label = `[${String(index + 1).padStart(3)}/${target.length}] ${entry.symbol}`

    try {
      // The bare ticker is what Alpha Vantage indexes on — searching the fund's
      // full name mostly returns nothing. Only fall back to the name when the
      // ticker draws a blank, which is the case for Milan-only tickers that
      // exist on Alpha Vantage under a different symbol entirely.
      const base = entry.symbol.split('.')[0]
      let rows = await search(base, apiKey)
      let { match, note } = pickMatch(entry, rows)

      if (!match) {
        const keywords = entry.name
          .replace(/\b(UCITS|ETF|S\.p\.A\.|N\.V\.|SE|AG|plc|PLC|Inc\.?|Acc|Dist)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (keywords && keywords.toUpperCase() !== base.toUpperCase()) {
          await sleep(1000)
          rows = await search(keywords, apiKey)
          ;({ match, note } = pickMatch(entry, rows))
          if (match) note = note ? `${note}; found by name` : 'found by name'
        }
      }
      if (!match) {
        notes.push({ symbol: entry.symbol, note })
        console.log(`${label} UNRESOLVED — ${note}`)
      } else {
        entry.av = { symbol: match.symbol, currency: match.currency, region: match.region }
        resolved++
        if (note) notes.push({ symbol: entry.symbol, note })
        console.log(
          `${label} -> ${match.symbol} (${match.currency}, ${match.region})` +
            (note ? `  [${note}]` : '')
        )
      }
    } catch (error) {
      console.log(`${label} STOPPED — ${error.message}`)
      notes.push({ symbol: entry.symbol, note: error.message })
      break // Quota is gone; keep what we have and resume next run.
    }
    await sleep(1000)
  }

  const stillPending = universe.symbols.filter((s) => s.provider === 'alphavantage' && !s.av).length
  console.log(`\nResolved ${resolved} this run; ${stillPending} still unmapped.`)
  if (notes.length > 0) {
    console.log('\nNotes:')
    for (const note of notes) console.log(`  ${note.symbol}: ${note.note}`)
  }

  if (write && resolved > 0) {
    await writeFile(UNIVERSE_FILE, `${JSON.stringify(universe, null, 2)}\n`, 'utf8')
    console.log(`\nWrote ${UNIVERSE_FILE}`)
  } else if (!write) {
    console.log('\n(dry run — pass --write to persist)')
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
