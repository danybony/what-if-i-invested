'use client'

import Link from 'next/link'
import { useConsent } from '@/components/ConsentProvider'

/** The full disclaimer, and a way back into the storage decision. */
export function ConsentFooterLinks() {
  const { openSettings } = useConsent()

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href="/disclaimer" className="underline underline-offset-2 hover:text-ink hover:no-underline">
        Disclaimer
      </Link>
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
