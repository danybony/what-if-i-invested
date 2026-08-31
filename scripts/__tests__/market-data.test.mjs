import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildAlphaVantageHistory,
  buildHistory,
  fileNameFor,
  normaliseCurrency,
  parseEcbCsv,
  resetThrottle,
  roundPrice,
  splitCsvLine,
  throttle,
} from '../market-data.mjs'

const entry = (overrides = {}) => ({
  symbol: 'TEST.DE',
  name: 'Hint name',
  type: 'ETF',
  currency: 'EUR',
  td: { symbol: 'TEST', mic: 'XETR' },
  ...overrides,
})

const series = (values, meta = {}) => ({
  meta: { currency: 'EUR', name: 'Test Fund', type: 'ETF', ...meta },
  values,
})

describe('normaliseCurrency', () => {
  /**
   * London quotes in pence. 'GBp' is not a real ISO 4217 code, so it would throw
   * inside Intl.NumberFormat, and leaving the number alone would show a holding
   * at 100x its value.
   */
  it('converts minor units to the major currency', () => {
    expect(normaliseCurrency('GBp')).toEqual({ currency: 'GBP', divisor: 100 })
    expect(normaliseCurrency('GBX')).toEqual({ currency: 'GBP', divisor: 100 })
    expect(normaliseCurrency('ZAc')).toEqual({ currency: 'ZAR', divisor: 100 })
  })

  it('leaves an ordinary currency alone', () => {
    expect(normaliseCurrency('EUR')).toEqual({ currency: 'EUR', divisor: 1 })
    expect(normaliseCurrency('USD')).toEqual({ currency: 'USD', divisor: 1 })
  })
})

describe('roundPrice', () => {
  it('trims to four decimals', () => {
    expect(roundPrice(72.56999969482422)).toBe(72.57)
    expect(roundPrice(0.00123456)).toBe(0.0012)
  })
})

