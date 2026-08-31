/**
 * Market-data helpers shared by the refresh script and its tests.
 *
 * This is plain ESM rather than TypeScript so the GitHub Action can run it with
 * bare `node`, no build step and no dev dependencies. It is build-time tooling:
 * nothing here ships to the browser.
 */

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** Yahoo serves the same API from two hosts and rate-limits them separately. */
const YAHOO_HOSTS = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com']

const ECB_DEPOSIT_SERIES =
  'https://data-api.ecb.europa.eu/service/data/MIR/M.U2.B.L22.A.R.A.2250.EUR.N?format=csvdata&startPeriod=1999-01'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Yahoo stamps monthly bars at midnight in the *exchange's* timezone, so a
 * XETRA September bar is 2019-08-31T22:00Z. Reading those as UTC files European
 * bars a month early, and `meta.gmtoffset` cannot fix it either — it is the
 * offset at fetch time, so it is an hour out for every bar on the far side of a
 * DST boundary, which is enough to move a month-start bar into the previous
 * month. Formatting in the named exchange timezone is exact.
 */
const formatters = new Map()

export function monthKeyInTimeZone(epochSeconds, timeZone) {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' })
    } catch {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
      })
    }
    formatters.set(timeZone, formatter)
  }
  const parts = formatter.formatToParts(new Date(epochSeconds * 1000))
  const year = parts.find((part) => part.type === 'year').value
  const month = parts.find((part) => part.type === 'month').value
  return `${year}-${month}`
}

/**
 * Yahoo reports float32 artefacts like 72.56999969482422. Four decimals is far
 * more precision than a monthly close needs and roughly halves the payload.
 */
export function roundPrice(value) {
  return Math.round(value * 10_000) / 10_000
}

/** Turn a raw Yahoo chart response into the shape the site serves. */
export function normaliseChart(symbol, data) {
  const result = data?.chart?.result?.[0]
  if (!result?.timestamp) {
    throw new Error(data?.chart?.error?.description ?? `no price history for ${symbol}`)
  }

  const closes = result.indicators?.quote?.[0]?.close ?? []
  const adjcloses = result.indicators?.adjclose?.[0]?.adjclose ?? closes
  const timeZone = result.meta?.exchangeTimezoneName ?? 'UTC'

  const points = []
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = closes[i]
    if (close === null || close === undefined) continue
    points.push({
      month: monthKeyInTimeZone(result.timestamp[i], timeZone),
      close: roundPrice(close),
      adjclose: roundPrice(adjcloses[i] ?? close),
    })
  }

  if (points.length === 0) throw new Error(`no usable price history for ${symbol}`)

  return {
    symbol: symbol.toUpperCase(),
    name: result.meta?.longName ?? result.meta?.shortName ?? symbol,
    currency: result.meta?.currency ?? 'EUR',
    type: result.meta?.instrumentType ?? '',
    points,
  }
}

/** A symbol becomes a filename; keep it URL- and filesystem-safe. */
export function fileNameFor(symbol) {
  return `${symbol.toUpperCase().replace(/[^A-Za-z0-9._-]/g, '_')}.json`
}

async function getJson(path, { attempts = 3, backoffMs = 2000 } = {}) {
  let lastError = new Error('unreachable')

  for (let attempt = 0; attempt < attempts; attempt++) {
    for (const host of YAHOO_HOSTS) {
      let response
      try {
        response = await fetch(`${host}${path}`, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
        })
      } catch (error) {
        lastError = error
        continue
      }

      if (response.ok) return response.json()
      // A 404 is a genuine "no such symbol" — the other host will agree, and
      // retrying wastes budget we need for the symbols that do exist.
      if (response.status === 404) throw new Error('not found on Yahoo')
      lastError = new Error(`HTTP ${response.status}`)
    }
    if (attempt < attempts - 1) await sleep(backoffMs * (attempt + 1))
  }

  throw lastError
}

/** Full monthly history for `symbol`, oldest bar first. */
export async function fetchYahooHistory(symbol, options) {
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1mo&includeAdjustedClose=true`
  return normaliseChart(symbol, await getJson(path, options))
}

/** Minimal CSV field splitter — the ECB quotes fields containing commas. */
export function splitCsvLine(line) {
  const fields = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field)
      field = ''
    } else {
      field += char
    }
  }
  fields.push(field)
  return fields
}

export function parseEcbCsv(csv) {
  const lines = csv.trim().split('\n')
  const header = splitCsvLine(lines[0])
  const periodIndex = header.indexOf('TIME_PERIOD')
  const valueIndex = header.indexOf('OBS_VALUE')
  if (periodIndex === -1 || valueIndex === -1) throw new Error('unexpected ECB CSV layout')

  const monthlyRates = {}
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line)
    const month = fields[periodIndex]
    const value = Number(fields[valueIndex])
    if (!month || Number.isNaN(value)) continue
    monthlyRates[month] = Math.round((value / 100) * 1e6) / 1e6
  }

  const months = Object.keys(monthlyRates).sort()
  const latestMonth = months[months.length - 1]
  return {
    monthlyRates,
    latest: latestMonth ? { month: latestMonth, rate: monthlyRates[latestMonth] } : null,
  }
}

/** Euro-area household deposit rates — what a bank actually pays, monthly. */
export async function fetchEcbRates() {
  const response = await fetch(ECB_DEPOSIT_SERIES, { headers: { Accept: 'text/csv' } })
  if (!response.ok) throw new Error(`ECB returned ${response.status}`)
  return {
    ...parseEcbCsv(await response.text()),
    source: 'ECB — deposits from households with an agreed maturity, euro area',
  }
}
