/**
 * ECB Data Portal client — keyless CSV. We use the MIR series for the rate a
 * euro-area household actually gets on a deposit, not the policy rate, because
 * "what my bank pays me" is the honest comparison.
 */

const BASE = 'https://data-api.ecb.europa.eu/service/data'

/** Deposits from households with an agreed maturity, new business, euro area. */
const DEPOSIT_SERIES = 'MIR/M.U2.B.L22.A.R.A.2250.EUR.N'

export type DepositRates = {
  /** 'YYYY-MM' → annual rate as a decimal (0.0233 = 2.33%). */
  monthlyRates: Record<string, number>
  latest: { month: string; rate: number } | null
  source: string
}

/** Minimal CSV field splitter — the ECB quotes fields containing commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
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

export async function fetchDepositRates(startPeriod = '1999-01'): Promise<DepositRates> {
  const url = `${BASE}/${DEPOSIT_SERIES}?format=csvdata&startPeriod=${startPeriod}`
  const response = await fetch(url, {
    headers: { Accept: 'text/csv' },
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!response.ok) {
    throw new Error(`ECB returned ${response.status}`)
  }

  const lines = (await response.text()).trim().split('\n')
  const header = splitCsvLine(lines[0])
  const periodIndex = header.indexOf('TIME_PERIOD')
  const valueIndex = header.indexOf('OBS_VALUE')
  if (periodIndex === -1 || valueIndex === -1) {
    throw new Error('Unexpected ECB CSV layout')
  }

  const monthlyRates: Record<string, number> = {}
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line)
    const month = fields[periodIndex]
    const value = Number(fields[valueIndex])
    if (!month || Number.isNaN(value)) continue
    monthlyRates[month] = value / 100
  }

  const months = Object.keys(monthlyRates).sort()
  const latestMonth = months[months.length - 1]

  return {
    monthlyRates,
    latest: latestMonth ? { month: latestMonth, rate: monthlyRates[latestMonth] } : null,
    source: 'ECB — deposits from households with an agreed maturity, euro area',
  }
}
