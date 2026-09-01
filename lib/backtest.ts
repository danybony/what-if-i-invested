/**
 * Advanced-mode portfolio backtest. Pure — it takes price history that has
 * already been fetched and returns what the money would actually have done.
 *
 * Mechanics, per the agreed scope: buy-and-hold with recurring contributions
 * (DCA). Weights drift, there is no rebalancing, and there is no FX conversion
 * — which is exactly why a portfolio is required to be single-currency.
 */

import {
  CONTRIBUTIONS_PER_YEAR,
  accrue,
  bankFactorAt,
  contributedSeries,
  monthKey,
  type BankConfig,
  type ContributionFrequency,
  type ContributionSchedule,
} from './projection'

export type PricePoint = {
  /** 'YYYY-MM' */
  month: string
  close: number
  adjclose: number
}

export type Holding = {
  symbol: string
  name: string
  currency: string
  /** Portfolio weight as a decimal, 0..1. */
  weight: number
  points: PricePoint[]
}

/** Re-exported so pages can build a bank baseline without importing two modules. */
export type BankConfigInput = BankConfig

export type BacktestInput = {
  holdings: Holding[]
  initial: number
  contribution: number
  contributionFrequency: ContributionFrequency
  /** Requested start, 'YYYY-MM'. Clamped forward if a holding is younger. */
  startMonth: string
  bank: BankConfig
  /** Off by default: use raw close (price return) rather than adjusted close. */
  reinvestDividends: boolean
}

export type BacktestPoint = {
  monthIndex: number
  month: string
  year: number
  portfolio: number
  bank: number
  contributed: number
  /** Value of a €1 buy-and-hold stake at t0 — the portfolio's own return path. */
  index: number
}

/**
 * `message` is English and exists as a fallback; the UI renders the error from
 * `code` and `detail` so it can speak the visitor's language. The engine stays
 * free of anything that would have to be translated to stay correct.
 */
export type BacktestError = {
  code: 'no-holdings' | 'weights' | 'mixed-currency' | 'no-overlap' | 'too-short'
  message: string
  detail: {
    symbol?: string
    currency?: string
    otherCurrency?: string
    totalWeight?: number
    month?: string
  }
}

export type BacktestResult = {
  ok: true
  points: BacktestPoint[]
  yearlyPoints: BacktestPoint[]
  currency: string
  /** Where the backtest really began, after clamping to the shortest history. */
  effectiveStart: string
  endMonth: string
  /** Set when `effectiveStart` had to move, so the UI can say why. */
  clampedBy?: { symbol: string; firstMonth: string }
  totalContributed: number
  finalValue: number
  finalBank: number
  gapVsBank: number
  profit: number
  /** Money-weighted (IRR) annual return — what the saver actually earned. */
  annualisedReturn: number
  /** Time-weighted annual return of the holdings themselves, ignoring timing. */
  indexCagr: number
  /** Deepest peak-to-trough fall of the portfolio's own return path. */
  maxDrawdown: number
  unitsBought: { symbol: string; units: number; finalValue: number; finalWeight: number }[]
}

