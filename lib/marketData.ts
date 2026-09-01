/**
 * Client-side access to the static market data.
 *
 * There is no backend: everything here is a plain fetch of a JSON file that
 * ships with the site, refreshed by the scheduled GitHub Action in
 * .github/workflows/refresh-market-data.yml. That means no CORS problems, no
 * rate limits at runtime, and no third-party request from the visitor's
 * browser — the trade-off is a curated symbol universe rather than every ticker
 * on earth, and prices as fresh as the last refresh.
 */

import type { PricePoint } from './backtest'

/** Next rewrites requests under basePath, but a raw fetch() needs it spelled out. */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export type SymbolEntry = {
  symbol: string
  name: string
  type: string
  currency: string
  category: string
  /** Filename under /data/prices/. */
  file: string
  firstMonth: string
  lastMonth: string
  /** False when the provider gave no dividend record, so adjclose == close. */
  adjustedAvailable?: boolean
}

export type SymbolsIndex = {
  generatedAt: string
  symbols: SymbolEntry[]
}

export type PriceHistory = {
  symbol: string
  name: string
  currency: string
  type: string
  points: PricePoint[]
  adjustedAvailable?: boolean
}

export type DepositRates = {
  generatedAt: string
  monthlyRates: Record<string, number>
  latest: { month: string; rate: number } | null
  source: string
}

/**
 * Which dataset was missing. The UI renders the sentence, so the code — not an
 * English string — is what travels out of here.
 */
export type MarketDataCode = 'symbols' | 'history' | 'rates'

export class MarketDataError extends Error {
  constructor(
    readonly code: MarketDataCode,
    readonly symbol?: string
  ) {
    super(
      symbol
        ? `No published market data for ${symbol} (${code}).`
        : `No published market data (${code}).`
    )
    this.name = 'MarketDataError'
  }
}

/**
 * Cache the *promise*, not the result, so several holdings added at once share
 * one request instead of racing.
 */
const inFlight = new Map<string, Promise<unknown>>()

function loadJson<T>(path: string, code: MarketDataCode, symbol?: string): Promise<T> {
  const cached = inFlight.get(path) as Promise<T> | undefined
  if (cached) return cached

  const request = fetch(`${BASE_PATH}${path}`)
    .then(async (response) => {
      if (!response.ok) throw new MarketDataError(code, symbol)
      return (await response.json()) as T
    })
    .catch((error) => {
      // A failed load must not be cached, or a transient network blip would
      // stick for the rest of the session.
      inFlight.delete(path)
      throw error instanceof MarketDataError ? error : new MarketDataError(code, symbol)
    })

  inFlight.set(path, request)
  return request
}

export function loadSymbols(): Promise<SymbolsIndex> {
  return loadJson<SymbolsIndex>('/data/symbols.json', 'symbols')
}

export function loadHistory(entry: SymbolEntry): Promise<PriceHistory> {
  return loadJson<PriceHistory>(`/data/prices/${entry.file}`, 'history', entry.symbol)
}

export function loadRates(): Promise<DepositRates> {
  return loadJson<DepositRates>('/data/rates.json', 'rates')
}

/**
 * Rank matches so typing a ticker puts that ticker first, while a word from the
 * fund name still finds it. Pure, so it is unit tested directly.
 */
export function searchSymbols(
  symbols: SymbolEntry[],
  query: string,
  limit = 12
): SymbolEntry[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []

  const scored: { entry: SymbolEntry; rank: number }[] = []
  for (const entry of symbols) {
    const symbol = entry.symbol.toLowerCase()
    const name = entry.name.toLowerCase()

    let rank: number
    if (symbol === needle) rank = 0
    else if (symbol.startsWith(needle)) rank = 1
    // The bit before the exchange suffix, so "vwce" still ranks high for VWCE.DE.
    else if (symbol.split('.')[0].startsWith(needle)) rank = 2
    else if (name.startsWith(needle)) rank = 3
    else if (name.includes(needle)) rank = 4
    else if (symbol.includes(needle)) rank = 5
    else continue

    scored.push({ entry, rank })
  }

  scored.sort((a, b) => a.rank - b.rank || a.entry.symbol.localeCompare(b.entry.symbol))
  return scored.slice(0, limit).map((match) => match.entry)
}
