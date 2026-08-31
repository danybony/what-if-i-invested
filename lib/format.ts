export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const
export type Currency = (typeof CURRENCIES)[number]

export function formatCurrency(value: number, currency = 'EUR', fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** Short form for axis ticks: €1.2M, €340k. */
export function formatCompact(value: number, currency = 'EUR'): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(fractionDigits)}%`
}

/** 'YYYY-MM' → 'Sep 2019'. */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Tolerant number parsing for text inputs — an empty box means 0, not NaN. */
export function toNumber(raw: string, fallback = 0): number {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '.')
  if (cleaned === '' || cleaned === '-') return fallback
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : fallback
}
