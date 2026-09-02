/**
 * The calculator's inputs, carried in the query string.
 *
 * A link is the only way to hand someone your numbers — there is no account and
 * no server — so every field that changes a result is written back into the URL
 * as it is edited, and read out of it on arrival.
 *
 * Only fields that differ from the defaults are written. The common case is two
 * or three changed numbers, and a link spelling out every field would be long
 * and unreadable for no gain. Keys are words rather than initials for the same
 * reason, and rates travel as percentages (`rate=7`) because that is the number
 * the inputs show.
 */

import { CURRENCIES } from './format'
import {
  DEFAULT_ADVANCED,
  DEFAULT_BASIC,
  DEFAULT_SHARED,
  type BasicInputs,
  type SharedInputs,
} from './presets'
import { COMPOUND_FREQUENCIES, CONTRIBUTION_FREQUENCIES } from './projection'

/** Just the part of a holding a link can carry; prices are refetched on arrival. */
export type ShareHolding = { symbol: string; weight: number }

export type ShareableAdvanced = {
  startMonth: string
  useHistoricalRates: boolean
  reinvestDividends: boolean
  holdings: ShareHolding[]
}

export type ShareState = {
  shared: SharedInputs
  basic: BasicInputs
  advanced: ShareableAdvanced
}

/**
 * Which set of fields a page is actually showing. Writing Advanced's portfolio
 * into a Basic link (or the other way round) would only pad the URL with
 * settings the recipient cannot see.
 */
export type ShareScope = 'basic' | 'advanced'

export type ShareLink = {
  shared: Partial<SharedInputs>
  basic: Partial<BasicInputs>
  advanced: Partial<Omit<ShareableAdvanced, 'holdings'>>
  /** null when the link said nothing about a portfolio, which is not the same as an empty one. */
  holdings: ShareHolding[] | null
}

/** A link can name at most this many holdings, so a hostile URL cannot fan out into fetches. */
const MAX_HOLDINGS = 12

/** Tickers as the symbol index spells them: VWCE.DE, SWDA.MI, BRK-B, ^GSPC. */
const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.^=-]{0,19}$/

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** The home page edits the same fields Basic does, so it shares its scope. */
export function shareScope(pathname: string): ShareScope | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/advanced') return 'advanced'
  if (path === '/' || path === '/basic') return 'basic'
  return null
}

export function encodeShareParams(scope: ShareScope, state: ShareState): string {
  const { shared, basic, advanced } = state
  const params = new URLSearchParams()

  if (scope === 'advanced' && advanced.holdings.length > 0) {
    params.set(
      'holdings',
      advanced.holdings.map((holding) => `${holding.symbol}:${num(holding.weight)}`).join(',')
    )
  }

  if (shared.initial !== DEFAULT_SHARED.initial) params.set('initial', num(shared.initial))
  if (shared.contribution !== DEFAULT_SHARED.contribution) {
    params.set('add', num(shared.contribution))
  }
  if (shared.contributionFrequency !== DEFAULT_SHARED.contributionFrequency) {
    params.set('every', shared.contributionFrequency)
  }
  if (shared.bankRate !== DEFAULT_SHARED.bankRate) params.set('bank', num(shared.bankRate * 100))

  if (scope === 'basic') {
    if (basic.years !== DEFAULT_BASIC.years) params.set('years', num(basic.years))
    if (basic.rate !== DEFAULT_BASIC.rate) params.set('rate', num(basic.rate * 100))
    if (basic.variance !== DEFAULT_BASIC.variance) params.set('swing', num(basic.variance * 100))
    if (basic.compoundFrequency !== DEFAULT_BASIC.compoundFrequency) {
      params.set('compound', basic.compoundFrequency)
    }
    if (basic.currency !== DEFAULT_BASIC.currency) params.set('currency', basic.currency)
  } else {
    if (advanced.startMonth !== DEFAULT_ADVANCED.startMonth) params.set('from', advanced.startMonth)
    if (advanced.useHistoricalRates !== DEFAULT_ADVANCED.useHistoricalRates) {
      params.set('ecb', advanced.useHistoricalRates ? '1' : '0')
    }
    if (advanced.reinvestDividends !== DEFAULT_ADVANCED.reinvestDividends) {
      params.set('dividends', advanced.reinvestDividends ? '1' : '0')
    }
  }

  return readable(params.toString())
}

/**
 * Read a link's inputs, dropping anything that does not survive the same limits
 * the inputs themselves impose. A truncated or hand-edited URL should lose the
 * fields it mangled, never render a nonsense projection.
 */
