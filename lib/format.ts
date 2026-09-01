import { INTL_LOCALE, type Locale } from './i18n/locale'

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const
export type Currency = (typeof CURRENCIES)[number]

export type Formatters = {
  currency(value: number, currency?: string, fractionDigits?: number): string
  /** Short form for axis ticks: €1.2M, €340k. */
  compact(value: number, currency?: string): string
  percent(value: number, fractionDigits?: number): string
  /** A plain number — a multiple, a weight, a unit count. */
  decimal(value: number, fractionDigits?: number): string
  /** 'YYYY-MM' → 'Sep 2019' / 'set 2019'. */
  month(month: string): string
  /** A bare currency symbol, for sitting in front of an input. */
  symbol(currency: string): string
}

/**
 * Number formatting follows the display language, not the currency: an Italian
 * reader expects €72.910 where an English one expects €72,910. Intl instances
 * are built once per locale because constructing them is the expensive part.
 */
export function createFormatters(locale: Locale): Formatters {
  const tag = INTL_LOCALE[locale]

  return {
    currency(value, currency = 'EUR', fractionDigits = 0) {
      if (!Number.isFinite(value)) return '—'
      return new Intl.NumberFormat(tag, {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
    },

    compact(value, currency = 'EUR') {
      if (!Number.isFinite(value)) return '—'
      return new Intl.NumberFormat(tag, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value)
    },

    percent(value, fractionDigits = 1) {
      if (!Number.isFinite(value)) return '—'
      return new Intl.NumberFormat(tag, {
        style: 'percent',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
    },

    decimal(value, fractionDigits = 1) {
      if (!Number.isFinite(value)) return '—'
      return new Intl.NumberFormat(tag, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value)
    },

    month(month) {
      const [year, monthNumber] = month.split('-').map(Number)
      if (!Number.isFinite(year) || !Number.isFinite(monthNumber)) return month
      return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString(tag, {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    },

    symbol(currency) {
      const parts = new Intl.NumberFormat(tag, { style: 'currency', currency }).formatToParts(0)
      return parts.find((part) => part.type === 'currency')?.value ?? ''
    },
  }
}

/** Tolerant number parsing for text inputs — an empty box means 0, not NaN. */
export function toNumber(raw: string, fallback = 0): number {
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,/g, '.')
  if (cleaned === '' || cleaned === '-') return fallback
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : fallback
}
