/**
 * Market-data helpers shared by the refresh script and its tests.
 *
 * Plain ESM rather than TypeScript so the GitHub Action can run it with bare
 * `node`, no build step and no dependencies. This is build-time tooling —
 * nothing here ships to the browser.
 *
 * Prices come from two providers, because no single free tier covers what the
 * site needs. Yahoo's keyless endpoints blanket-block datacenter IPs (a GitHub
 * runner gets 429 on its first request), so they are unusable from CI at all.
 * Twelve Data's free tier is generous but US-only. Alpha Vantage covers XETRA,
 * Frankfurt, London and Amsterdam but allows only ~25 calls a day.
 *
 * So: US venues come from Twelve Data daily, everything else from Alpha Vantage
 * on a rotation. Each universe entry names its own provider.
 */

const TWELVE_DATA = 'https://api.twelvedata.com'
const ALPHA_VANTAGE = 'https://www.alphavantage.co/query'

const ECB_DEPOSIT_SERIES =
  'https://data-api.ecb.europa.eu/service/data/MIR/M.U2.B.L22.A.R.A.2250.EUR.N?format=csvdata&startPeriod=1999-01'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Some venues quote in minor units — London in pence, not pounds. 'GBp' is not
 * a real ISO 4217 code, so passing it to Intl.NumberFormat throws; leaving it
 * unconverted would also make a UK holding look 100x its true value. Convert to
 * the major unit at the door and the rest of the app never has to know.
 */
const MINOR_UNITS = {
  GBp: { currency: 'GBP', divisor: 100 },
  GBX: { currency: 'GBP', divisor: 100 },
  ZAc: { currency: 'ZAR', divisor: 100 },
  ILA: { currency: 'ILS', divisor: 100 },
}

export function normaliseCurrency(currency) {
  return MINOR_UNITS[currency] ?? { currency, divisor: 1 }
}

/** Four decimals is far more precision than a monthly close needs. */
export function roundPrice(value) {
  return Math.round(value * 10_000) / 10_000
}

/** A symbol becomes a filename; keep it URL- and filesystem-safe. */
export function fileNameFor(symbol) {
  return `${symbol.toUpperCase().replace(/[^A-Za-z0-9._-]/g, '_')}.json`
}

/**
 * The free tier allows 8 requests a minute. One shared gate keeps prices and
 * dividends from racing past it together.
 */
let nextSlot = 0

export async function throttle(minIntervalMs) {
  const now = Date.now()
  const wait = Math.max(0, nextSlot - now)
  nextSlot = Math.max(now, nextSlot) + minIntervalMs
  if (wait > 0) await sleep(wait)
}

export function resetThrottle() {
  nextSlot = 0
}

/**
 * Twelve Data reports failures as HTTP 200 with an error body as often as not,
 * so the body is what decides.
 */
