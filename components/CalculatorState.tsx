'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import type { PortfolioHolding } from '@/components/PortfolioBuilder'
import { loadHistory, loadSymbols, type SymbolEntry } from '@/lib/marketData'
import {
  DEFAULT_ADVANCED,
  DEFAULT_BASIC,
  DEFAULT_SHARED,
  type BasicInputs,
  type SharedInputs,
} from '@/lib/presets'
import {
  EMPTY_LINK,
  encodeShareParams,
  getLinkSnapshot,
  getServerLinkSnapshot,
  shareScope,
  subscribeToLink,
  type ShareHolding,
} from '@/lib/shareUrl'

/** Re-exported so the shape of this state reads as one thing, wherever it is used. */
export type { BasicInputs, SharedInputs }

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
  /** Holdings a shared link asked for whose prices are still on the way. */
  restoringSymbols: string[]
}

const CalculatorStateContext = createContext<CalculatorStateValue | null>(null)

const NO_SYMBOLS: string[] = []

export function useCalculatorState(): CalculatorStateValue {
  const context = useContext(CalculatorStateContext)
  if (!context) throw new Error('useCalculatorState must be used inside <CalculatorStateProvider>')
  return context
}

/**
 * Inputs shared by both modes, plus each mode's own, held above the routes.
 *
 * Basic and Advanced ask the same opening question — how much, how often — so
 * retyping it after switching tabs is pure friction. Keeping the state here
 * means a switch preserves everything, including already-fetched holdings, so
 * flipping back to Advanced does not refetch.
 *
 * The URL is where this state lives between visits — nothing is written to
 * browser storage, which would drag the consent banner into it. A link arrives,
 * seeds the fields it mentions, and is rewritten on every edit, so the address
 * bar is always the thing to copy.
 */
export function CalculatorStateProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const link = useSyncExternalStore(subscribeToLink, getLinkSnapshot, getServerLinkSnapshot)

  /** The defaults, with whatever the link had to say laid over them. */
  const fromLink = useMemo(
    () => ({
      shared: { ...DEFAULT_SHARED, ...link.shared },
      basic: { ...DEFAULT_BASIC, ...link.basic },
      advanced: { ...DEFAULT_ADVANCED, ...link.advanced } as AdvancedInputs,
    }),
    [link]
  )

  // Null until the first edit, so the link stays in charge across the re-render
  // that follows hydration — the first moment the URL can be read at all.
  const [sharedEdit, setSharedEdit] = useState<SharedInputs | null>(null)
  const [basicEdit, setBasicEdit] = useState<BasicInputs | null>(null)
  const [advancedEdit, setAdvancedEdit] = useState<AdvancedInputs | null>(null)
  const [restoreSettled, setRestoreSettled] = useState(false)

  const shared = sharedEdit ?? fromLink.shared
  const basic = basicEdit ?? fromLink.basic
  const advanced = advancedEdit ?? fromLink.advanced

  const restoring = (link.holdings?.length ?? 0) > 0 && !restoreSettled

  /**
   * Prices are far too big for a URL, so a link carries tickers and weights and
   * the history is fetched back here.
   */
  useEffect(() => {
    const wanted = link.holdings
    if (wanted === null || wanted.length === 0) return

    let cancelled = false
    restoreHoldings(wanted)
      .then((holdings) => {
        if (cancelled || holdings.length === 0) return
        setAdvancedEdit((previous) => ({ ...(previous ?? fromLink.advanced), holdings }))
      })
      .finally(() => {
        if (!cancelled) setRestoreSettled(true)
      })

    return () => {
      cancelled = true
    }
  }, [link, fromLink])

  /**
   * Every edit rewrites the address bar, so what is on screen is always what is
   * worth copying. replaceState rather than push: a shareable link is worth
   * having, a history entry per keystroke is not.
   *
   * Nothing is written before the link has been read, or while its holdings are
   * still loading — either would overwrite the very link being restored.
   */
  useEffect(() => {
    if (link === EMPTY_LINK || restoring) return
    const scope = pathname === null ? null : shareScope(pathname)
    if (scope === null) return

    const query = encodeShareParams(scope, { shared, basic, advanced })
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', url)
  }, [link, restoring, pathname, shared, basic, advanced])

  // Placeholders for what is still loading, minus anything that has landed: the
  // holdings arrive one render before `restoring` clears.
  const restoringSymbols = useMemo(() => {
    if (!restoring) return NO_SYMBOLS
    const arrived = new Set(advanced.holdings.map((holding) => holding.symbol))
    return (link.holdings ?? [])
      .map((holding) => holding.symbol)
      .filter((symbol) => !arrived.has(symbol))
  }, [restoring, link, advanced.holdings])

  const value = useMemo<CalculatorStateValue>(
    () => ({
      shared,
      setShared: (key, next) =>
        setSharedEdit((previous) => ({ ...(previous ?? fromLink.shared), [key]: next })),
      basic,
      setBasic: (key, next) =>
        setBasicEdit((previous) => ({ ...(previous ?? fromLink.basic), [key]: next })),
      // A preset moves both numbers at once; two setState calls would render an
      // inconsistent pair in between.
      setRateAndVariance: (rate, variance) =>
        setBasicEdit((previous) => ({ ...(previous ?? fromLink.basic), rate, variance })),
      advanced,
      setAdvanced: (key, next) =>
        setAdvancedEdit((previous) => ({ ...(previous ?? fromLink.advanced), [key]: next })),
      updateHoldings: (update) =>
        setAdvancedEdit((previous) => {
          const base = previous ?? fromLink.advanced
          return { ...base, holdings: update(base.holdings) }
        }),
      restoringSymbols,
    }),
    [shared, basic, advanced, fromLink, restoringSymbols]
  )

  return (
    <CalculatorStateContext.Provider value={value}>{children}</CalculatorStateContext.Provider>
  )
}

/**
 * Rebuild a shared portfolio from tickers and weights.
 *
 * A symbol the index no longer carries, or a price file that fails to load, is
 * dropped rather than failing the whole link — the builder then shows a total
 * short of 100%, which says more than an empty portfolio would.
 */
async function restoreHoldings(wanted: ShareHolding[]): Promise<PortfolioHolding[]> {
  let entries: SymbolEntry[]
  try {
    entries = (await loadSymbols()).symbols
  } catch {
    return []
  }

  const bySymbol = new Map(entries.map((entry) => [entry.symbol.toUpperCase(), entry]))
  const found = wanted
    .map((holding) => ({ entry: bySymbol.get(holding.symbol), weight: holding.weight }))
    .filter((match): match is { entry: SymbolEntry; weight: number } => match.entry !== undefined)

  const histories = await Promise.allSettled(found.map((match) => loadHistory(match.entry)))

  const holdings: PortfolioHolding[] = []
  histories.forEach((outcome, index) => {
    if (outcome.status !== 'fulfilled') return
    const history = outcome.value
    holdings.push({
      symbol: history.symbol,
      name: history.name,
      currency: history.currency,
      weight: found[index].weight,
      points: history.points,
      firstMonth: history.points[0]?.month ?? '',
      adjustedAvailable: history.adjustedAvailable !== false,
    })
  })
  return holdings
}
