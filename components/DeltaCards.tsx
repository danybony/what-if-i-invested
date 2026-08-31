'use client'

import { formatCurrency, formatPercent } from '@/lib/format'

/**
 * The headline. The gap between investing and leaving the money in the bank is
 * the biggest number on the page, because it is the question the site answers.
 */
export function DeltaCards({
  currency,
  invested,
  bank,
  paidIn,
  investedLabel,
  bankLabel,
  gapRange,
}: {
  currency: string
  invested: number
  bank: number
  paidIn: number
  investedLabel: string
  bankLabel: string
  /** Worst/best gap, when a range of outcomes is being shown. */
  gapRange?: { worst: number; best: number }
}) {
  const gap = invested - bank
  const multiple = bank > 0 ? invested / bank : null
  const growthOnContributions = paidIn > 0 ? invested / paidIn - 1 : 0

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-hairline bg-surface p-4 sm:col-span-3">
        <p className="text-xs font-medium text-ink-secondary">
          What investing leaves you with, over and above the bank
        </p>
        <p className="mt-1 text-4xl font-semibold tracking-tight text-good sm:text-5xl">
          +{formatCurrency(gap, currency)}
        </p>
        <p className="mt-2 text-xs text-ink-secondary">
          {gapRange ? (
            <>
              Between{' '}
              <strong className="tabular font-semibold text-ink">
                +{formatCurrency(gapRange.worst, currency)}
              </strong>{' '}
              and{' '}
              <strong className="tabular font-semibold text-ink">
                +{formatCurrency(gapRange.best, currency)}
              </strong>{' '}
              across the range of outcomes.
            </>
          ) : (
            <>
              You would have put in{' '}
              <strong className="tabular font-semibold text-ink">
                {formatCurrency(paidIn, currency)}
              </strong>{' '}
              either way.
            </>
          )}
          {multiple !== null && multiple > 1.05 && (
            <>
              {' '}
              That is{' '}
              <strong className="tabular font-semibold text-ink">{multiple.toFixed(1)}×</strong> what
              the bank would have left you.
            </>
          )}
        </p>
      </div>

      <Stat
        label={investedLabel}
        value={formatCurrency(invested, currency)}
        accent="var(--invest)"
        note={`${formatPercent(growthOnContributions, 0)} more than you paid in`}
      />
      <Stat label={bankLabel} value={formatCurrency(bank, currency)} accent="var(--bank)" />
      <Stat
        label="Money paid in"
        value={formatCurrency(paidIn, currency)}
        accent="var(--paid-in)"
        dashed
      />
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
  note,
  dashed,
}: {
  label: string
  value: string
  accent: string
  note?: string
  dashed?: boolean
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
        <span
          aria-hidden
          className="inline-block h-0.5 w-4 shrink-0 rounded-full"
          style={{
            background: dashed
              ? `repeating-linear-gradient(90deg, ${accent} 0 3px, transparent 3px 6px)`
              : accent,
          }}
        />
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-[11px] text-ink-muted">{note}</p>}
    </div>
  )
}
