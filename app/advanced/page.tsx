'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DeltaCards } from '@/components/DeltaCards'
import { PortfolioBuilder, type PortfolioHolding } from '@/components/PortfolioBuilder'
import { ResultChart, type ChartDatum } from '@/components/ResultChart'
import { YearTable, type YearRow } from '@/components/YearTable'
import { Callout, Card, Field, NumberInput, Select, Toggle } from '@/components/ui'
import { backtest, type BankConfigInput } from '@/lib/backtest'
import { loadHistory, loadRates, type SymbolEntry } from '@/lib/marketData'
import { useCalculatorState } from '@/components/CalculatorState'
import { useI18n } from '@/components/LocaleProvider'
import { backtestErrorMessage, loadErrorMessage } from '@/lib/i18n/messages'
import { CONTRIBUTION_FREQUENCIES } from '@/lib/projection'

function monthsAgo(count: number): string {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function AdvancedModePage() {
  const { shared, setShared, advanced, setAdvanced, updateHoldings } = useCalculatorState()
  const { t, f } = useI18n()
  const contributionOptions = CONTRIBUTION_FREQUENCIES.map((value) => ({
    value,
    label: t.frequency.contribution[value],
  }))
  const { holdings, startMonth, useHistoricalRates, reinvestDividends } = advanced
  const { initial, contribution, contributionFrequency, bankRate } = shared

  const [pending, setPending] = useState<string[]>([])
  const [loadError, setLoadError] = useState<unknown>(null)
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
        setLoadError(error)
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
      label: f.month(point.month),
      main: point.portfolio,
      bank: point.bank,
      paidIn: point.contributed,
    }))
  }, [result, f])

  const tableRows: YearRow[] = useMemo(() => {
    if (!result?.ok) return []
    return result.yearlyPoints.map((point) => ({
      label: f.month(point.month),
      paidIn: point.contributed,
      main: point.portfolio,
      bank: point.bank,
    }))
  }, [result, f])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.advanced.title}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {t.advanced.intro}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card title={t.advanced.portfolioTitle} description={t.advanced.portfolioHint}>
            <PortfolioBuilder
              holdings={holdings}
              pending={pending}
              onAdd={addHolding}
              onRemove={removeHolding}
              onWeightChange={setWeight}
              onEvenSplit={evenSplit}
            />
            {loadError !== null && (
              <div className="mt-3">
                <Callout tone="error">{loadErrorMessage(t, loadError)}</Callout>
              </div>
            )}
          </Card>

          <Card title={t.advanced.yourMoney}>
            <div className="space-y-3">
              <Field label={t.advanced.startingFrom}>
                <input
                  type="month"
                  className="field"
                  value={startMonth}
                  max={monthsAgo(1)}
                  onChange={(event) => setAdvanced('startMonth', event.target.value)}
                  aria-label={t.advanced.aria.startMonth}
                />
              </Field>
              <Field label={t.basic.initial}>
                <NumberInput
                  value={initial}
                  onChange={(next) => setShared('initial', next)}
                  prefix="€"
                  min={0}
                  ariaLabel={t.basic.aria.initial}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.basic.contribution}>
                  <NumberInput
                    value={contribution}
                    onChange={(next) => setShared('contribution', next)}
                    prefix="€"
                    min={0}
                    ariaLabel={t.basic.aria.contribution}
                  />
                </Field>
                <Field label={t.basic.howOften}>
                  <Select
                    value={contributionFrequency}
                    onChange={(next) => setShared('contributionFrequency', next)}
                    options={contributionOptions}
                    ariaLabel={t.basic.aria.contributionFrequency}
                  />
                </Field>
              </div>
              <Toggle
                checked={reinvestDividends && dividendsAvailable}
                onChange={(next) => setAdvanced('reinvestDividends', next)}
                disabled={!dividendsAvailable}
                label={t.advanced.reinvest}
                hint={
                  dividendsAvailable
                    ? t.advanced.reinvestHint
                    : t.advanced.reinvestUnavailable(withoutAdjusted.join(', '))
                }
              />
            </div>
          </Card>

          <Card title={t.basic.bankTitle}>
            <div className="space-y-3">
              <Field label={t.basic.savingsRate}>
                <NumberInput
                  value={Math.round(bankRate * 100 * 1000) / 1000}
                  onChange={(value) => setShared('bankRate', value / 100)}
                  suffix="%"
                  step={0.1}
                  min={0}
                  ariaLabel={t.basic.aria.bankRate}
                />
              </Field>
              <Toggle
                checked={useHistoricalRates}
                onChange={(next) => setAdvanced('useHistoricalRates', next)}
                label={t.advanced.historicalRates}
                hint={
                  ecbRates
                    ? t.advanced.historicalRatesHint
                    : t.advanced.historicalRatesUnavailable
                }
              />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          {!result && (
            <Card>
              <div className="py-12 text-center">
                <p className="text-sm font-medium">{t.advanced.emptyTitle}</p>
                <p className="mx-auto mt-2 max-w-sm text-xs text-ink-secondary">
                  {t.advanced.emptyHintBefore} <code className="tabular">VWCE.DE</code>{' '}
                  {t.advanced.emptyHintWorld} <code className="tabular">SWDA.MI</code>{' '}
                  {t.advanced.emptyHintMilan} <code className="tabular">AAPL</code>.
                </p>
              </div>
            </Card>
          )}

          {result && !result.ok && (
            <Callout tone="error">{backtestErrorMessage(t, f, result.error)}</Callout>
          )}

          {result?.ok && (
            <>
              <DeltaCards
                currency={result.currency}
                invested={result.finalValue}
                bank={result.finalBank}
                paidIn={result.totalContributed}
                investedLabel={t.advanced.portfolioToday}
                bankLabel={
                  useHistoricalRates
                    ? t.advanced.inTheBankAtEcb
                    : t.advanced.inTheBankAt(f.percent(bankRate, 2))
                }
              />

              {result.clampedBy && (
                <Callout>
                  {t.advanced.clamped(
                    result.clampedBy.symbol,
                    f.month(result.clampedBy.firstMonth),
                    f.month(startMonth)
                  )}
                </Callout>
              )}

              <Card>
                <ResultChart
                  data={chartData}
                  currency={result.currency}
                  mainLabel={t.advanced.portfolioToday}
                  bankLabel={t.advanced.inTheBank}
                  showBand={false}
                />
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label={t.advanced.yourReturn}
                  value={f.percent(result.annualisedReturn)}
                  note={t.advanced.yourReturnNote}
                />
                <Metric
                  label={t.advanced.holdingsReturn}
                  value={f.percent(result.indexCagr)}
                  note={t.advanced.holdingsReturnNote}
                />
                <Metric
                  label={t.advanced.worstFall}
                  value={f.percent(result.maxDrawdown)}
                  note={t.advanced.worstFallNote}
                />
              </div>

              <Card title={t.advanced.whereMoneyEnded}>
                <ul className="space-y-1.5 text-xs">
                  {result.unitsBought.map((holding) => (
                    <li key={holding.symbol} className="flex items-baseline justify-between gap-3">
                      <span className="tabular font-medium">{holding.symbol}</span>
                      <span className="tabular text-ink-secondary">
                        {t.advanced.unitsLine(
                          f.decimal(holding.units, 3),
                          f.percent(holding.finalWeight, 1)
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-ink-muted">
                  {t.advanced.driftNote(result.currency)}
                </p>
              </Card>

              <Card
                title={t.advanced.yearByYear(
                  f.month(result.effectiveStart),
                  f.month(result.endMonth)
                )}
              >
                <YearTable
                  rows={tableRows}
                  currency={result.currency}
                  mainLabel={t.advanced.portfolio}
                  bankLabel={t.advanced.inTheBank}
                  showBand={false}
                  periodLabel={t.table.date}
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
