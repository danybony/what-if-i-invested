/**
 * Browser-stored consent records.
 *
 * Two separate decisions, deliberately not bundled together: acknowledging the
 * educational-use disclaimer is not consent to storage, and consenting to
 * storage is not an acknowledgement of the disclaimer. GDPR treats bundled
 * consent as invalid, and the two have different legal bases anyway.
 *
 * Everything lives in localStorage. Under ePrivacy that is treated the same as
 * a cookie, but a record of the user's own choice — and of the acknowledgement
 * — is "strictly necessary", so storing it needs no prior consent.
 */

export const DISCLAIMER_VERSION = 1
export const CONSENT_VERSION = 1

const DISCLAIMER_KEY = 'whatifiinvested.disclaimer'
const CONSENT_KEY = 'whatifiinvested.consent'

/** `necessary` is not optional: it only covers these two records. */
export type ConsentCategories = {
  necessary: true
  analytics: boolean
}

export type ConsentRecord = {
  version: number
  decidedAt: string
  categories: ConsentCategories
}

export type DisclaimerRecord = {
  version: number
  acknowledgedAt: string
}

export const ALL_REJECTED: ConsentCategories = { necessary: true, analytics: false }
export const ALL_ACCEPTED: ConsentCategories = { necessary: true, analytics: true }

/**
 * Storage can throw, not just return null — Safari's private mode and browsers
 * configured to block site data both do. Every access is guarded, and a failure
 * degrades to "no record yet" rather than breaking the page.
 */
function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Nothing persists, so the notice reappears next visit. That is the correct
    // failure mode: better to ask again than to assume an answer.
    return false
  }
}

function removeKey(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Returns null when absent, unreadable, or written against an older version. */
export function readDisclaimer(): DisclaimerRecord | null {
  const record = readJson<DisclaimerRecord>(DISCLAIMER_KEY)
  if (!record || record.version !== DISCLAIMER_VERSION) return null
  return record
}

export function writeDisclaimer(): DisclaimerRecord {
  const record: DisclaimerRecord = {
    version: DISCLAIMER_VERSION,
    acknowledgedAt: new Date().toISOString(),
  }
  writeJson(DISCLAIMER_KEY, record)
  emit()
  return record
}

export function readConsent(): ConsentRecord | null {
  const record = readJson<ConsentRecord>(CONSENT_KEY)
  if (!record || record.version !== CONSENT_VERSION) return null
  // Guard against a hand-edited or partially written record.
  if (typeof record.categories?.analytics !== 'boolean') return null
  return { ...record, categories: { ...record.categories, necessary: true } }
}

export function writeConsent(categories: ConsentCategories): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    categories: { ...categories, necessary: true },
  }
  writeJson(CONSENT_KEY, record)
  emit()
  return record
}

/** Full withdrawal — forgets the choice so the banner asks again. */
export function clearConsent(): void {
  removeKey(CONSENT_KEY)
  emit()
}

/* -------------------------------------------------------------------------- */
/* External store                                                             */
/* -------------------------------------------------------------------------- */

/**
 * localStorage is an external store, so React reads it through
 * `useSyncExternalStore` rather than an effect. That gets hydration right by
 * construction — the server renders the `ready: false` snapshot, so no banner
 * can flash in before the stored answer is known — and it keeps two open tabs
 * in step, because a decision made in one fires `storage` in the other.
 */
export type ConsentSnapshot = {
  /** False on the server and until the first client read. */
  ready: boolean
  disclaimer: DisclaimerRecord | null
  consent: ConsentRecord | null
}

const SERVER_SNAPSHOT: ConsentSnapshot = { ready: false, disclaimer: null, consent: null }

// Cached so repeated reads return the same reference; returning a fresh object
// from getSnapshot would loop React forever.
let clientSnapshot: ConsentSnapshot | null = null
const listeners = new Set<() => void>()

function emit(): void {
  clientSnapshot = { ready: true, disclaimer: readDisclaimer(), consent: readConsent() }
  for (const listener of listeners) listener()
}

export function getConsentSnapshot(): ConsentSnapshot {
  if (!clientSnapshot) {
    clientSnapshot = { ready: true, disclaimer: readDisclaimer(), consent: readConsent() }
  }
  return clientSnapshot
}

export function getServerConsentSnapshot(): ConsentSnapshot {
  return SERVER_SNAPSHOT
}

export function subscribeToConsent(listener: () => void): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent) => {
    // key === null means the whole store was cleared.
    if (event.key === null || event.key === CONSENT_KEY || event.key === DISCLAIMER_KEY) emit()
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * The gate any future non-essential script must pass through. Nothing on the
 * site loads analytics today, so this is currently always false unless the
 * visitor has opted in.
 */
export function hasConsent(
  category: keyof ConsentCategories,
  record: ConsentRecord | null
): boolean {
  if (category === 'necessary') return true
  return record?.categories[category] === true
}
