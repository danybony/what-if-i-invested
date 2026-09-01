'use client'

import Link from 'next/link'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useI18n } from '@/components/LocaleProvider'
import { Nav } from '@/components/Nav'

export function SiteHeader() {
  const { t } = useI18n()

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="min-w-0 truncate text-sm font-semibold tracking-tight">
          {t.nav.brand}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <Nav />
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
