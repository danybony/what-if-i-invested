'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DeltaCards } from '@/components/DeltaCards'
import { PortfolioBuilder, type PortfolioHolding } from '@/components/PortfolioBuilder'
import { ResultChart, type ChartDatum } from '@/components/ResultChart'
import { YearTable, type YearRow } from '@/components/YearTable'
import { Callout, Card, Field, NumberInput, Select, Toggle } from '@/components/ui'
import { backtest, type BankConfigInput } from '@/lib/backtest'
import { formatMonth, formatPercent } from '@/lib/format'
import { loadHistory, loadRates, type SymbolEntry } from '@/lib/marketData'
import { useCalculatorState } from '@/components/CalculatorState'
import { CONTRIBUTION_LABELS, type ContributionFrequency } from '@/lib/projection'

const contributionOptions = (Object.keys(CONTRIBUTION_LABELS) as ContributionFrequency[]).map(
  (value) => ({ value, label: CONTRIBUTION_LABELS[value] })
)

function monthsAgo(count: number): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AdvancedModePage() {
  const { shared, setShared, advanced, setAdvanced, updateHoldings } = useCalculatorState()
  const { holdings, startMonth, useHistoricalRates, reinvestDividends } = advanced
  const { initial, contribution, contributionFrequency, bankRate } = shared

  const [pending, setPending] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ecbRates, setEcbRates] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadRates()
      .then((data) => {
        if (!cancelled) setEcbRates(data.monthlyRates)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const addHolding = useCallback(
    async (entry: SymbolEntry) => {
      const symbol = entry.symbol.toUpperCase()
      if (holdings.some((holding) => holding.symbol === symbol) || pending.includes(symbol)) return

      setLoadError(null)
      setPending((previous) => [...previous, symbol])
      try {
        const history = await loadHistory(entry)

        updateHoldings((previous) => {
          const next: PortfolioHolding[] = [
            ...previous,
            {
              symbol: history.symbol,
              name: history.name,
              currency: history.currency,
              weight: 0,
              points: history.points,
              firstMonth: history.points[0]?.month ?? '',
              adjustedAvailable: history.adjustedAvailable !== false,
            },
          ]
          // A fresh holding with no weight is useless, so rebalance evenly.
          const even = Math.round((100 / next.length) * 10) / 10
          return next.map((holding, index) => ({
            ...holding,
            weight: index === next.length - 1 ? 100 - even * (next.length - 1) : even,
          }))
        })
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Could not load price history.')
      } finally {
        setPending((previous) => previous.filter((item) => item !== symbol))
      }
    },
    [holdings, pending, updateHoldings]
  )

  const removeHolding = (symbol: string) =>
    updateHoldings((previous) => previous.filter((holding) => holding.symbol !== symbol))

  const setWeight = (symbol: string, weight: number) =>
    updateHoldings((previous) =>
      previous.map((holding) => (holding.symbol === symbol ? { ...holding, weight } : holding))
    )

  const evenSplit = () =>
    updateHoldings((previous) => {
      const even = Math.round((100 / previous.length) * 10) / 10
      return previous.map((holding, index) => ({
        ...holding,
        weight: index === previous.length - 1 ? 100 - even * (previous.length - 1) : even,
      }))
    })

  // Claiming a dividend adjustment we do not have would overstate the result,
  // so the toggle is only offered when every holding can honour it.
  const withoutAdjusted = holdings
    .filter((holding) => !holding.adjustedAvailable)
    .map((holding) => holding.symbol)
  const dividendsAvailable = holdings.length > 0 && withoutAdjusted.length === 0

  const bank: BankConfigInput = useMemo(
    () =>
      useHistoricalRates && ecbRates
        ? { mode: 'historical', monthlyRates: ecbRates, fallbackRate: bankRate }
        : { mode: 'fixed', rate: bankRate },
    [useHistoricalRates, ecbRates, bankRate]
  )

  const result = useMemo(() => {
    if (holdings.length === 0) return null
    return backtest({
      holdings: holdings.map((holding) => ({
        symbol: holding.symbol,
        name: holding.name,
        currency: holding.currency,
        weight: holding.weight / 100,
        points: holding.points,
      })),
      initial,
      contribution,
      contributionFrequency,
      startMonth,
      bank,
      reinvestDividends: reinvestDividends && dividendsAvailable,
    })
  }, [
    holdings,
    initial,
    contribution,
    contributionFrequency,
    startMonth,
    bank,
    reinvestDividends,
    dividendsAvailable,
  ])

  const chartData: ChartDatum[] = useMemo(() => {
    if (!result?.ok) return []
    return result.points.map((point) => ({
      x: point.year,
      label: formatMonth(point.month),
      main: point.portfolio,
      bank: point.bank,
      paidIn: point.contributed,
    }))
  }, [result])

  const tableRows: YearRow[] = useMemo(() => {
    if (!result?.ok) return []
    return result.yearlyPoints.map((point) => ({
      label: formatMonth(point.month),
      paidIn: point.contributed,
      main: point.portfolio,
      bank: point.bank,
    }))
  }, [result])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What if you had actually bought it?
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Build a portfolio of real funds and shares, pick a start date, and see what those exact
          holdings would have done with your money — against the same money left in the bank.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card title="Your portfolio" description="Weights must add up to 100%.">
            <PortfolioBuilder
              holdings={holdings}
              pending={pending}
              onAdd={addHolding}
              onRemove={removeHolding}
              onWeightChange={setWeight}
              onEvenSplit={evenSplit}
            />
            {loadError && (
              <div className="mt-3">
                <Callout tone="error">{loadError}</Callout>
              </div>
            )}
          </Card>

          <Card title="Your money">
            <div className="space-y-3">
              <Field label="Starting from">
                <input
                  type="month"
                  className="field"
                  value={startMonth}
                  max={monthsAgo(1)}
                  onChange={(event) => setAdvanced('startMonth', event.target.value)}
                  aria-label="Start month"
                />
              </Field>
              <Field label="Initial investment">
                <NumberInput
                  value={initial}
                  onChange={(next) => setShared('initial', next)}
                  prefix="€"
                  min={0}
                  ariaLabel="Initial investment"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contribution">
                  <NumberInput
                    value={contribution}
                    onChange={(next) => setShared('contribution', next)}
                    prefix="€"
                    min={0}
                    ariaLabel="Recurring contribution"
                  />
                </Field>
                <Field label="How often">
                  <Select
                    value={contributionFrequency}
                    onChange={(next) => setShared('contributionFrequency', next)}
                    options={contributionOptions}
                    ariaLabel="Contribution frequency"
                  />
                </Field>
              </div>
              <Toggle
                checked={reinvestDividends && dividendsAvailable}
                onChange={(next) => setAdvanced('reinvestDividends', next)}
                disabled={!dividendsAvailable}
                label="Reinvest dividends"
                hint={
                  dividendsAvailable
                    ? 'Off means price return only. On uses adjusted closes, so payouts are bought back in — the fair comparison for a distributing fund.'
                    : `No dividend data is published for ${withoutAdjusted.join(', ')}, so only price return can be shown for this portfolio.`
                }
              />
            </div>
          </Card>

          <Card title="If you left it in the bank">
            <div className="space-y-3">
              <Field label="Savings rate">
                <NumberInput
                  value={Math.round(bankRate * 100 * 1000) / 1000}
                  onChange={(value) => setShared('bankRate', value / 100)}
                  suffix="%"
                  step={0.1}
                  min={0}
                  ariaLabel="Bank savings rate"
                />
              </Field>
              <Toggle
                checked={useHistoricalRates}
                onChange={(next) => setAdvanced('useHistoricalRates', next)}
                label="Use real historical ECB rates"
                hint={
                  ecbRates
                    ? 'Applies the euro-area household deposit rate for each month of the backtest.'
                    : 'ECB rates are unavailable right now.'
                }
              />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {!result && (
            <Card>
              <div className="py-12 text-center">
                <p className="text-sm font-medium">Add a holding to run the backtest</p>
                <p className="mx-auto mt-2 max-w-sm text-xs text-ink-secondary">
                  Try <code className="tabular">VWCE.DE</code> for a world tracker,{' '}
                  <code className="tabular">SWDA.MI</code> on Borsa Italiana, or a single share like{' '}
                  <code className="tabular">AAPL</code>.
                </p>
              </div>
            </Card>
          )}

          {result && !result.ok && (
            <Callout tone="error">{result.error.message}</Callout>
          )}

          {result?.ok && (
            <>
              <DeltaCards
                currency={result.currency}
                invested={result.finalValue}
                bank={result.finalBank}
                paidIn={result.totalContributed}
                investedLabel="Your portfolio today"
                bankLabel={
                  useHistoricalRates ? 'In the bank at ECB rates' : `In the bank at ${formatPercent(bankRate, 2)}`
                }
              />

              {result.clampedBy && (
                <Callout>
                  {result.clampedBy.symbol} only has prices from{' '}
                  {formatMonth(result.clampedBy.firstMonth)}, so the backtest starts there rather
                  than {formatMonth(startMonth)}.
                </Callout>
              )}

              <Card>
                <ResultChart
                  data={chartData}
                  currency={result.currency}
                  mainLabel="Your portfolio"
                  bankLabel="In the bank"
                  showBand={false}
                />
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Your annual return"
                  value={formatPercent(result.annualisedReturn)}
                  note="Money-weighted, so it accounts for when you paid in."
                />
                <Metric
                  label="The holdings' own return"
                  value={formatPercent(result.indexCagr)}
                  note="Annualised, ignoring contribution timing."
                />
                <Metric
                  label="Worst fall along the way"
                  value={formatPercent(result.maxDrawdown)}
                  note="Deepest peak-to-trough drop you would have sat through."
                />
              </div>

              <Card title="Where the money ended up">
                <ul className="space-y-1.5 text-xs">
                  {result.unitsBought.map((holding) => (
                    <li key={holding.symbol} className="flex items-baseline justify-between gap-3">
                      <span className="tabular font-medium">{holding.symbol}</span>
                      <span className="tabular text-ink-secondary">
                        {holding.units.toFixed(3)} units ·{' '}
                        {formatPercent(holding.finalWeight, 1)} of the portfolio
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-ink-muted">
                  Weights drift as prices move — there is no rebalancing, and no currency
                  conversion, so every holding trades in {result.currency}.
                </p>
              </Card>

              <Card title={`Year by year — ${formatMonth(result.effectiveStart)} to ${formatMonth(result.endMonth)}`}>
                <YearTable
                  rows={tableRows}
                  currency={result.currency}
                  mainLabel="Portfolio"
                  bankLabel="In the bank"
                  showBand={false}
                  periodLabel="Date"
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{note}</p>
    </div>
  )
}
