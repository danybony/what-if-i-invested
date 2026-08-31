import type { CompoundFrequency, ContributionFrequency } from './projection'

/**
 * Starting points for the two investor.gov-style fields. Every number stays
 * editable — these only save the user from inventing a rate from nothing.
 * Figures are rounded long-run nominal averages, not forecasts.
 */
export type RatePreset = {
  id: string
  label: string
  rate: number
  variance: number
  note: string
}

export const RATE_PRESETS: RatePreset[] = [
  {
    id: 'global-equity',
    label: 'Global equity ETF',
    rate: 0.07,
    variance: 0.05,
    note: 'A world tracker such as an MSCI World or FTSE All-World fund.',
  },
  {
    id: 'sp500',
    label: 'S&P 500',
    rate: 0.08,
    variance: 0.06,
    note: 'US large caps — higher long-run return, wider swings.',
  },
  {
    id: 'balanced',
    label: '60 / 40 portfolio',
    rate: 0.055,
    variance: 0.035,
    note: 'Sixty percent shares, forty percent bonds.',
  },
  {
    id: 'bonds',
    label: 'Government bonds',
    rate: 0.03,
    variance: 0.02,
    note: 'Investment-grade government debt.',
  },
  {
    id: 'money-market',
    label: 'Money market fund',
    rate: 0.02,
    variance: 0.01,
    note: 'Short-term cash-like instruments that track policy rates.',
  },
]

export const DEFAULT_PRESET = RATE_PRESETS[0]

export type BasicFormState = {
  initial: number
  contribution: number
  contributionFrequency: ContributionFrequency
  years: number
  rate: number
  variance: number
  compoundFrequency: CompoundFrequency
  bankRate: number
  currency: string
}

export const DEFAULT_BASIC_FORM: BasicFormState = {
  initial: 10_000,
  contribution: 300,
  contributionFrequency: 'monthly',
  years: 20,
  rate: DEFAULT_PRESET.rate,
  variance: DEFAULT_PRESET.variance,
  compoundFrequency: 'monthly',
  // Most euro-area current accounts pay nothing, so that is the honest default.
  bankRate: 0,
  currency: 'EUR',
}
