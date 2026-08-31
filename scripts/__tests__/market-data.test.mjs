import { describe, expect, it } from 'vitest'
import {
  fileNameFor,
  monthKeyInTimeZone,
  normaliseChart,
  parseEcbCsv,
  roundPrice,
  splitCsvLine,
} from '../market-data.mjs'

/**
 * Regression: Yahoo stamps monthly bars at midnight in the exchange's own
 * timezone. Reading them as UTC files European bars one month early, and using
 * meta.gmtoffset only fixes the half of the year that shares its DST state.
 */
describe('monthKeyInTimeZone', () => {
  it('files a XETRA month-start bar under the right month, not the previous one', () => {
    // 2019-08-31T22:00Z === 2019-09-01T00:00 in Berlin (CEST).
    expect(monthKeyInTimeZone(1567288800, 'Europe/Berlin')).toBe('2019-09')
    expect(monthKeyInTimeZone(1567288800, 'UTC')).toBe('2019-08') // the bug
  })

  it('handles both sides of a DST boundary, which a fixed offset cannot', () => {
    expect(monthKeyInTimeZone(1572562800, 'Europe/Berlin')).toBe('2019-11')
    expect(monthKeyInTimeZone(1785535200, 'Europe/Berlin')).toBe('2026-08')
  })

  it('handles a negative offset exchange', () => {
    expect(monthKeyInTimeZone(946702800, 'America/New_York')).toBe('2000-01')
    expect(monthKeyInTimeZone(1785556800, 'America/New_York')).toBe('2026-08')
  })

  it('falls back to UTC for an unknown timezone rather than throwing', () => {
    expect(monthKeyInTimeZone(946702800, 'Not/AZone')).toBe('2000-01')
  })
})

describe('roundPrice', () => {
  it('strips the float32 artefacts Yahoo reports', () => {
    expect(roundPrice(72.56999969482422)).toBe(72.57)
    expect(roundPrice(167.13999938964844)).toBe(167.14)
  })

  it('keeps enough precision for a penny stock', () => {
    expect(roundPrice(0.00123456)).toBe(0.0012)
  })
})

describe('normaliseChart', () => {
  const chart = (overrides = {}) => ({
    chart: {
      result: [
        {
          meta: {
            currency: 'EUR',
            longName: 'Test Fund',
            instrumentType: 'ETF',
            exchangeTimezoneName: 'Europe/Berlin',
          },
          timestamp: [1567288800, 1569880800],
          indicators: {
            quote: [{ close: [72.56999969482422, 75.5] }],
            adjclose: [{ adjclose: [70.1, 73.2] }],
          },
          ...overrides,
        },
      ],
    },
  })

  it('rounds prices and keys months by the exchange timezone', () => {
    const history = normaliseChart('VWCE.DE', chart())
    expect(history.symbol).toBe('VWCE.DE')
    expect(history.currency).toBe('EUR')
    expect(history.points).toEqual([
      { month: '2019-09', close: 72.57, adjclose: 70.1 },
      { month: '2019-10', close: 75.5, adjclose: 73.2 },
    ])
  })

  it('drops months with no close rather than emitting a null price', () => {
    const history = normaliseChart(
      'GAP',
      chart({ indicators: { quote: [{ close: [72.5, null] }], adjclose: [{ adjclose: [72.5, null] }] } })
    )
    expect(history.points).toHaveLength(1)
  })

  it('falls back to close when Yahoo sends no adjusted series', () => {
    const history = normaliseChart('NOADJ', chart({ indicators: { quote: [{ close: [10, 12] }] } }))
    expect(history.points.map((p) => p.adjclose)).toEqual([10, 12])
  })

  it('throws on an empty or error response so the caller can skip the symbol', () => {
    expect(() => normaliseChart('NOPE', { chart: { result: [] } })).toThrow()
    expect(() =>
      normaliseChart('NOPE', { chart: { error: { description: 'No data found' } } })
    ).toThrow('No data found')
  })
})

describe('fileNameFor', () => {
  it('keeps ordinary tickers readable and neutralises the rest', () => {
    expect(fileNameFor('VWCE.DE')).toBe('VWCE.DE.json')
    expect(fileNameFor('brk-b')).toBe('BRK-B.json')
    expect(fileNameFor('^GSPC')).toBe('_GSPC.json')
    expect(fileNameFor('A/B')).toBe('A_B.json')
  })
})

describe('parseEcbCsv', () => {
  const csv = [
    'KEY,FREQ,TIME_PERIOD,OBS_VALUE,TITLE',
    'MIR.M,M,2025-01,2.33,"Deposits, households"',
    'MIR.M,M,2025-02,2.2,"Deposits, households"',
  ].join('\n')

  it('converts percentages to decimals and finds the latest month', () => {
    const rates = parseEcbCsv(csv)
    expect(rates.monthlyRates['2025-01']).toBe(0.0233)
    expect(rates.monthlyRates['2025-02']).toBe(0.022)
    expect(rates.latest).toEqual({ month: '2025-02', rate: 0.022 })
  })

  it('rejects a layout it does not recognise instead of publishing nonsense', () => {
    expect(() => parseEcbCsv('A,B\n1,2')).toThrow('unexpected ECB CSV layout')
  })
})

describe('splitCsvLine', () => {
  it('respects quoted fields containing commas', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
    expect(splitCsvLine('a,"say ""hi""",c')).toEqual(['a', 'say "hi"', 'c'])
  })
})
