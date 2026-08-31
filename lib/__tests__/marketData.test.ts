import { describe, expect, it } from 'vitest'
import { searchSymbols, type SymbolEntry } from '../marketData'

const entry = (symbol: string, name: string): SymbolEntry => ({
  symbol,
  name,
  type: 'ETF',
  currency: 'EUR',
  category: 'World equity',
  file: `${symbol}.json`,
  firstMonth: '2019-09',
  lastMonth: '2026-08',
})

const universe: SymbolEntry[] = [
  entry('VWCE.DE', 'Vanguard FTSE All-World UCITS ETF Acc'),
  entry('VWRL.AS', 'Vanguard FTSE All-World UCITS ETF Dist'),
  entry('AAPL', 'Apple Inc.'),
  entry('CSPX.MI', 'iShares Core S&P 500 UCITS ETF Acc'),
  entry('SPY', 'SPDR S&P 500 ETF Trust'),
]

describe('searchSymbols', () => {
  it('returns nothing for an empty query rather than the whole universe', () => {
    expect(searchSymbols(universe, '')).toEqual([])
    expect(searchSymbols(universe, '   ')).toEqual([])
  })

  it('puts an exact ticker first', () => {
    expect(searchSymbols(universe, 'aapl')[0].symbol).toBe('AAPL')
  })

  it('matches the ticker before its exchange suffix', () => {
    // "vwce" must find VWCE.DE even though the stored symbol has a suffix.
    expect(searchSymbols(universe, 'vwce')[0].symbol).toBe('VWCE.DE')
  })

  it('finds a fund by a word in its name', () => {
    const hits = searchSymbols(universe, 'vanguard').map((h) => h.symbol)
    expect(hits).toEqual(['VWCE.DE', 'VWRL.AS'])
  })

  it('ranks a ticker prefix above a name substring', () => {
    const hits = searchSymbols(universe, 'sp').map((h) => h.symbol)
    expect(hits[0]).toBe('SPY') // ticker prefix beats "S&P 500" in a name
    expect(hits).toContain('CSPX.MI')
  })

  it('is case insensitive and ignores surrounding space', () => {
    expect(searchSymbols(universe, '  ApPl  ')[0].symbol).toBe('AAPL')
  })

  it('honours the result limit', () => {
    expect(searchSymbols(universe, 'e', 2)).toHaveLength(2)
  })

  it('returns nothing for a symbol outside the curated universe', () => {
    expect(searchSymbols(universe, 'ZZZZ')).toEqual([])
  })
})