export function parseMonth(key: string): Date {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

/** Inclusive list of 'YYYY-MM' keys from `start` to `end`. */
export function monthRange(start: string, end: string): string[] {
  const from = parseMonth(start)
  const to = parseMonth(end)
  const months: string[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    months.push(monthKey(cursor, 0))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

/**
 * Monthly money-weighted return by bisection. `flows[i]` is the net cash flow
 * at month `i` (negative = paid in). Returns the annualised rate.
 */
export function moneyWeightedReturn(flows: number[]): number {
  const npv = (monthlyRate: number) =>
    flows.reduce((sum, flow, i) => sum + flow / Math.pow(1 + monthlyRate, i), 0)

  let low = -0.9999
  let high = 1
  if (npv(low) * npv(high) > 0) return NaN
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2
    if (npv(low) * npv(mid) <= 0) high = mid
    else low = mid
  }
  const monthly = (low + high) / 2
  return Math.pow(1 + monthly, 12) - 1
}

export function maxDrawdownOf(series: number[]): number {
  let peak = -Infinity
  let worst = 0
  for (const value of series) {
    if (value > peak) peak = value
    if (peak > 0) worst = Math.min(worst, value / peak - 1)
  }
  return worst
}

export function backtest(input: BacktestInput): BacktestResult | { ok: false; error: BacktestError } {
  const { holdings } = input

  if (holdings.length === 0) {
    return {
      ok: false,
      error: { code: 'no-holdings', message: 'Add at least one holding.', detail: {} },
    }
  }

  const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0)
  if (Math.abs(totalWeight - 1) > 1e-6) {
    return {
      ok: false,
      error: {
        code: 'weights',
        message: `Weights add up to ${(totalWeight * 100).toFixed(1)}% — they need to total 100%.`,
        detail: { totalWeight },
      },
    }
  }

  const currency = holdings[0].currency
  const foreign = holdings.find((h) => h.currency !== currency)
  if (foreign) {
    return {
      ok: false,
      error: {
        code: 'mixed-currency',
        message: `This portfolio is in ${currency} — ${foreign.symbol} trades in ${foreign.currency}. Currency conversion isn't modelled, so every holding has to share one currency.`,
        detail: { currency, symbol: foreign.symbol, otherCurrency: foreign.currency },
      },
    }
  }

  const empty = holdings.find((h) => h.points.length === 0)
  if (empty) {
    return {
      ok: false,
      error: {
        code: 'no-overlap',
        message: `No price history available for ${empty.symbol}.`,
        detail: { symbol: empty.symbol },
      },
    }
  }

  // The backtest can only run over the window every holding covers.
  let effectiveStart = input.startMonth
  let clampedBy: BacktestResult['clampedBy']
  for (const holding of holdings) {
    const first = holding.points[0].month
    if (first > effectiveStart) {
      effectiveStart = first
      clampedBy = { symbol: holding.symbol, firstMonth: first }
    }
  }
  const endMonth = holdings.reduce(
    (earliest, h) => {
      const last = h.points[h.points.length - 1].month
      return last < earliest ? last : earliest
    },
    holdings[0].points[holdings[0].points.length - 1].month
  )

  if (endMonth <= effectiveStart) {
    return {
      ok: false,
      error: {
        code: 'too-short',
        message: `There is less than a month of overlapping history for these holdings (from ${effectiveStart}).`,
        detail: { month: effectiveStart },
      },
    }
  }

  const months = monthRange(effectiveStart, endMonth)
  const priceField = input.reinvestDividends ? 'adjclose' : 'close'

  // Align each holding onto the shared grid, carrying the last price forward
  // across any month a listing happened to be missing.
  const priceOf = new Map<string, number[]>()
  for (const holding of holdings) {
    const byMonth = new Map(holding.points.map((p) => [p.month, p[priceField]]))
    const aligned: number[] = []
    let last = holding.points[0][priceField]
    for (const month of months) {
      const price = byMonth.get(month)
      if (price !== undefined && price > 0) last = price
      aligned.push(last)
    }
    priceOf.set(holding.symbol, aligned)
  }

  const everyMonths = 12 / CONTRIBUTIONS_PER_YEAR[input.contributionFrequency]
  const schedule: ContributionSchedule = {
    months: months.length - 1,
    initial: input.initial,
    contribution: input.contribution,
    everyMonths,
  }

  // Buy at t0, then again on every contribution month, at that month's price.
  const units = new Map(holdings.map((h) => [h.symbol, 0]))
  const buy = (monthIndex: number, amount: number) => {
    if (amount <= 0) return
    for (const holding of holdings) {
      const price = priceOf.get(holding.symbol)![monthIndex]
      if (price > 0) {
        units.set(holding.symbol, units.get(holding.symbol)! + (amount * holding.weight) / price)
      }
    }
  }

  const bankBalances = accrue(schedule, bankFactorAt(input.bank, parseMonth(effectiveStart)))
  const contributed = contributedSeries(schedule)

  // A separate €1 buy-and-hold stake, so drawdown and time-weighted return
  // describe the holdings rather than the deposit schedule.
  const indexUnits = new Map(
    holdings.map((h) => [h.symbol, h.weight / priceOf.get(h.symbol)![0]])
  )

  const points: BacktestPoint[] = []
  const flows: number[] = []
  for (let i = 0; i < months.length; i++) {
    if (i === 0) {
      buy(0, input.initial)
      flows.push(-input.initial)
    } else {
      const isContributionMonth = input.contribution !== 0 && i % everyMonths === 0
      if (isContributionMonth) buy(i, input.contribution)
      flows.push(isContributionMonth ? -input.contribution : 0)
    }

    let value = 0
    let index = 0
    for (const holding of holdings) {
      const price = priceOf.get(holding.symbol)![i]
      value += units.get(holding.symbol)! * price
      index += indexUnits.get(holding.symbol)! * price
    }

    points.push({
      monthIndex: i,
      month: months[i],
      year: i / 12,
      portfolio: value,
      bank: bankBalances[i],
      contributed: contributed[i],
      index,
    })
  }

  const last = points[points.length - 1]
  flows[flows.length - 1] += last.portfolio

  const years = (months.length - 1) / 12
  const indexCagr = years > 0 ? Math.pow(last.index, 1 / years) - 1 : 0

  return {
    ok: true,
    points,
    yearlyPoints: points.filter((p, i) => p.monthIndex % 12 === 0 || i === points.length - 1),
    currency,
    effectiveStart,
    endMonth,
    clampedBy,
    totalContributed: last.contributed,
    finalValue: last.portfolio,
    finalBank: last.bank,
    gapVsBank: last.portfolio - last.bank,
    profit: last.portfolio - last.contributed,
    annualisedReturn: moneyWeightedReturn(flows),
    indexCagr,
    maxDrawdown: maxDrawdownOf(points.map((p) => p.index)),
    unitsBought: holdings.map((h) => {
      const finalHoldingValue = units.get(h.symbol)! * priceOf.get(h.symbol)![months.length - 1]
      return {
        symbol: h.symbol,
        units: units.get(h.symbol)!,
        finalValue: finalHoldingValue,
        finalWeight: last.portfolio > 0 ? finalHoldingValue / last.portfolio : 0,
      }
    }),
  }
}
