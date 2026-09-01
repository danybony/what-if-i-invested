'use client'

import { SymbolSearch } from '@/components/SymbolSearch'
import { NumberInput } from '@/components/ui'
import { useI18n } from '@/components/LocaleProvider'
import type { PricePoint } from '@/lib/backtest'
import type { SymbolEntry } from '@/lib/marketData'

export type PortfolioHolding = {
  symbol: string
  name: string
  currency: string
  /** Weight in percent, 0..100 — converted to a decimal for the backtest. */
  weight: number
  points: PricePoint[]
  /** Earliest month with a price, used to explain a clamped start date. */
  firstMonth: string
  /** False when the provider gave no dividend record, so adjclose == close. */
  adjustedAvailable: boolean
}

export function PortfolioBuilder({
  holdings,
  pending,
  onAdd,
  onRemove,
  onWeightChange,
  onEvenSplit,
}: {
  holdings: PortfolioHolding[]
  pending: string[]
  onAdd: (entry: SymbolEntry) => void
  onRemove: (symbol: string) => void
  onWeightChange: (symbol: string, weight: number) => void
  onEvenSplit: () => void
}) {
  const { t, f } = useI18n()
  const totalWeight = holdings.reduce((sum, holding) => sum + holding.weight, 0)
  const weightsOff = holdings.length > 0 && Math.abs(totalWeight - 100) > 0.05

  return (
    <div className="space-y-3">
      <SymbolSearch onSelect={onAdd} />

      {holdings.length === 0 && pending.length === 0 && (
        <p className="text-xs text-ink-muted">{t.portfolio.empty}</p>
      )}

      {(holdings.length > 0 || pending.length > 0) && (
        <ul className="space-y-1.5">
          {holdings.map((holding) => (
            <li
              key={holding.symbol}
              className="flex items-center gap-2 rounded-lg border border-hairline bg-sunken px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="tabular text-xs font-semibold">{holding.symbol}</span>
                  <span className="rounded bg-surface px-1 text-[10px] text-ink-muted">
                    {holding.currency}
                  </span>
                </div>
                <p className="truncate text-[11px] text-ink-secondary">{holding.name}</p>
                <p className="text-[10px] text-ink-muted">
                  {t.portfolio.historyFrom(f.month(holding.firstMonth))}
                </p>
              </div>
              <div className="w-24 shrink-0">
                <NumberInput
                  value={holding.weight}
                  onChange={(value) => onWeightChange(holding.symbol, value)}
                  suffix="%"
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel={t.portfolio.weightAria(holding.symbol)}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemove(holding.symbol)}
                aria-label={t.portfolio.removeAria(holding.symbol)}
                className="shrink-0 rounded-md px-1.5 py-1 text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </li>
          ))}
          {pending.map((symbol) => (
            <li
              key={symbol}
              className="flex items-center gap-2 rounded-lg border border-hairline bg-sunken px-2.5 py-2 text-xs text-ink-muted"
            >
              <span className="tabular font-semibold">{symbol}</span>
              <span>{t.portfolio.loading}</span>
            </li>
          ))}
        </ul>
      )}

      {holdings.length > 0 && (
        <div className="flex items-center justify-between text-[11px]">
          <span className={weightsOff ? 'text-ink' : 'text-ink-muted'}>
            {t.portfolio.total}{' '}
            <strong className="tabular font-semibold">{f.percent(totalWeight / 100, 1)}</strong>
            {weightsOff && t.portfolio.needs100}
          </span>
          <button
            type="button"
            onClick={onEvenSplit}
            className="text-invest underline underline-offset-2 hover:no-underline"
          >
            {t.portfolio.splitEvenly}
          </button>
        </div>
      )}
    </div>
  )
}
