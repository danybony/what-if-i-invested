import { describe, expect, it } from 'vitest'
import {
  backtest,
  maxDrawdownOf,
  moneyWeightedReturn,
  monthRange,
  type BacktestInput,
  type Holding,
} from '../backtest'

/** A holding whose price follows `prices`, starting at `startMonth`. */
function holding(
  symbol: string,
  startMonth: string,
  prices: number[],
  extra: Partial<Holding> = {}
): Holding {
  const months = monthRange(startMonth, '2100-01').slice(0, prices.length)
  return {
    symbol,
    name: symbol,
    currency: 'EUR',
    weight: 1,
    points: prices.map((price, i) => ({ month: months[i], close: price, adjclose: price * 1.1 })),
    ...extra,
  }
}

const lumpSum: BacktestInput = {
  holdings: [holding('TEST', '2020-01', [100, 110, 120, 150])],
  initial: 10_000,
  contribution: 0,
  contributionFrequency: 'monthly',
  startMonth: '2020-01',
  bank: { mode: 'fixed', rate: 0 },
  reinvestDividends: false,
}

function expectOk<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true)
  return result as Extract<T, { ok: true }>
}

describe('backtest', () => {
  it('a lump sum is just the price ratio', () => {
    const result = expectOk(backtest(lumpSum))
    expect(result.finalValue).toBeCloseTo(10_000 * (150 / 100), 9)
    expect(result.profit).toBeCloseTo(5_000, 9)
    expect(result.gapVsBank).toBeCloseTo(5_000, 9)
  })

  it('splits a two-holding portfolio by weight and reports the drifted weights', () => {
    const result = expectOk(
      backtest({
        ...lumpSum,
        holdings: [
          holding('UP', '2020-01', [100, 100, 100, 200], { weight: 0.5 }),
          holding('FLAT', '2020-01', [50, 50, 50, 50], { weight: 0.5 }),
        ],
      })
    )
    // 5,000 doubles, 5,000 stands still.
    expect(result.finalValue).toBeCloseTo(15_000, 9)
    expect(result.unitsBought.find((u) => u.symbol === 'UP')?.finalWeight).toBeCloseTo(2 / 3, 9)
  })

  it('buys at each month price when contributing, and beats a 0% bank by the profit', () => {
    const result = expectOk(
      backtest({ ...lumpSum, initial: 0, contribution: 1_000, contributionFrequency: 'monthly' })
    )
    // Contributions land at the end of months 1..3: 110, 120, 150.
    const units = 1_000 / 110 + 1_000 / 120 + 1_000 / 150
    expect(result.finalValue).toBeCloseTo(units * 150, 6)
    expect(result.totalContributed).toBeCloseTo(3_000, 9)
    expect(result.finalBank).toBeCloseTo(3_000, 9)
  })

  it('uses adjusted close only when dividend reinvestment is on', () => {
    const priceOnly = expectOk(backtest(lumpSum))
    const withDividends = expectOk(backtest({ ...lumpSum, reinvestDividends: true }))
    // Same 1.1x adjustment at both ends, so the ratio is unchanged here.
    expect(withDividends.finalValue).toBeCloseTo(priceOnly.finalValue, 6)
    const distributing = expectOk(
      backtest({
        ...lumpSum,
        reinvestDividends: true,
        holdings: [
          {
            ...holding('DIST', '2020-01', [100, 100, 100, 100]),
            points: [100, 100, 100, 100].map((p, i) => ({
              month: monthRange('2020-01', '2020-04')[i],
              close: p,
              adjclose: p * (1 + i * 0.01),
            })),
          },
        ],
      })
    )
    expect(distributing.finalValue).toBeGreaterThan(10_000)
  })

  it('rejects a mixed-currency portfolio instead of quietly adding euros to dollars', () => {
    const result = backtest({
      ...lumpSum,
      holdings: [
        holding('VWCE.DE', '2020-01', [100, 110, 120, 150], { weight: 0.5 }),
        holding('AAPL', '2020-01', [100, 110, 120, 150], { weight: 0.5, currency: 'USD' }),
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('mixed-currency')
      expect(result.error.message).toContain('AAPL')
    }
  })

  it('rejects weights that do not add up', () => {
    const result = backtest({
      ...lumpSum,
      holdings: [
        holding('A', '2020-01', [100, 110, 120, 150], { weight: 0.5 }),
        holding('B', '2020-01', [100, 110, 120, 150], { weight: 0.3 }),
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('weights')
  })

  it('clamps the start date to the youngest holding and says which one', () => {
    const result = expectOk(
      backtest({
        ...lumpSum,
        startMonth: '2019-01',
        holdings: [
          holding('OLD', '2019-01', Array(16).fill(100), { weight: 0.5 }),
          holding('NEW', '2020-01', [100, 110, 120, 150], { weight: 0.5 }),
        ],
      })
    )
    expect(result.effectiveStart).toBe('2020-01')
    expect(result.clampedBy?.symbol).toBe('NEW')
  })

  it('carries a missing month forward rather than dropping to zero', () => {
    const gappy = holding('GAP', '2020-01', [100, 110, 120, 150])
    gappy.points.splice(1, 1) // no 2020-02 print
    const result = expectOk(backtest({ ...lumpSum, holdings: [gappy] }))
    expect(result.points[1].portfolio).toBeCloseTo(10_000, 9) // held at 100
    expect(result.points[3].portfolio).toBeCloseTo(15_000, 9)
  })

  it('reports the money-weighted return alongside the holdings own return', () => {
    const result = expectOk(backtest(lumpSum))
    // A lump sum has no timing effect, so both measures agree.
    expect(result.annualisedReturn).toBeCloseTo(result.indexCagr, 6)
    expect(result.indexCagr).toBeCloseTo(Math.pow(1.5, 4) - 1, 6) // 3 months = 0.25y
  })
})

describe('moneyWeightedReturn', () => {
  it('recovers a known rate', () => {
    // 100 in, 12 months later 100 * 1.12^1 back out.
    const flows = [-100, ...Array(11).fill(0), 112]
    expect(moneyWeightedReturn(flows)).toBeCloseTo(0.12, 6)
  })
})

describe('maxDrawdownOf', () => {
  it('measures the deepest peak-to-trough fall', () => {
    expect(maxDrawdownOf([1, 1.5, 0.75, 2])).toBeCloseTo(-0.5, 9)
    expect(maxDrawdownOf([1, 2, 3])).toBe(0)
  })
})

describe('monthRange', () => {
  it('is inclusive and rolls over years', () => {
    expect(monthRange('2024-11', '2025-02')).toEqual(['2024-11', '2024-12', '2025-01', '2025-02'])
  })
})
