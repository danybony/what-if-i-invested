/**
 * Yahoo Finance client.
 *
 * The endpoints are keyless but unofficial: they need a browser User-Agent,
 * send no CORS headers (so this is server-only), and rate-limit an IP hard once
 * it makes more than a handful of uncached calls. Three things keep us under
 * that ceiling:
 *
 *   1. Full history is fetched once per symbol and cached for a day — every
 *      start date the user tries is then served by slicing that one entry.
 *   2. Requests fail over between Yahoo's two hosts, with a short retry.
 *   3. If everything upstream fails, `cached()` hands back the last known good
 *      answer marked stale rather than an error.
 */

import { cached } from './cache'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const HOSTS = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']

const HISTORY_TTL_MS = 24 * 60 * 60 * 1000
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(path: string): Promise<unknown> {
  let lastError = new UpstreamError('Could not reach the market-data provider.', 502)

  // Two passes over both hosts: a 429 is often a short burst limit.
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const host of HOSTS) {
      let response: Response
      try {
        response = await fetch(`${host}${path}`, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          cache: 'no-store',
        })
      } catch {
        lastError = new UpstreamError('Could not reach the market-data provider.', 502)
        continue
      }

      if (response.ok) return response.json()

      if (response.status === 404) {
        // A genuine "no such symbol" — the other host will agree.
        throw new UpstreamError('No data for that symbol.', 404)
      }

      lastError =
        response.status === 429
          ? new UpstreamError(
              'The free market-data provider is rate limiting this server right now. Cached symbols still work — try again in a few minutes.',
              429
            )
          : new UpstreamError(`Market-data provider returned ${response.status}.`, 502)
    }
    if (attempt === 0) await sleep(500)
  }

  throw lastError
}

export type SearchHit = {
  symbol: string
  name: string
  exchange: string
  type: 'ETF' | 'EQUITY'
}

export async function searchSymbols(query: string, limit = 10): Promise<SearchHit[]> {
  const normalised = query.trim().toLowerCase()
  const { value } = await cached(`search:${normalised}`, SEARCH_TTL_MS, async () => {
    const path = `/v1/finance/search?q=${encodeURIComponent(normalised)}&quotesCount=25&newsCount=0&listsCount=0`
    const data = (await getJson(path)) as {
      quotes?: {
        symbol?: string
        shortname?: string
        longname?: string
        exchDisp?: string
        exchange?: string
        quoteType?: string
        isYahooFinance?: boolean
      }[]
    }

    return (data.quotes ?? [])
      .filter(
        (quote) =>
          quote.isYahooFinance !== false &&
          typeof quote.symbol === 'string' &&
          (quote.quoteType === 'ETF' || quote.quoteType === 'EQUITY')
      )
      .map((quote) => ({
        symbol: quote.symbol!,
        name: quote.longname ?? quote.shortname ?? quote.symbol!,
        exchange: quote.exchDisp ?? quote.exchange ?? '',
        type: quote.quoteType as 'ETF' | 'EQUITY',
      }))
  })

  return value.slice(0, limit)
}

/**
 * Yahoo's monthly bars are stamped at midnight in the *exchange's* timezone, so
 * a XETRA bar for September is 2019-08-31T22:00Z. Converting in UTC therefore
 * files it under the wrong month. `meta.gmtoffset` can't fix this either — it
 * is the offset at fetch time, so it is an hour out for every bar on the other
 * side of a DST boundary, which is enough to move a month-start bar into the
 * previous month. Formatting in the named exchange timezone is exact.
 */
export function monthKeyInTimeZone(epochSeconds: number, timeZone: string): string {
  const formatter = formatterFor(timeZone)
  const parts = formatter.formatToParts(new Date(epochSeconds * 1000))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone)
  if (cached) return cached
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' })
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit' })
  }
  formatters.set(timeZone, formatter)
  return formatter
}

export type HistoryPoint = { month: string; close: number; adjclose: number }

export type History = {
  symbol: string
  name: string
  currency: string
  type: string
  points: HistoryPoint[]
}

/** Cache key for a symbol's full monthly history. Shared with the seed script. */
export function historyCacheKey(symbol: string): string {
  return `history:${symbol.toUpperCase()}`
}

async function fetchFullHistory(symbol: string): Promise<History> {
  // period1=0 asks for everything Yahoo has, so one cache entry serves every
  // start date the user might pick.
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1mo&includeAdjustedClose=true`

  const data = (await getJson(path)) as {
    chart?: {
      error?: { description?: string } | null
      result?: {
        meta?: {
          currency?: string
          longName?: string
          shortName?: string
          instrumentType?: string
          exchangeTimezoneName?: string
        }
        timestamp?: number[]
        indicators?: {
          quote?: { close?: (number | null)[] }[]
          adjclose?: { adjclose?: (number | null)[] }[]
        }
      }[]
    }
  }

  const result = data.chart?.result?.[0]
  if (!result?.timestamp) {
    throw new UpstreamError(data.chart?.error?.description ?? `No price history for ${symbol}.`, 404)
  }

  const closes = result.indicators?.quote?.[0]?.close ?? []
  const adjcloses = result.indicators?.adjclose?.[0]?.adjclose ?? closes

  const timeZone = result.meta?.exchangeTimezoneName ?? 'UTC'
  const points: HistoryPoint[] = []
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = closes[i]
    if (close === null || close === undefined) continue
    points.push({
      month: monthKeyInTimeZone(result.timestamp[i], timeZone),
      close,
      adjclose: adjcloses[i] ?? close,
    })
  }

  if (points.length === 0) {
    throw new UpstreamError(`No usable price history for ${symbol}.`, 404)
  }

  return {
    symbol: symbol.toUpperCase(),
    name: result.meta?.longName ?? result.meta?.shortName ?? symbol,
    currency: result.meta?.currency ?? 'EUR',
    type: result.meta?.instrumentType ?? '',
    points,
  }
}

export type HistoryResponse = History & { stale: boolean }

/** Monthly history for `symbol`, trimmed to months on or after `fromMonth`. */
export async function fetchHistory(symbol: string, fromMonth?: string): Promise<HistoryResponse> {
  const { value, stale } = await cached(historyCacheKey(symbol), HISTORY_TTL_MS, () =>
    fetchFullHistory(symbol)
  )
  const points = fromMonth ? value.points.filter((point) => point.month >= fromMonth) : value.points
  return { ...value, points, stale }
}
