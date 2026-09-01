'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeltaCards } from '@/components/DeltaCards'
import { ResultChart, type ChartDatum } from '@/components/ResultChart'
import { YearTable, type YearRow } from '@/components/YearTable'
import { Callout, Card, Field, NumberInput, Select } from '@/components/ui'
import { CURRENCIES } from '@/lib/format'
import { useCalculatorState } from '@/components/CalculatorState'
import { useI18n } from '@/components/LocaleProvider'
import { loadRates } from '@/lib/marketData'
import { RATE_PRESETS } from '@/lib/presets'
import { COMPOUND_FREQUENCIES, CONTRIBUTION_FREQUENCIES, project } from '@/lib/projection'

export default function BasicModePage() {
  const { shared, setShared, basic, setBasic, setRateAndVariance } = useCalculatorState()
  const { t, f } = useI18n()
  const [ecbRate, setEcbRate] = useState<{ month: string; rate: number } | null>(null)

  const compoundOptions = COMPOUND_FREQUENCIES.map((value) => ({
    value,
    label: t.frequency.compound[value],
  }))
  const contributionOptions = CONTRIBUTION_FREQUENCIES.map((value) => ({
    value,
    label: t.frequency.contribution[value],
  }))

  // Offered as a one-click fill, not applied automatically — the default stays
  // 0%, which is what most euro-area current accounts actually pay.
  useEffect(() => {
    let cancelled = false
    loadRates()
      .then((data) => {
        if (!cancelled && data.latest) setEcbRate(data.latest)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const result = useMemo(
    () =>
      project({
        initial: shared.initial,
        contribution: shared.contribution,
        contributionFrequency: shared.contributionFrequency,
        years: basic.years,
        rate: basic.rate,
        variance: basic.variance,
        compoundFrequency: basic.compoundFrequency,
        bank: { mode: 'fixed', rate: shared.bankRate },
      }),
    [shared, basic]
  )

  const chartData: ChartDatum[] = useMemo(
    () =>
      result.points.map((point) => ({
        x: point.year,
        label:
          point.monthIndex === 0
            ? t.table.today
            : t.table.yearN(f.decimal(point.monthIndex / 12, 1)),
        main: point.average,
        low: point.worst,
        high: point.best,
        bank: point.bank,
        paidIn: point.contributed,
      })),
    [result, t, f]
  )

  const tableRows: YearRow[] = useMemo(
    () =>
      result.yearlyPoints.map((point) => ({
        label:
          point.monthIndex === 0 ? t.table.start : t.table.yearN(String(point.monthIndex / 12)),
        paidIn: point.contributed,
        main: point.average,
        low: point.worst,
        high: point.best,
        bank: point.bank,
      })),
    [result, t]
  )

  const showBand = basic.variance > 0
  const activePreset = RATE_PRESETS.find(
    (preset) => preset.rate === basic.rate && preset.variance === basic.variance
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t.basic.title}
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {t.basic.intro}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card title={t.basic.yourMoney}>
            <div className="space-y-3">
              <Field label={t.basic.initial}>
                <NumberInput
                  value={shared.initial}
                  onChange={(value) => setShared('initial', value)}
                  prefix="€"
                  min={0}
                  ariaLabel={t.basic.aria.initial}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.basic.contribution}>
                  <NumberInput
                    value={shared.contribution}
                    onChange={(value) => setShared('contribution', value)}
                    prefix="€"
                    min={0}
                    ariaLabel={t.basic.aria.contribution}
                  />
                </Field>
                <Field label={t.basic.howOften}>
                  <Select
                    value={shared.contributionFrequency}
                    onChange={(value) => setShared('contributionFrequency', value)}
                    options={contributionOptions}
                    ariaLabel={t.basic.aria.contributionFrequency}
                  />
                </Field>
              </div>
              <Field label={t.basic.lengthOfTime} hint={t.basic.lengthHint}>
                <NumberInput
                  value={basic.years}
                  onChange={(value) => setBasic('years', Math.max(1, Math.min(60, value)))}
                  suffix={t.basic.years}
                  min={1}
                  max={60}
                  ariaLabel={t.basic.aria.years}
                />
              </Field>
              <Field label={t.basic.currency}>
                <Select
                  value={basic.currency}
                  onChange={(value) => setBasic('currency', value)}
                  options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                  ariaLabel={t.basic.aria.currency}
                />
              </Field>
            </div>
          </Card>

          <Card
            title={t.basic.expectedReturn}
            description={t.basic.expectedReturnHint}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {RATE_PRESETS.map((preset) => {
                  const isActive = activePreset?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={t.presets[preset.id].note}
                      onClick={() => setRateAndVariance(preset.rate, preset.variance)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        isActive
                          ? 'border-transparent bg-invest text-white'
                          : 'border-hairline text-ink-secondary hover:text-ink'
                      }`}
                    >
                      {t.presets[preset.id].label}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t.basic.rate}>
                  <NumberInput
                    value={round(basic.rate * 100)}
                    onChange={(value) => setBasic('rate', value / 100)}
                    suffix="%"
                    step={0.1}
                    ariaLabel={t.basic.aria.rate}
                  />
                </Field>
                <Field label={t.basic.variance}>
                  <NumberInput
                    value={round(basic.variance * 100)}
                    onChange={(value) => setBasic('variance', Math.max(0, value) / 100)}
                    prefix="±"
                    suffix="%"
                    step={0.1}
                    min={0}
                    ariaLabel={t.basic.aria.variance}
                  />
                </Field>
              </div>

              <p className="text-[11px] leading-snug text-ink-muted">
                {showBand
                  ? t.basic.bandNote(
                      f.percent(result.rates.best),
                      f.percent(result.rates.worst)
                    )
                  : t.basic.noBandNote}
              </p>

              <Field label={t.basic.compoundFrequency}>
                <Select
                  value={basic.compoundFrequency}
                  onChange={(value) => setBasic('compoundFrequency', value)}
                  options={compoundOptions}
                  ariaLabel={t.basic.aria.compoundFrequency}
                />
              </Field>
            </div>
          </Card>

          <Card
            title={t.basic.bankTitle}
            description={t.basic.bankHint}
          >
            <Field label={t.basic.savingsRate}>
              <NumberInput
                value={round(shared.bankRate * 100)}
                onChange={(value) => setShared('bankRate', value / 100)}
                suffix="%"
                step={0.1}
                min={0}
                ariaLabel={t.basic.aria.bankRate}
              />
            </Field>
            {ecbRate && (
              <button
                type="button"
                onClick={() => setShared('bankRate', ecbRate.rate)}
                className="mt-2 text-[11px] text-invest underline underline-offset-2 hover:no-underline"
              >
                {t.basic.useEcbRate(f.percent(ecbRate.rate, 2))}
              </button>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <DeltaCards
            currency={basic.currency}
            invested={result.finalAverage}
            bank={result.finalBank}
            paidIn={result.totalContributed}
            investedLabel={t.basic.investedAt(f.percent(basic.rate))}
            bankLabel={t.basic.inTheBankAt(f.percent(shared.bankRate, 2))}
            gapRange={
              showBand ? { worst: result.gapWorst, best: result.gapBest } : undefined
            }
          />

          <Card>
            <ResultChart
              data={chartData}
              currency={basic.currency}
              mainLabel={t.basic.investedAt(f.percent(basic.rate))}
              bankLabel={t.basic.inTheBank}
              showBand={showBand}
            />
          </Card>

          {shared.bankRate === 0 && (
            <Callout>
              {t.basic.zeroRateNote}
            </Callout>
          )}

          <Card title={t.basic.yearByYear}>
            <YearTable
              rows={tableRows}
              currency={basic.currency}
              mainLabel={t.basic.invested}
              bankLabel={t.basic.inTheBank}
              showBand={showBand}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Keep float noise (7.000000000000001) out of the rate inputs. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