export function decodeShareParams(search: string): ShareLink {
  const params = new URLSearchParams(search)

  const shared: Partial<SharedInputs> = {}
  const initial = readNumber(params, 'initial', 0)
  if (initial !== undefined) shared.initial = initial
  const contribution = readNumber(params, 'add', 0)
  if (contribution !== undefined) shared.contribution = contribution
  const every = readOption(params, 'every', CONTRIBUTION_FREQUENCIES)
  if (every !== undefined) shared.contributionFrequency = every
  const bankRate = readNumber(params, 'bank', 0, 100)
  if (bankRate !== undefined) shared.bankRate = bankRate / 100

  const basic: Partial<BasicInputs> = {}
  const years = readNumber(params, 'years', 1, 60)
  if (years !== undefined) basic.years = Math.round(years)
  const rate = readNumber(params, 'rate', -50, 50)
  if (rate !== undefined) basic.rate = rate / 100
  const variance = readNumber(params, 'swing', 0, 50)
  if (variance !== undefined) basic.variance = variance / 100
  const compound = readOption(params, 'compound', COMPOUND_FREQUENCIES)
  if (compound !== undefined) basic.compoundFrequency = compound
  const currency = readOption(params, 'currency', CURRENCIES)
  if (currency !== undefined) basic.currency = currency

  const advanced: ShareLink['advanced'] = {}
  const from = params.get('from')?.trim()
  if (from && MONTH_PATTERN.test(from)) advanced.startMonth = from
  const ecb = readFlag(params, 'ecb')
  if (ecb !== undefined) advanced.useHistoricalRates = ecb
  const dividends = readFlag(params, 'dividends')
  if (dividends !== undefined) advanced.reinvestDividends = dividends

  return { shared, basic, advanced, holdings: readHoldings(params.get('holdings')) }
}

/**
 * The link as React sees it.
 *
 * The URL cannot be read while rendering: the prerendered HTML is built from
 * the defaults, and a first client render that disagreed with it would break
 * hydration. So it is handed over as an external store — the defaults during
 * hydration, the real link on the re-render straight after — which is the same
 * bargain lib/i18n/locale.ts strikes for the display language.
 */
export const EMPTY_LINK: ShareLink = { shared: {}, basic: {}, advanced: {}, holdings: null }

let cachedLink: ShareLink | null = null

/** Cached because React compares snapshots by identity, and re-reads on every render. */
export function getLinkSnapshot(): ShareLink {
  if (cachedLink === null) cachedLink = decodeShareParams(window.location.search)
  return cachedLink
}

export function getServerLinkSnapshot(): ShareLink {
  return EMPTY_LINK
}

/** Nothing to subscribe to: the link is read once, and after that we are its only writer. */
export function subscribeToLink(): () => void {
  return () => {}
}

function readHoldings(raw: string | null): ShareHolding[] | null {
  if (raw === null) return null

  const parsed: { symbol: string; weight: number | undefined }[] = []
  const seen = new Set<string>()
  for (const part of raw.split(',')) {
    const [rawSymbol, rawWeight] = part.split(':')
    const symbol = rawSymbol.trim().toUpperCase()
    if (!SYMBOL_PATTERN.test(symbol) || seen.has(symbol)) continue
    seen.add(symbol)
    const weight = toFinite(rawWeight)
    parsed.push({ symbol, weight: weight === undefined ? undefined : clamp(weight, 0, 100) })
    if (parsed.length === MAX_HOLDINGS) break
  }

  // A hand-written `holdings=VWCE.DE,SWDA.MI` means "these, equally" — the same
  // split the builder applies when a holding is added without a weight.
  if (parsed.every((holding) => holding.weight === undefined)) {
    return parsed.map((holding, index) => ({ ...holding, weight: evenWeight(index, parsed.length) }))
  }
  return parsed.map((holding) => ({ ...holding, weight: holding.weight ?? 0 }))
}

/** The last slice absorbs the rounding so the weights still total 100. */
function evenWeight(index: number, count: number): number {
  const even = Math.round((100 / count) * 10) / 10
  return index === count - 1 ? Math.round((100 - even * (count - 1)) * 10) / 10 : even
}

function readNumber(
  params: URLSearchParams,
  key: string,
  min: number,
  max = Number.POSITIVE_INFINITY
): number | undefined {
  const value = toFinite(params.get(key))
  return value === undefined ? undefined : clamp(value, min, max)
}

function readOption<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const raw = params.get(key)?.trim()
  return raw !== undefined && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined
}

function readFlag(params: URLSearchParams, key: string): boolean | undefined {
  const raw = params.get(key)?.trim().toLowerCase()
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return undefined
}

function toFinite(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Keep float noise (7.000000000000001) out of the URL. */
function num(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

/**
 * `:` and `,` are legal in a query string, and the portfolio list is far easier
 * to read with them left alone than as %3A and %2C.
 */
function readable(query: string): string {
  return query.replace(/%3A/g, ':').replace(/%2C/g, ',')
}
