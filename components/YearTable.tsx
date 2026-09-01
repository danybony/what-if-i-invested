'use client'

import { useI18n } from '@/components/LocaleProvider'

export type YearRow = {
  label: string
  paidIn: number
  main: number
  low?: number
  high?: number
  bank: number
}

/**
 * The table view — the non-colour route to the same numbers, and the thing
 * people actually copy into a spreadsheet.
 */
export function YearTable({
  rows,
  currency,
  mainLabel,
  bankLabel,
  showBand,
  periodLabel,
}: {
  rows: YearRow[]
  currency: string
  mainLabel: string
  bankLabel: string
  showBand: boolean
  /** Defaults to the localised word for "Year". */
  periodLabel?: string
}) {
  const { t, f } = useI18n()

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink-secondary">
            <th scope="col" className="py-2 pr-3 font-medium">
              {periodLabel ?? t.table.year}
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              {t.table.paidIn}
            </th>
            {showBand && (
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {t.table.worst}
              </th>
            )}
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              {mainLabel}
            </th>
            {showBand && (
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                {t.table.best}
              </th>
            )}
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              {bankLabel}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              {t.table.difference}
            </th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-hairline last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-secondary">
                {row.label}
              </th>
              <td className="py-2 pr-3 text-right text-ink-secondary">
                {f.currency(row.paidIn, currency)}
              </td>
              {showBand && (
                <td className="py-2 pr-3 text-right text-ink-secondary">
                  {f.currency(row.low ?? row.main, currency)}
                </td>
              )}
              <td className="py-2 pr-3 text-right font-medium">
                {f.currency(row.main, currency)}
              </td>
              {showBand && (
                <td className="py-2 pr-3 text-right text-ink-secondary">
                  {f.currency(row.high ?? row.main, currency)}
                </td>
              )}
              <td className="py-2 pr-3 text-right">{f.currency(row.bank, currency)}</td>
              <td className="py-2 text-right font-medium text-good">
                +{f.currency(row.main - row.bank, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
