'use client'

import { useConsent } from '@/components/ConsentProvider'

/** Lets the visitor revisit either decision after the first run. */
export function ConsentFooterLinks() {
  const { openSettings, openDisclaimerReview } = useConsent()

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={openDisclaimerReview}
        className="underline underline-offset-2 hover:text-ink hover:no-underline"
      >
        Disclaimer
      </button>
      <span aria-hidden className="text-hairline-strong">
        ·
      </span>
      <button
        type="button"
        onClick={openSettings}
        className="underline underline-offset-2 hover:text-ink hover:no-underline"
      >
        Storage preferences
      </button>
    </p>
  )
}