async function getJson(path, params, { apiKey, minIntervalMs = 8000 }) {
  await throttle(minIntervalMs)

  const query = new URLSearchParams({ ...params, apikey: apiKey })
  const response = await fetch(`${TWELVE_DATA}${path}?${query}`)
  const body = await response.json().catch(() => null)

  if (!body) throw new Error(`HTTP ${response.status} with an unreadable body`)
  if (body.status === 'error' || typeof body.code === 'number') {
    throw new Error(`${body.code ?? response.status}: ${body.message ?? 'unknown error'}`)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return body
}

export async function fetchTimeSeries(entry, options) {
  return getJson(
    '/time_series',
    {
      symbol: entry.td.symbol,
      mic_code: entry.td.mic,
      interval: '1month',
      outputsize: '5000',
      order: 'ASC',
    },
    options
  )
}

export async function fetchDividends(entry, options) {
  const body = await getJson(
    '/dividends',
    { symbol: entry.td.symbol, mic_code: entry.td.mic, range: 'full' },
    options
  )
  return Array.isArray(body?.dividends) ? body.dividends : []
}

/**
 * Build the published history from a monthly series and its dividend record.
 *
 * Twelve Data's closes are split-adjusted but not dividend-adjusted, so the
 * adjusted series is reconstructed here: each dividend buys more shares at that
 * month's close, and the resulting share count scales the price. The series is
 * then rebased so the newest adjusted close equals the newest close, which is
 * the convention the app and the earlier Yahoo data already used.
 */
export function buildHistory(entry, series, dividends = []) {
  const values = series?.values
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('no price history returned')
  }

  const rawCurrency = series.meta?.currency ?? entry.currency
  const { currency, divisor } = normaliseCurrency(rawCurrency)

  // order=ASC is requested, but never trust an upstream to honour it.
  const rows = [...values].sort((a, b) => a.datetime.localeCompare(b.datetime))

  const points = []
  for (const row of rows) {
    const close = Number(row.close)
    if (!Number.isFinite(close) || close <= 0) continue
    points.push({ month: row.datetime.slice(0, 7), close: close / divisor })
  }
  if (points.length === 0) throw new Error('no usable price history')

  // Dividends per month, in the same major unit as the prices.
  const paidIn = new Map()
  for (const dividend of dividends) {
    const amount = Number(dividend.amount)
    if (!dividend.ex_date || !Number.isFinite(amount) || amount <= 0) continue
    const month = dividend.ex_date.slice(0, 7)
    paidIn.set(month, (paidIn.get(month) ?? 0) + amount / divisor)
  }

  let shares = 1
  const shareCount = points.map((point) => {
    const dividend = paidIn.get(point.month)
    if (dividend) shares *= 1 + dividend / point.close
    return shares
  })

  const finalShares = shareCount[shareCount.length - 1]
  const withAdjusted = points.map((point, i) => ({
    month: point.month,
    close: roundPrice(point.close),
    adjclose: roundPrice((point.close * shareCount[i]) / finalShares),
  }))

  return {
    symbol: entry.symbol.toUpperCase(),
    name: series.meta?.name || entry.name,
    currency,
    type: series.meta?.type || entry.type,
    points: withAdjusted,
    dividendCount: paidIn.size,
  }
}

/* -------------------------------------------------------------------------- */
/* Alpha Vantage                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Unlike Twelve Data, Alpha Vantage returns the adjusted close outright, so
 * there is nothing to reconstruct — one call per symbol, and the dividend
 * handling is the provider's problem rather than ours.
 */
export async function fetchAlphaVantageHistory(entry, { apiKey, minIntervalMs = 1000 }) {
  await throttle(minIntervalMs)

  const url =
    `${ALPHA_VANTAGE}?function=TIME_SERIES_MONTHLY_ADJUSTED` +
    `&symbol=${encodeURIComponent(entry.av.symbol)}&apikey=${apiKey}`
  const response = await fetch(url)
  const body = await response.json().catch(() => null)
  if (!body) throw new Error(`HTTP ${response.status} with an unreadable body`)

  // Throttling and errors both arrive as HTTP 200 with a prose field.
  if (body.Note || body.Information) {
    throw new Error(`rate limited: ${(body.Note ?? body.Information).slice(0, 140)}`)
  }
  if (body['Error Message']) throw new Error(body['Error Message'].slice(0, 140))

  const seriesKey = Object.keys(body).find((key) => key.includes('Time Series'))
  const series = seriesKey ? body[seriesKey] : null
  if (!series || Object.keys(series).length === 0) throw new Error('no price history returned')

  return buildAlphaVantageHistory(entry, series)
}

export function buildAlphaVantageHistory(entry, series) {
  // The response carries no currency, so the one the mapper recorded stands.
  const { currency, divisor } = normaliseCurrency(entry.av?.currency ?? entry.currency)

  const points = []
  let dividendMonths = 0
  for (const date of Object.keys(series).sort()) {
    const row = series[date]
    const close = Number(row['4. close'])
    const adjusted = Number(row['5. adjusted close'])
    if (!Number.isFinite(close) || close <= 0) continue
    if (Number(row['7. dividend amount']) > 0) dividendMonths++
    points.push({
      month: date.slice(0, 7),
      close: roundPrice(close / divisor),
      adjclose: roundPrice((Number.isFinite(adjusted) && adjusted > 0 ? adjusted : close) / divisor),
    })
  }
  if (points.length === 0) throw new Error('no usable price history')

  return {
    symbol: entry.symbol.toUpperCase(),
    name: entry.name,
    currency,
    type: entry.type,
    points,
    dividendCount: dividendMonths,
  }
}

/* -------------------------------------------------------------------------- */
/* ECB                                                                        */
/* -------------------------------------------------------------------------- */

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
