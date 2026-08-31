'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeltaCards } from '@/components/DeltaCards'
import { ResultChart, type ChartDatum } from '@/components/ResultChart'
import { YearTable, type YearRow } from '@/components/YearTable'
import { Callout, Card, Field, NumberInput, Select } from '@/components/ui'
import { CURRENCIES, formatPercent } from '@/lib/format'
import { loadRates } from '@/lib/marketData'
import { DEFAULT_BASIC_FORM, RATE_PRESETS, type BasicFormState } from '@/lib/presets'
import {
  COMPOUND_LABELS,
  CONTRIBUTION_LABELS,
  project,
  type CompoundFrequency,
  type ContributionFrequency,
} from '@/lib/projection'

const compoundOptions = (Object.keys(COMPOUND_LABELS) as CompoundFrequency[]).map((value) => ({
  value,
  label: COMPOUND_LABELS[value],
}))

const contributionOptions = (Object.keys(CONTRIBUTION_LABELS) as ContributionFrequency[]).map(
  (value) => ({ value, label: CONTRIBUTION_LABELS[value] })
)

export default function BasicModePage() {
  const [form, setForm] = useState<BasicFormState>(DEFAULT_BASIC_FORM)
  const [ecbRate, setEcbRate] = useState<{ month: string; rate: number } | null>(null)

  const update = <K extends keyof BasicFormState>(key: K, value: BasicFormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }))

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
        initial: form.initial,
        contribution: form.contribution,
        contributionFrequency: form.contributionFrequency,
        years: form.years,
        rate: form.rate,
        variance: form.variance,
        compoundFrequency: form.compoundFrequency,
        bank: { mode: 'fixed', rate: form.bankRate },
      }),
    [form]
  )

  const chartData: ChartDatum[] = useMemo(
    () =>
      result.points.map((point) => ({
        x: point.year,
        label: point.monthIndex === 0 ? 'Today' : `Year ${(point.monthIndex / 12).toFixed(1)}`,
        main: point.average,
        low: point.worst,
        high: point.best,
        bank: point.bank,
        paidIn: point.contributed,
      })),
    [result]
  )

  const tableRows: YearRow[] = useMemo(
    () =>
      result.yearlyPoints.map((point) => ({
        label: point.monthIndex === 0 ? 'Start' : `Year ${point.monthIndex / 12}`,
        paidIn: point.contributed,
        main: point.average,
        low: point.worst,
        high: point.best,
        bank: point.bank,
      })),
    [result]
  )

  const showBand = form.variance > 0
  const activePreset = RATE_PRESETS.find(
    (preset) => preset.rate === form.rate && preset.variance === form.variance
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What if you invested it instead?
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          Compound interest on one side, your bank account on the other. The number that matters is
          the space between them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card title="Your money">
            <div className="space-y-3">
              <Field label="Initial investment">
                <NumberInput
                  value={form.initial}
                  onChange={(value) => update('initial', value)}
                  prefix="€"
                  min={0}
                  ariaLabel="Initial investment"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contribution">
                  <NumberInput
                    value={form.contribution}
                    onChange={(value) => update('contribution', value)}
                    prefix="€"
                    min={0}
                    ariaLabel="Recurring contribution"
                  />
                </Field>
                <Field label="How often">
                  <Select
                    value={form.contributionFrequency}
                    onChange={(value) => update('contributionFrequency', value)}
                    options={contributionOptions}
                    ariaLabel="Contribution frequency"
                  />
                </Field>
              </div>
              <Field label="Length of time" hint="Contributions are added at the end of each period.">
                <NumberInput
                  value={form.years}
                  onChange={(value) => update('years', Math.max(1, Math.min(60, value)))}
                  suffix="yrs"
                  min={1}
                  max={60}
                  ariaLabel="Length of time in years"
                />
              </Field>
              <Field label="Currency">
                <Select
                  value={form.currency}
                  onChange={(value) => update('currency', value)}
                  options={CURRENCIES.map((code) => ({ value: code, label: code }))}
                  ariaLabel="Currency"
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Expected return"
            description="Start from an asset class, then adjust either number."
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {RATE_PRESETS.map((preset) => {
                  const isActive = activePreset?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      title={preset.note}
                      onClick={() =>
                        setForm((previous) => ({
                          ...previous,
                          rate: preset.rate,
                          variance: preset.variance,
                        }))
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                        isActive
                          ? 'border-transparent bg-invest text-white'
                          : 'border-hairline text-ink-secondary hover:text-ink'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Estimated interest rate">
                  <NumberInput
                    value={round(form.rate * 100)}
                    onChange={(value) => update('rate', value / 100)}
                    suffix="%"
                    step={0.1}
                    ariaLabel="Estimated interest rate"
                  />
                </Field>
                <Field label="Variance range">
                  <NumberInput
                    value={round(form.variance * 100)}
                    onChange={(value) => update('variance', Math.max(0, value) / 100)}
                    prefix="±"
                    suffix="%"
                    step={0.1}
                    min={0}
                    ariaLabel="Interest rate variance range"
                  />
                </Field>
              </div>

              <p className="text-[11px] leading-snug text-ink-muted">
                {showBand ? (
                  <>
                    Best and worst cases are run at {formatPercent(result.rates.best)} and{' '}
                    {formatPercent(result.rates.worst)}.
                  </>
                ) : (
                  <>Set a variance range to see a best and worst case.</>
                )}
              </p>

              <Field label="Compound frequency">
                <Select
                  value={form.compoundFrequency}
                  onChange={(value) => update('compoundFrequency', value)}
                  options={compoundOptions}
                  ariaLabel="Compound frequency"
                />
              </Field>
            </div>
          </Card>

          <Card
            title="If you left it in the bank"
            description="The comparison line. Most euro-area current accounts pay nothing at all."
          >
            <Field label="Savings rate">
              <NumberInput
                value={round(form.bankRate * 100)}
                onChange={(value) => update('bankRate', value / 100)}
                suffix="%"
                step={0.1}
                min={0}
                ariaLabel="Bank savings rate"
              />
            </Field>
            {ecbRate && (
              <button
                type="button"
                onClick={() => update('bankRate', ecbRate.rate)}
                className="mt-2 text-[11px] text-invest underline underline-offset-2 hover:no-underline"
              >
                Use the current euro-area deposit rate ({formatPercent(ecbRate.rate, 2)})
              </button>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <DeltaCards
            currency={form.currency}
            invested={result.finalAverage}
            bank={result.finalBank}
            paidIn={result.totalContributed}
            investedLabel={`Invested at ${formatPercent(form.rate)}`}
            bankLabel={`In the bank at ${formatPercent(form.bankRate, 2)}`}
            gapRange={
              showBand ? { worst: result.gapWorst, best: result.gapBest } : undefined
            }
          />

          <Card>
            <ResultChart
              data={chartData}
              currency={form.currency}
              mainLabel={`Invested at ${formatPercent(form.rate)}`}
              bankLabel="In the bank"
              showBand={showBand}
            />
          </Card>

          {form.bankRate === 0 && (
            <Callout>
              With a 0% savings rate the bank line is simply the money you paid in — every euro of
              the difference is compounding you did not get.
            </Callout>
          )}

          <Card title="Year by year">
            <YearTable
              rows={tableRows}
              currency={form.currency}
              mainLabel="Invested"
              bankLabel="In the bank"
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
