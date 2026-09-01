'use client'

import Link from 'next/link'
import { useConsent } from '@/components/ConsentProvider'
import { useI18n } from '@/components/LocaleProvider'

export function SiteFooter() {
  const { t } = useI18n()
  const { openSettings } = useConsent()

  return (
    <footer className="border-t border-hairline px-4 py-6 text-xs text-ink-muted sm:px-6">
      <div className="mx-auto max-w-6xl space-y-2">
        <p>
          <strong className="font-semibold text-ink-secondary">{t.footer.notAdviceStrong}</strong>{' '}
          {t.footer.notAdvice}
        </p>
        <p>{t.footer.sources}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/disclaimer"
            className="underline underline-offset-2 hover:text-ink hover:no-underline"
          >
            {t.footer.disclaimer}
          </Link>
          <span aria-hidden className="text-hairline-strong">
            ·
          </span>
          <button
            type="button"
            onClick={openSettings}
            className="underline underline-offset-2 hover:text-ink hover:no-underline"
          >
            {t.footer.storagePreferences}
          </button>
        </p>
      </div>
    </footer>
  )
}
