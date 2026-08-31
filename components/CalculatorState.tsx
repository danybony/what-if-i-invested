'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PortfolioHolding } from '@/components/PortfolioBuilder'
import { DEFAULT_ADVANCED, DEFAULT_BASIC, DEFAULT_SHARED } from '@/lib/presets'
import type { CompoundFrequency, ContributionFrequency } from '@/lib/projection'

/**
 * Inputs shared by both modes, plus each mode's own, held above the routes.
 *
 * Basic and Advanced ask the same opening question — how much, how often — so
 * retyping it after switching tabs is pure friction. Keeping the state here
 * means a switch preserves everything, including already-fetched holdings, so
 * flipping back to Advanced does not refetch.
 *
 * This is deliberately in memory only. Persisting it would mean writing to
 * browser storage, which the consent banner would then have to account for; the
 * ask was to survive a tab switch, not a browser restart.
 */
export type SharedInputs = {
  initial: number
  contribution: number
  contributionFrequency: ContributionFrequency
  /** Annual bank rate as a decimal. */
  bankRate: number
}

export type BasicInputs = {
  years: number
  rate: number
  variance: number
  compoundFrequency: CompoundFrequency
  currency: string
}

export type AdvancedInputs = {
  startMonth: string
  useHistoricalRates: boolean
  reinvestDividends: boolean
  holdings: PortfolioHolding[]
}

type CalculatorStateValue = {
  shared: SharedInputs
  setShared: <K extends keyof SharedInputs>(key: K, value: SharedInputs[K]) => void
  basic: BasicInputs
  setBasic: <K extends keyof BasicInputs>(key: K, value: BasicInputs[K]) => void
  setRateAndVariance: (rate: number, variance: number) => void
  advanced: AdvancedInputs
  setAdvanced: <K extends keyof AdvancedInputs>(key: K, value: AdvancedInputs[K]) => void
  updateHoldings: (update: (previous: PortfolioHolding[]) => PortfolioHolding[]) => void
}

const CalculatorStateContext = createContext<CalculatorStateValue | null>(null)

export function useCalculatorState(): CalculatorStateValue {
  const context = useContext(CalculatorStateContext)
  if (!context) throw new Error('useCalculatorState must be used inside <CalculatorStateProvider>')
  return context
}

export function CalculatorStateProvider({ children }: { children: ReactNode }) {
  const [shared, setSharedState] = useState<SharedInputs>(DEFAULT_SHARED)
  const [basic, setBasicState] = useState<BasicInputs>(DEFAULT_BASIC)
  const [advanced, setAdvancedState] = useState<AdvancedInputs>(DEFAULT_ADVANCED)

  const value = useMemo<CalculatorStateValue>(
    () => ({
      shared,
      setShared: (key, next) => setSharedState((previous) => ({ ...previous, [key]: next })),
      basic,
      setBasic: (key, next) => setBasicState((previous) => ({ ...previous, [key]: next })),
      // A preset moves both numbers at once; two setState calls would render an
      // inconsistent pair in between.
      setRateAndVariance: (rate, variance) =>
        setBasicState((previous) => ({ ...previous, rate, variance })),
      advanced,
      setAdvanced: (key, next) => setAdvancedState((previous) => ({ ...previous, [key]: next })),
      updateHoldings: (update) =>
        setAdvancedState((previous) => ({ ...previous, holdings: update(previous.holdings) })),
    }),
    [shared, basic, advanced]
  )

  return (
    <CalculatorStateContext.Provider value={value}>{children}</CalculatorStateContext.Provider>
  )
}
