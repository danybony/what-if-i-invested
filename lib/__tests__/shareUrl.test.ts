import { describe, expect, it } from 'vitest'
import { DEFAULT_ADVANCED, DEFAULT_BASIC, DEFAULT_SHARED } from '../presets'
import {
  decodeShareParams,
  encodeShareParams,
  shareScope,
  type ShareState,
} from '../shareUrl'

const defaults: ShareState = {
  shared: DEFAULT_SHARED,
  basic: DEFAULT_BASIC,
  advanced: { ...DEFAULT_ADVANCED, holdings: [] },
}

function withShared(patch: Partial<ShareState['shared']>): ShareState {
  return { ...defaults, shared: { ...defaults.shared, ...patch } }
}

function withBasic(patch: Partial<ShareState['basic']>): ShareState {
  return { ...defaults, basic: { ...defaults.basic, ...patch } }
}

function withAdvanced(patch: Partial<ShareState['advanced']>): ShareState {
  return { ...defaults, advanced: { ...defaults.advanced, ...patch } }
}

describe('encodeShareParams', () => {
  it('writes nothing when nothing was changed', () => {
    expect(encodeShareParams('basic', defaults)).toBe('')
    expect(encodeShareParams('advanced', defaults)).toBe('')
  })

  it('writes only the changed fields', () => {
    expect(encodeShareParams('basic', withBasic({ years: 30 }))).toBe('years=30')
    expect(encodeShareParams('basic', withShared({ initial: 5_000 }))).toBe('initial=5000')
  })

  it('writes rates as the percentages the inputs show', () => {
    expect(encodeShareParams('basic', withBasic({ rate: 0.055 }))).toBe('rate=5.5')
    expect(encodeShareParams('basic', withShared({ bankRate: 0.0225 }))).toBe('bank=2.25')
  })

  it('leaves the portfolio separators readable', () => {
    const query = encodeShareParams(
      'advanced',
      withAdvanced({
        holdings: [
          { symbol: 'VWCE.DE', weight: 60 },
          { symbol: 'AAPL', weight: 40 },
        ],
      })
    )
    expect(query).toBe('holdings=VWCE.DE:60,AAPL:40')
  })

  it('keeps each mode to the fields it shows', () => {
    const state = {
      ...withBasic({ years: 30 }).basic,
    }
    const mixed: ShareState = {
      shared: DEFAULT_SHARED,
      basic: state,
      advanced: { ...DEFAULT_ADVANCED, holdings: [{ symbol: 'AAPL', weight: 100 }] },
    }
    expect(encodeShareParams('basic', mixed)).toBe('years=30')
    expect(encodeShareParams('advanced', mixed)).toBe('holdings=AAPL:100')
  })

  it('survives a round trip', () => {
    const state: ShareState = {
      shared: {
        initial: 250,
        contribution: 75,
        contributionFrequency: 'annually',
        bankRate: 0.0225,
      },
      basic: {
        years: 12,
        rate: 0.041,
        variance: 0.02,
        compoundFrequency: 'annually',
        currency: 'USD',
      },
      advanced: defaults.advanced,
    }

    const query = encodeShareParams('basic', state)
    const link = decodeShareParams(query)
    const reopened: ShareState = {
      shared: { ...DEFAULT_SHARED, ...link.shared },
      basic: { ...DEFAULT_BASIC, ...link.basic },
      advanced: defaults.advanced,
    }

    // Compared as a link rather than field by field: 4.1% is 0.040999999999999995
    // whichever way it is typed, and what has to hold is that reopening a link
    // and resharing it hands the next reader the same one.
    expect(encodeShareParams('basic', reopened)).toBe(query)
    expect(reopened.basic.years).toBe(12)
    expect(reopened.shared.bankRate).toBeCloseTo(0.0225, 10)
  })
})

describe('decodeShareParams', () => {
  it('leaves fields the link did not mention alone', () => {
    const link = decodeShareParams('?years=30')
    expect(link.basic).toEqual({ years: 30 })
    expect(link.shared).toEqual({})
    expect(link.holdings).toBeNull()
  })

  it('reads percentages back as decimals', () => {
    expect(decodeShareParams('?rate=7&swing=5&bank=2.5')).toMatchObject({
      basic: { rate: 0.07, variance: 0.05 },
      shared: { bankRate: 0.025 },
    })
  })

  it('clamps to what the inputs themselves allow', () => {
    expect(decodeShareParams('?years=900').basic.years).toBe(60)
    expect(decodeShareParams('?years=0').basic.years).toBe(1)
    expect(decodeShareParams('?initial=-5').shared.initial).toBe(0)
  })

  it('drops values that are not numbers or not on the list', () => {
    expect(decodeShareParams('?years=soon&currency=XYZ&every=hourly')).toEqual({
      shared: {},
      basic: {},
      advanced: {},
      holdings: null,
    })
  })

  it('reads flags and a start month', () => {
    expect(decodeShareParams('?ecb=1&dividends=0&from=2015-03').advanced).toEqual({
      startMonth: '2015-03',
      useHistoricalRates: true,
      reinvestDividends: false,
    })
    expect(decodeShareParams('?from=2015-13').advanced.startMonth).toBeUndefined()
  })

  it('reads a portfolio, dropping duplicates and nonsense tickers', () => {
    expect(decodeShareParams('?holdings=vwce.de:60,VWCE.DE:20,<script>:20,AAPL:40')).toMatchObject({
      holdings: [
        { symbol: 'VWCE.DE', weight: 60 },
        { symbol: 'AAPL', weight: 40 },
      ],
    })
  })

  it('splits a weightless portfolio evenly', () => {
    expect(decodeShareParams('?holdings=VWCE.DE,AAPL,MSFT').holdings).toEqual([
      { symbol: 'VWCE.DE', weight: 33.3 },
      { symbol: 'AAPL', weight: 33.3 },
      { symbol: 'MSFT', weight: 33.4 },
    ])
  })

  it('caps how many holdings a link can ask for', () => {
    const many = Array.from({ length: 30 }, (_, index) => `SYM${index}`).join(',')
    expect(decodeShareParams(`?holdings=${many}`).holdings).toHaveLength(12)
  })

  it('tells an empty portfolio apart from an unmentioned one', () => {
    expect(decodeShareParams('?holdings=').holdings).toEqual([])
    expect(decodeShareParams('').holdings).toBeNull()
  })
})

describe('shareScope', () => {
  it('treats the home page as Basic, and ignores everything else', () => {
    expect(shareScope('/')).toBe('basic')
    expect(shareScope('/basic')).toBe('basic')
    expect(shareScope('/basic/')).toBe('basic')
    expect(shareScope('/advanced/')).toBe('advanced')
    expect(shareScope('/disclaimer/')).toBeNull()
  })
})
