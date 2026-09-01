'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createFormatters, type Formatters } from '@/lib/format'
import { en, type Dictionary } from '@/lib/i18n/en'
import { it } from '@/lib/i18n/it'
import {
  getLocaleSnapshot,
  getServerLocaleSnapshot,
  subscribeToLocale,
  writeLocale,
  type Locale,
} from '@/lib/i18n/locale'

const DICTIONARIES: Record<Locale, Dictionary> = { en, it }

type LocaleContextValue = {
  locale: Locale
  /** The active dictionary. Named `t` because it is read on nearly every line. */
  t: Dictionary
  /** Locale-aware number, currency and date formatting. */
  f: Formatters
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) throw new Error('useI18n must be used inside <LocaleProvider>')
  return context
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot
  )

  // The prerendered document says lang="en"; keep the attribute honest once the
  // real locale is known, so screen readers and browser translation follow.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => writeLocale(next), [])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: DICTIONARIES[locale],
      f: createFormatters(locale),
      setLocale,
    }),
    [locale, setLocale]
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}
