/**
 * Basic-mode compounding engine. Pure — no I/O, no React.
 *
 * Everything is simulated on a monthly grid, because that is the natural
 * granularity of both contributions and the ECB deposit-rate series. The
 * chosen compound frequency is folded into a per-month growth factor, so a
 * yearly reported value is identical to textbook discrete compounding at that
 * frequency while the in-between months still draw a smooth curve.
 */

export type CompoundFrequency =
  | 'daily'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'annually'

export type ContributionFrequency = 'monthly' | 'quarterly' | 'annually'

export const COMPOUNDS_PER_YEAR: Record<CompoundFrequency, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  semiannually: 2,
  annually: 1,
}

export const CONTRIBUTIONS_PER_YEAR: Record<ContributionFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  annually: 1,
}

export const COMPOUND_LABELS: Record<CompoundFrequency, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannually: 'Semi-annually',
  annually: 'Annually',
}

export const CONTRIBUTION_LABELS: Record<ContributionFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
}

/** A bank baseline: either one flat rate, or the real month-by-month history. */
export type BankConfig =
  | { mode: 'fixed'; rate: number }
  /** `monthlyRates` is keyed 'YYYY-MM'; gaps fall back to the nearest earlier month. */
  | { mode: 'historical'; monthlyRates: Record<string, number>; fallbackRate: number }

export type ContributionSchedule = {
  /** Number of months to simulate. */
  months: number
  initial: number
  contribution: number
  /** Add a contribution every N months (1 = monthly, 3 = quarterly, 12 = annually). */
  everyMonths: number
}

/**
 * Per-month growth factor for an annual nominal rate compounded `n` times a
 * year. `(1 + r/n)^(n/12)` — at any 12-month boundary this equals `(1 + r/n)^n`.
 */
export function monthlyGrowthFactor(annualRate: number, compoundsPerYear: number): number {
  if (annualRate === 0) return 1
  const base = 1 + annualRate / compoundsPerYear
  // A rate below -100% p.a. is not meaningful; clamp so we never take a
  // fractional power of a negative number and hand back NaN.
  if (base <= 0) return 0
  return Math.pow(base, compoundsPerYear / 12)
}

/**
 * Walk the schedule month by month, returning the balance at months 0..N.
 * Interest is applied first, then the contribution — i.e. contributions land at
 * the *end* of their period and earn nothing in the month they are paid in.
 */
export function accrue(
  schedule: ContributionSchedule,
  monthlyFactorAt: (monthIndex: number) => number
): number[] {
  const balances: number[] = [schedule.initial]
  let balance = schedule.initial
  for (let month = 1; month <= schedule.months; month++) {
    balance *= monthlyFactorAt(month)
    if (schedule.contribution !== 0 && month % schedule.everyMonths === 0) {
      balance += schedule.contribution
    }
    balances.push(balance)
  }
  return balances
}

/** Cumulative amount the user actually put in, at months 0..N. */
export function contributedSeries(schedule: ContributionSchedule): number[] {
  const series: number[] = [schedule.initial]
  let total = schedule.initial
  for (let month = 1; month <= schedule.months; month++) {
    if (schedule.contribution !== 0 && month % schedule.everyMonths === 0) {
      total += schedule.contribution
    }
    series.push(total)
  }
  return series
}

/** 'YYYY-MM' for `monthIndex` months after `start`. */
export function monthKey(start: Date, monthIndex: number): string {
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthIndex, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Build the per-month bank growth factor. Historical mode looks the real ECB
 * rate up for each calendar month, carrying the last known rate forward (and
 * backward, for months before the series begins).
 */
export function bankFactorAt(
  bank: BankConfig,
  start: Date
): (monthIndex: number) => number {
  if (bank.mode === 'fixed') {
    const factor = monthlyGrowthFactor(bank.rate, 12)
    return () => factor
  }
  const keys = Object.keys(bank.monthlyRates).sort()
  const cache = new Map<number, number>()
  return (monthIndex: number) => {
    const cached = cache.get(monthIndex)
    if (cached !== undefined) return cached
    const key = monthKey(start, monthIndex)
    let rate = bank.monthlyRates[key]
    if (rate === undefined) {
      // Nearest earlier month with data; if the window predates the series
      // entirely, use its first observation rather than the fallback.
      let previous: string | undefined
      for (const k of keys) {
        if (k <= key) previous = k
        else break
      }
      rate = previous
        ? bank.monthlyRates[previous]
        : keys.length > 0
          ? bank.monthlyRates[keys[0]]
          : bank.fallbackRate
    }
    const factor = monthlyGrowthFactor(rate, 12)
    cache.set(monthIndex, factor)
    return factor
  }
}

export type ProjectionInput = {
  initial: number
  contribution: number
  contributionFrequency: ContributionFrequency
  years: number
  /** Estimated interest rate as a decimal, e.g. 0.07. */
  rate: number
  /** Interest-rate variance range as a decimal, e.g. 0.05 → best/worst are ±5pp. */
  variance: number
  compoundFrequency: CompoundFrequency
  bank: BankConfig
  /** Defaults to today; the backtest passes the real start month. */
  startDate?: Date
}

export type ProjectionPoint = {
  monthIndex: number
  /** Fractional years elapsed, for the x axis. */
  year: number
  date: string
  worst: number
  average: number
  best: number
  bank: number
  contributed: number
}

export type ProjectionResult = {
  points: ProjectionPoint[]
  /** Year-end rows only (including month 0), for the breakdown table. */
  yearlyPoints: ProjectionPoint[]
  totalContributed: number
  finalWorst: number
  finalAverage: number
  finalBest: number
  finalBank: number
  /** The headline: how much more investing left you with than the bank did. */
  gapWorst: number
  gapAverage: number
  gapBest: number
  interestEarned: number
  rates: { worst: number; average: number; best: number }
}

export function project(input: ProjectionInput): ProjectionResult {
  const start = input.startDate ?? new Date()
  const months = Math.round(input.years * 12)
  const schedule: ContributionSchedule = {
    months,
    initial: input.initial,
    contribution: input.contribution,
    everyMonths: 12 / CONTRIBUTIONS_PER_YEAR[input.contributionFrequency],
  }

  const n = COMPOUNDS_PER_YEAR[input.compoundFrequency]
  const variance = Math.abs(input.variance)
  const rates = {
    worst: input.rate - variance,
    average: input.rate,
    best: input.rate + variance,
  }

  const constantFactor = (rate: number) => {
    const factor = monthlyGrowthFactor(rate, n)
    return () => factor
  }

  const worst = accrue(schedule, constantFactor(rates.worst))
  const average = accrue(schedule, constantFactor(rates.average))
  const best = accrue(schedule, constantFactor(rates.best))
  const bank = accrue(schedule, bankFactorAt(input.bank, start))
  const contributed = contributedSeries(schedule)

  const points: ProjectionPoint[] = []
  for (let i = 0; i <= months; i++) {
    points.push({
      monthIndex: i,
      year: i / 12,
      date: monthKey(start, i),
      worst: worst[i],
      average: average[i],
      best: best[i],
      bank: bank[i],
      contributed: contributed[i],
    })
  }

  const last = points[points.length - 1]
  return {
    points,
    yearlyPoints: points.filter((p) => p.monthIndex % 12 === 0),
    totalContributed: last.contributed,
    finalWorst: last.worst,
    finalAverage: last.average,
    finalBest: last.best,
    finalBank: last.bank,
    gapWorst: last.worst - last.bank,
    gapAverage: last.average - last.bank,
    gapBest: last.best - last.bank,
    interestEarned: last.average - last.contributed,
    rates,
  }
}
