'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/components/LocaleProvider'

export function Nav() {
  const pathname = usePathname()
  const { t } = useI18n()

  const links = [
    { href: '/basic', label: t.nav.basic },
    { href: '/advanced', label: t.nav.advanced },
  ]

  return (
    <nav className="flex items-center gap-1 rounded-lg bg-sunken p-1 text-sm">
      {links.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              isActive
                ? 'bg-surface font-medium text-ink shadow-sm'
                : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