describe('buildHistory', () => {
  const rows = [
    { datetime: '2024-01-01', close: '100' },
    { datetime: '2024-02-01', close: '110' },
    { datetime: '2024-03-01', close: '120' },
  ]

  it('keys months from the series date and carries the meta through', () => {
    const history = buildHistory(entry(), series(rows))
    expect(history.symbol).toBe('TEST.DE')
    expect(history.name).toBe('Test Fund')
    expect(history.currency).toBe('EUR')
    expect(history.points.map((p) => p.month)).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('sorts oldest-first even when the upstream returns newest-first', () => {
    const history = buildHistory(entry(), series([...rows].reverse()))
    expect(history.points.map((p) => p.close)).toEqual([100, 110, 120])
  })

  it('leaves adjusted equal to close when nothing was paid out', () => {
    const history = buildHistory(entry(), series(rows))
    expect(history.points.map((p) => p.adjclose)).toEqual([100, 110, 120])
    expect(history.dividendCount).toBe(0)
  })

  it('reconstructs the adjusted series by reinvesting each dividend', () => {
    // A 10.00 dividend in February buys 10/110 more shares.
    const history = buildHistory(entry(), series(rows), [
      { ex_date: '2024-02-15', amount: '10' },
    ])
    const shares = 1 + 10 / 110

    // Rebased so the newest adjusted close equals the newest close.
    expect(history.points.at(-1).adjclose).toBe(120)
    expect(history.points[0].adjclose).toBeCloseTo(100 / shares, 4)
    expect(history.dividendCount).toBe(1)

    // The whole point: total return must beat price return.
    const priceReturn = 120 / 100
    const totalReturn = history.points.at(-1).adjclose / history.points[0].adjclose
    expect(totalReturn).toBeGreaterThan(priceReturn)
  })

  it('sums several dividends in the same month', () => {
    const one = buildHistory(entry(), series(rows), [
      { ex_date: '2024-02-05', amount: '5' },
      { ex_date: '2024-02-20', amount: '5' },
    ])
    const combined = buildHistory(entry(), series(rows), [{ ex_date: '2024-02-15', amount: '10' }])
    expect(one.points[0].adjclose).toBeCloseTo(combined.points[0].adjclose, 6)
  })

  it('converts pence to pounds for both prices and dividends', () => {
    const history = buildHistory(
      entry({ symbol: 'BP.L' }),
      series(rows, { currency: 'GBp' }),
      [{ ex_date: '2024-02-15', amount: '10' }]
    )
    expect(history.currency).toBe('GBP')
    expect(history.points.map((p) => p.close)).toEqual([1, 1.1, 1.2])
    // The dividend scaled with the prices, so the ratio is unchanged.
    // Compared at the stored precision: published prices are rounded to 4dp.
    expect(history.points[0].adjclose).toBeCloseTo(1 / (1 + 0.1 / 1.1), 4)
  })

  it('skips unusable rows and ignores malformed dividends', () => {
    const history = buildHistory(
      entry(),
      series([...rows, { datetime: '2024-04-01', close: '0' }, { datetime: '2024-05-01', close: 'x' }]),
      [{ ex_date: '2024-02-15', amount: 'not a number' }, { amount: '5' }]
    )
    expect(history.points).toHaveLength(3)
    expect(history.dividendCount).toBe(0)
  })

  it('throws when there is nothing usable, so the caller can skip the symbol', () => {
    expect(() => buildHistory(entry(), series([]))).toThrow('no price history')
    expect(() => buildHistory(entry(), series([{ datetime: '2024-01-01', close: '0' }]))).toThrow(
      'no usable price history'
    )
  })
})

describe('buildAlphaVantageHistory', () => {
  const series = {
    '2024-01-31': { '4. close': '100', '5. adjusted close': '98', '7. dividend amount': '0.0000' },
    '2024-03-28': { '4. close': '120', '5. adjusted close': '120', '7. dividend amount': '1.5000' },
    '2024-02-29': { '4. close': '110', '5. adjusted close': '109', '7. dividend amount': '0.0000' },
  }

  it('takes the adjusted close as given rather than reconstructing it', () => {
    const history = buildAlphaVantageHistory(entry({ av: { symbol: 'X.DEX', currency: 'EUR' } }), series)
    expect(history.points).toEqual([
      { month: '2024-01', close: 100, adjclose: 98 },
      { month: '2024-02', close: 110, adjclose: 109 },
      { month: '2024-03', close: 120, adjclose: 120 },
    ])
  })

  it('sorts by date, since object key order is not a contract', () => {
    const history = buildAlphaVantageHistory(entry({ av: { symbol: 'X.DEX', currency: 'EUR' } }), series)
    expect(history.points.map((p) => p.month)).toEqual(['2024-01', '2024-02', '2024-03'])
  })

  it('counts the months that paid something out', () => {
    const history = buildAlphaVantageHistory(entry({ av: { symbol: 'X.DEX', currency: 'EUR' } }), series)
    expect(history.dividendCount).toBe(1)
  })

  it('converts a London listing from pence to pounds', () => {
    const history = buildAlphaVantageHistory(
      entry({ symbol: 'SHEL.L', av: { symbol: 'SHEL.LON', currency: 'GBX' } }),
      series
    )
    expect(history.currency).toBe('GBP')
    expect(history.points.map((p) => p.close)).toEqual([1, 1.1, 1.2])
    expect(history.points[0].adjclose).toBe(0.98)
  })

  it('takes the currency from the mapping, since the response carries none', () => {
    const history = buildAlphaVantageHistory(
      entry({ currency: 'EUR', av: { symbol: 'X.LON', currency: 'GBX' } }),
      series
    )
    expect(history.currency).toBe('GBP')
  })

  it('falls back to close when a row has no usable adjusted value', () => {
    const history = buildAlphaVantageHistory(entry({ av: { symbol: 'X.DEX', currency: 'EUR' } }), {
      '2024-01-31': { '4. close': '100', '5. adjusted close': '0', '7. dividend amount': '0' },
    })
    expect(history.points[0].adjclose).toBe(100)
  })

  it('throws on an empty series so the caller can skip the symbol', () => {
    expect(() => buildAlphaVantageHistory(entry({ av: { symbol: 'X.DEX' } }), {})).toThrow()
  })
})

describe('throttle', () => {
  beforeEach(() => resetThrottle())

  it('lets the first call through and spaces the next one', async () => {
    const start = Date.now()
    await throttle(50)
    expect(Date.now() - start).toBeLessThan(30)
    await throttle(50)
    await throttle(50)
    expect(Date.now() - start).toBeGreaterThanOrEqual(45)
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
