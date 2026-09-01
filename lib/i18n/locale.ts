/**
 * Which language the site speaks, and how it decides.
 *
 * The site is a static export on GitHub Pages: there is no server to read
 * Accept-Language, so the choice is made in the browser from
 * `navigator.languages`. The prerendered HTML is always English, and an Italian
 * browser re-renders into Italian immediately after hydration — which is why
 * the store below hands React a fixed 'en' server snapshot rather than the real
 * one. Returning the detected locale during hydration would make the first
 * render disagree with the HTML it is hydrating.
 */

export const LOCALES = ['en', 'it'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

/** Intl tags. English uses en-IE so euro amounts read the way the site does. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-IE',
  it: 'it-IT',
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  it: 'Italiano',
}

const STORAGE_KEY = 'whatifiinvested.locale'

function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * First supported language in the browser's ordered preference list.
 * Matching is on the primary subtag, so 'it-CH' and 'it' both mean Italian.
 */
export function matchLocale(tags: readonly string[]): Locale {
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
}

function browserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  return matchLocale(tags.filter(Boolean))
}

/**
 * An explicit choice, if one was made. Storing it needs no consent: it records
 * nothing but a preference the visitor set themselves, which ePrivacy treats as
 * strictly necessary. Auto-detection writes nothing.
 */
export function readStoredLocale(): Locale | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw && isLocale(raw) ? raw : null
  } catch {
    // Safari in private mode throws on access rather than returning null.
    return null
  }
}

let cached: Locale | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function writeLocale(locale: Locale) {
  cached = locale
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // A rejected write only costs the visitor the choice on their next visit.
  }
  emit()
}

export function clearStoredLocale() {
  cached = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to undo.
  }
  emit()
}

/** Cached so repeated renders don't re-read navigator and localStorage. */
export function getLocaleSnapshot(): Locale {
  if (cached === null) cached = readStoredLocale() ?? browserLocale()
  return cached
}

export function getServerLocaleSnapshot(): Locale {
  return DEFAULT_LOCALE
}

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    cached = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
