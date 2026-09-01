'use client'

import { useI18n } from '@/components/LocaleProvider'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/locale'

/**
 * The escape hatch from automatic detection — an Italian machine borrowed by an
 * English speaker, or the other way round. Picking a language records the
 * choice; leaving it alone records nothing.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t.nav.language}
      className="flex items-center rounded-lg bg-sunken p-0.5 text-[11px] font-medium uppercase tracking-wide"
    >
      {LOCALES.map((code) => {
        const isActive = code === locale
        return (
          <button
            key={code}
            type="button"
            lang={code}
            onClick={() => setLocale(code)}
            aria-pressed={isActive}
            title={LOCALE_NAMES[code]}
            className={`rounded-md px-1.5 py-1 transition-colors ${
              isActive ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
