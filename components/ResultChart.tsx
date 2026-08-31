'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCompact, formatCurrency } from '@/lib/format'

/**
 * One chart serves both modes. Investing is a single entity drawn as a
 * worst→best band with its central case as the solid line; the bank is the
 * second entity; money paid in is a neutral reference. Colours come from the
 * validated tokens in globals.css, so the chart follows the theme.
 */
export type ChartDatum = {
  /** Years elapsed — the x scale. */
  x: number
  /** Human label for the tooltip, e.g. 'Sep 2019' or 'Year 12'. */
  label: string
  main: number
  low?: number
  high?: number
  bank: number
  paidIn: number
}

export type ResultChartProps = {
  data: ChartDatum[]
  currency: string
  mainLabel: string
  bankLabel: string
  bandLabel?: string
  showBand: boolean
}

type TooltipRow = { name: string; value: number; color: string; dashed?: boolean }

function ChartTooltip({
  active,
  payload,
  currency,
  mainLabel,
  bankLabel,
  showBand,
}: {
  active?: boolean
  payload?: { payload: ChartDatum }[]
  currency: string
  mainLabel: string
  bankLabel: string
  showBand: boolean
}) {
  if (!active || !payload?.length) return null
  const datum = payload[0].payload

  const rows: TooltipRow[] = []
  if (showBand && datum.high !== undefined) {
    rows.push({ name: 'Best case', value: datum.high, color: 'var(--invest-edge)' })
  }
  rows.push({ name: mainLabel, value: datum.main, color: 'var(--invest)' })
  if (showBand && datum.low !== undefined) {
    rows.push({ name: 'Worst case', value: datum.low, color: 'var(--invest-edge)' })
  }
  rows.push({ name: bankLabel, value: datum.bank, color: 'var(--bank)' })
  rows.push({ name: 'Money paid in', value: datum.paidIn, color: 'var(--paid-in)', dashed: true })

  const gap = datum.main - datum.bank

  return (
    <div className="min-w-[200px] rounded-lg border border-hairline bg-surface p-2.5 text-xs shadow-lg">
      <div className="mb-2 font-medium text-ink">{datum.label}</div>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-ink-secondary">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{
                  background: row.dashed
                    ? `repeating-linear-gradient(90deg, ${row.color} 0 3px, transparent 3px 6px)`
                    : row.color,
                }}
              />
              {row.name}
            </dt>
            <dd className="tabular font-medium text-ink">{formatCurrency(row.value, currency)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-hairline pt-2">
        <span className="text-ink-secondary">Ahead of the bank</span>
        <span className="tabular font-semibold text-good">
          +{formatCurrency(gap, currency)}
        </span>
      </div>
    </div>
  )
}

function LegendSwatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-0.5 w-4 rounded-full"
      style={{
        background: dashed
          ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)`
          : color,
      }}
    />
  )
}

export function ResultChart({
  data,
  currency,
  mainLabel,
  bankLabel,
  bandLabel = 'Range of outcomes',
  showBand,
}: ResultChartProps) {
  const last = data[data.length - 1]
  const legend = [
    ...(showBand ? [{ name: bandLabel, color: 'var(--invest-edge)', dashed: false }] : []),
    { name: mainLabel, color: 'var(--invest)', dashed: false },
    { name: bankLabel, color: 'var(--bank)', dashed: false },
    { name: 'Money paid in', color: 'var(--paid-in)', dashed: true },
  ]

  return (
    <figure className="m-0">
      <div className="h-[320px] w-full sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) => `${Math.round(value)}y`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-strong)' }}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value, currency)}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={62}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={
                <ChartTooltip
                  currency={currency}
                  mainLabel={mainLabel}
                  bankLabel={bankLabel}
                  showBand={showBand}
                />
              }
            />

            {showBand && (
              <Area
                dataKey={(datum: ChartDatum) => [datum.low ?? datum.main, datum.high ?? datum.main]}
                stroke="var(--invest-edge)"
                strokeWidth={1}
                fill="var(--invest-band)"
                fillOpacity={0.35}
                isAnimationActive={false}
                activeDot={false}
                name={bandLabel}
              />
            )}

            <Line
              dataKey="paidIn"
              stroke="var(--paid-in)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              name="Money paid in"
            />
            <Line
              dataKey="bank"
              stroke="var(--bank)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--bank)' }}
              name={bankLabel}
            />
            <Line
              dataKey="main"
              stroke="var(--invest)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--invest)' }}
              name={mainLabel}
            />

            <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-secondary">
        {legend.map((item) => (
          <span key={item.name} className="flex items-center gap-1.5">
            <LegendSwatch color={item.color} dashed={item.dashed} />
            {item.name}
          </span>
        ))}
        {last && (
          <span className="ml-auto tabular text-ink-muted">
            {last.label}: {formatCurrency(last.main, currency)} invested vs{' '}
            {formatCurrency(last.bank, currency)} in the bank
          </span>
        )}
      </figcaption>
    </figure>
  )
}
