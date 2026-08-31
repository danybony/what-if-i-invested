import { describe, expect, it } from 'vitest'
import {
  accrue,
  bankFactorAt,
  monthKey,
  monthlyGrowthFactor,
  project,
  type ProjectionInput,
} from '../projection'

const base: ProjectionInput = {
  initial: 10_000,
  contribution: 100,
  contributionFrequency: 'monthly',
  years: 10,
  rate: 0.05,
  variance: 0,
  compoundFrequency: 'monthly',
  bank: { mode: 'fixed', rate: 0 },
  startDate: new Date(Date.UTC(2026, 0, 1)),
}

describe('monthlyGrowthFactor', () => {
  it('compounds to the nominal annual factor over 12 months', () => {
    const f = monthlyGrowthFactor(0.05, 12)
    expect(f ** 12).toBeCloseTo((1 + 0.05 / 12) ** 12, 12)
  })

  it('reproduces plain annual compounding at the year boundary', () => {
    const f = monthlyGrowthFactor(0.07, 1)
    expect(f ** 12).toBeCloseTo(1.07, 12)
  })

  it('is inert at a zero rate and safe below -100% p.a.', () => {
    expect(monthlyGrowthFactor(0, 12)).toBe(1)
    expect(monthlyGrowthFactor(-24, 12)).toBe(0)
  })
})

describe('project', () => {
  it('matches the closed-form ordinary annuity (investor.gov convention)', () => {
    const f = 1 + 0.05 / 12
    const expected = 10_000 * f ** 120 + 100 * ((f ** 120 - 1) / (f - 1))
    const result = project(base)
    expect(result.finalAverage).toBeCloseTo(expected, 6)
    // Sanity: the familiar ~€32k answer for this textbook input.
    expect(Math.round(result.finalAverage)).toBe(31_998)
  })

  it('returns exactly the money paid in when nothing grows', () => {
    const result = project({ ...base, rate: 0 })
    expect(result.finalAverage).toBeCloseTo(10_000 + 100 * 120, 9)
    expect(result.totalContributed).toBeCloseTo(10_000 + 100 * 120, 9)
    expect(result.interestEarned).toBeCloseTo(0, 9)
  })

  it('a 0% bank line is flat at the money paid in, and the gap is the whole point', () => {
    const result = project(base)
    expect(result.finalBank).toBeCloseTo(result.totalContributed, 9)
    expect(result.gapAverage).toBeCloseTo(result.finalAverage - result.totalContributed, 9)
  })

  it('collapses best and worst onto average when the variance range is zero', () => {
    const result = project(base)
    expect(result.finalWorst).toBe(result.finalAverage)
    expect(result.finalBest).toBe(result.finalAverage)
  })

  it('spreads the band by ± the variance range', () => {
    const result = project({ ...base, variance: 0.03 })
    expect(result.rates.worst).toBeCloseTo(0.02, 12)
    expect(result.rates.average).toBeCloseTo(0.05, 12)
    expect(result.rates.best).toBeCloseTo(0.08, 12)
    expect(result.finalWorst).toBeLessThan(result.finalAverage)
    expect(result.finalBest).toBeGreaterThan(result.finalAverage)
  })

  it('honours the contribution frequency', () => {
    const monthly = project({ ...base, contribution: 300, contributionFrequency: 'monthly' })
    const quarterly = project({ ...base, contribution: 900, contributionFrequency: 'quarterly' })
    // Same money in, but the quarterly saver is invested for less time.
    expect(quarterly.totalContributed).toBeCloseTo(monthly.totalContributed, 9)
    expect(quarterly.finalAverage).toBeLessThan(monthly.finalAverage)
  })

  it('emits one point per month plus month zero, and year-end rows for the table', () => {
    const result = project(base)
    expect(result.points).toHaveLength(121)
    expect(result.points[0].average).toBe(10_000)
    expect(result.yearlyPoints).toHaveLength(11)
    expect(result.yearlyPoints.at(-1)?.year).toBe(10)
  })
})

describe('bankFactorAt', () => {
  const start = new Date(Date.UTC(2015, 0, 1))
  const rates = { '2015-01': 0.005, '2023-01': 0.025 }

  it('carries the last known rate forward and the first one backward', () => {
    const factor = bankFactorAt({ mode: 'historical', monthlyRates: rates, fallbackRate: 0 }, start)
    expect(factor(0)).toBeCloseTo(monthlyGrowthFactor(0.005, 12), 12)
    expect(factor(11)).toBeCloseTo(monthlyGrowthFactor(0.005, 12), 12) // no 2015-12 entry
    expect(factor(96)).toBeCloseTo(monthlyGrowthFactor(0.025, 12), 12) // 2023-01
    expect(factor(200)).toBeCloseTo(monthlyGrowthFactor(0.025, 12), 12) // beyond the series
  })

  it('leaves near-zero euro-area years barely distinguishable from a mattress', () => {
    const schedule = { months: 84, initial: 10_000, contribution: 0, everyMonths: 1 }
    const factor = bankFactorAt(
      { mode: 'historical', monthlyRates: { '2015-01': 0.003 }, fallbackRate: 0 },
      start
    )
    const balances = accrue(schedule, factor)
    expect(balances.at(-1)!).toBeLessThan(10_215)
  })
})

describe('monthKey', () => {
  it('rolls over the year', () => {
    const start = new Date(Date.UTC(2025, 10, 15))
    expect(monthKey(start, 0)).toBe('2025-11')
    expect(monthKey(start, 2)).toBe('2026-01')
    expect(monthKey(start, 14)).toBe('2027-01')
  })
})
