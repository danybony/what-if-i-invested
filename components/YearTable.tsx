'use client'

import { formatCurrency } from '@/lib/format'

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
  periodLabel = 'Year',
}: {
  rows: YearRow[]
  currency: string
  mainLabel: string
  bankLabel: string
  showBand: boolean
  periodLabel?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink-secondary">
            <th scope="col" className="py-2 pr-3 font-medium">
              {periodLabel}
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Paid in
            </th>
            {showBand && (
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Worst
              </th>
            )}
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              {mainLabel}
            </th>
            {showBand && (
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Best
              </th>
            )}
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              {bankLabel}
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Difference
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
                {formatCurrency(row.paidIn, currency)}
              </td>
              {showBand && (
                <td className="py-2 pr-3 text-right text-ink-secondary">
                  {formatCurrency(row.low ?? row.main, currency)}
                </td>
              )}
              <td className="py-2 pr-3 text-right font-medium">
                {formatCurrency(row.main, currency)}
              </td>
              {showBand && (
                <td className="py-2 pr-3 text-right text-ink-secondary">
                  {formatCurrency(row.high ?? row.main, currency)}
                </td>
              )}
              <td className="py-2 pr-3 text-right">{formatCurrency(row.bank, currency)}</td>
              <td className="py-2 text-right font-medium text-good">
                +{formatCurrency(row.main - row.bank, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
