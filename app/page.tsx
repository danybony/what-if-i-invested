'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useCalculatorState } from '@/components/CalculatorState'
import { useI18n } from '@/components/LocaleProvider'
import { toNumber } from '@/lib/format'
import { project } from '@/lib/projection'

export default function HomePage() {
  const { shared, setShared, basic, setBasic } = useCalculatorState()
  const { t, f } = useI18n()

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

  const symbol = f.symbol(basic.currency)

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col justify-center px-5 py-16 text-center sm:px-6">
      <p className="text-balance text-xl leading-relaxed text-ink sm:text-2xl sm:leading-relaxed">
        {t.home.ifLead}{' '}
        <InlineNumber
          value={basic.years}
          onCommit={(value) => setBasic('years', clamp(value, 1, 60))}
          ariaLabel={t.home.aria.years}
        />{' '}
        {t.home.yearsAgo}{' '}
        <InlineNumber
          value={shared.contribution}
          onCommit={(value) => setShared('contribution', Math.max(0, value))}
          prefix={symbol}
          ariaLabel={t.home.aria.contribution}
        />{' '}
        {t.frequency.every[shared.contributionFrequency]}
        {t.home.onTopOf}{' '}
        <InlineNumber
          value={shared.initial}
          onCommit={(value) => setShared('initial', Math.max(0, value))}
          prefix={symbol}
          ariaLabel={t.home.aria.initial}
        />
        {t.home.todayYouWould}
      </p>

      <p className="my-6 text-balance text-5xl font-semibold tracking-tight text-invest sm:my-8 sm:text-6xl">
        {f.currency(result.gapAverage, basic.currency)}
      </p>

      <p className="text-balance text-xl leading-relaxed text-ink sm:text-2xl sm:leading-relaxed">
        {t.home.moreThanBank}
      </p>

      <p className="mx-auto mt-10 max-w-md text-balance text-sm leading-relaxed text-ink-muted">
        {t.home.assumingBefore}{' '}
        <InlineNumber
          value={round(basic.rate * 100)}
          onCommit={(value) => setBasic('rate', clamp(value, -50, 50) / 100)}
          suffix="%"
          allowNegative
          small
          ariaLabel={t.home.aria.rate}
        />{' '}
        {t.home.assumingAfter(t.frequency.compounded[basic.compoundFrequency])}
      </p>

      <p className="mt-8">
        <Link
          href="/basic"
          className="text-base text-invest underline underline-offset-4 hover:no-underline"
        >
          {t.home.seeHow} →
        </Link>
      </p>
    </div>
  )
}

/**
 * A number that sits inside a sentence and can be typed over in place.
 *
 * The text is held locally while editing so a half-typed "1." or a cleared box
 * isn't rewritten under the cursor; the parsed value is pushed up on every
 * keystroke so the headline figure keeps pace, and the box is normalised on
 * blur. It never reads the prop back, which is safe here because this page is
 * the only thing that writes these fields.
 */
function InlineNumber({
  value,
  onCommit,
  prefix,
  suffix,
  allowNegative = false,
  small = false,
  ariaLabel,
}: {
  value: number
  onCommit: (value: number) => void
  prefix?: string
  suffix?: string
  allowNegative?: boolean
  small?: boolean
  ariaLabel: string
}) {
  const [text, setText] = useState(() => String(value))
  const pattern = allowNegative ? /[^0-9.,-]/g : /[^0-9.,]/g

  return (
    <span className="whitespace-nowrap font-semibold text-invest">
      {prefix}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        aria-label={ariaLabel}
        onChange={(event) => {
          const cleaned = event.target.value.replace(pattern, '')
          setText(cleaned)
          onCommit(toNumber(cleaned, 0))
        }}
        onFocus={(event) => event.target.select()}
        onBlur={() => setText(String(value))}
        style={{ width: `${Math.max(text.length, 1) + 0.5}ch` }}
        className={`border-b-2 border-dotted border-invest bg-transparent text-center font-semibold tabular text-invest outline-none focus:border-solid focus-visible:bg-sunken ${
          small ? 'pb-px' : 'pb-0.5'
        }`}
      />
      {suffix}
    </span>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Keep float noise (7.000000000000001) out of the rate input. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
