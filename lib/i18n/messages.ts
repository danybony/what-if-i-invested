import type { Formatters } from '@/lib/format'
import type { BacktestError } from '@/lib/backtest'
import { MarketDataError } from '@/lib/marketData'
import type { Dictionary } from './en'

/**
 * Errors travel out of the engines as a code plus the values that go in the
 * sentence; the sentence itself is assembled here, in the reader's language.
 * The English `message` on each error stays as a last-resort fallback for a
 * code these functions have not been taught yet.
 */
export function backtestErrorMessage(
  t: Dictionary,
  f: Formatters,
  error: BacktestError
): string {
  const { detail } = error
  switch (error.code) {
    case 'no-holdings':
      return t.errors['no-holdings']()
    case 'weights':
      return t.errors.weights(f.percent(detail.totalWeight ?? 0, 1))
    case 'mixed-currency':
      return t.errors['mixed-currency'](
        detail.currency ?? '',
        detail.symbol ?? '',
        detail.otherCurrency ?? ''
      )
    case 'no-overlap':
      return t.errors['no-overlap'](detail.symbol ?? '')
    case 'too-short':
      return t.errors['too-short'](f.month(detail.month ?? ''))
    default:
      return error.message
  }
}

export function loadErrorMessage(t: Dictionary, error: unknown): string {
  if (!(error instanceof MarketDataError)) return t.errors.marketData
  switch (error.code) {
    case 'symbols':
      return t.errors.symbols
    case 'history':
      return t.errors.history(error.symbol ?? '')
    case 'rates':
      return t.errors.rates
    default:
      return t.errors.marketData
  }
}
