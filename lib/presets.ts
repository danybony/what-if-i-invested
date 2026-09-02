import type { CompoundFrequency, ContributionFrequency } from './projection'

/**
 * Starting points for the two investor.gov-style fields. Every number stays
 * editable — these only save the user from inventing a rate from nothing.
 * Figures are rounded long-run nominal averages, not forecasts.
 *
 * The label and the explanatory note live in the dictionaries, keyed by `id`:
 * they are prose, and prose is translated.
 */
export type PresetId =
  | 'global-equity'
  | 'sp500'
  | 'balanced'
  | 'bonds'
  | 'money-market'

export type RatePreset = {
  id: PresetId
  rate: number
  variance: number
}

export const RATE_PRESETS: RatePreset[] = [
  { id: 'global-equity', rate: 0.07, variance: 0.05 },
  { id: 'sp500', rate: 0.08, variance: 0.06 },
  { id: 'balanced', rate: 0.055, variance: 0.035 },
  { id: 'bonds', rate: 0.03, variance: 0.02 },
  { id: 'money-market', rate: 0.02, variance: 0.01 },
]

/** The S&P 500 is the reference most people arrive with, so it leads. */
export const DEFAULT_PRESET =
  RATE_PRESETS.find((preset) => preset.id === 'sp500') ?? RATE_PRESETS[0]

/** What both modes ask for; kept in one place so a tab switch preserves it. */
export type SharedInputs = {
  initial: number
  contribution: number
  contributionFrequency: ContributionFrequency
  /** Annual bank rate as a decimal. */
  bankRate: number
}

export const DEFAULT_SHARED: SharedInputs = {
  initial: 1_000,
  contribution: 200,
  contributionFrequency: 'monthly',
  // Most euro-area current accounts pay nothing, so that is the honest default.
  bankRate: 0,
}

export type BasicInputs = {
  years: number
  rate: number
  variance: number
  compoundFrequency: CompoundFrequency
  currency: string
}

export const DEFAULT_BASIC: BasicInputs = {
  years: 20,
  rate: DEFAULT_PRESET.rate,
  variance: DEFAULT_PRESET.variance,
  compoundFrequency: 'quarterly',
  currency: 'EUR',
}

export function defaultStartMonth(monthsBack = 120): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export const DEFAULT_ADVANCED = {
  startMonth: defaultStartMonth(),
  useHistoricalRates: false,
  reinvestDividends: false,
  holdings: [],
}
