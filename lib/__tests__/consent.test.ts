import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal stand-in for the browser globals lib/consent.ts touches. */
function installFakeWindow(options: { throwOnAccess?: boolean } = {}) {
  const store = new Map<string, string>()
  const listeners = new Set<(event: unknown) => void>()

  const localStorage = {
    getItem(key: string) {
      if (options.throwOnAccess) throw new Error('storage blocked')
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (options.throwOnAccess) throw new Error('storage blocked')
      store.set(key, value)
    },
    removeItem(key: string) {
      if (options.throwOnAccess) throw new Error('storage blocked')
      store.delete(key)
    },
  }

  ;(globalThis as Record<string, unknown>).window = {
    localStorage,
    addEventListener: (_type: string, listener: (event: unknown) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: unknown) => void) =>
      listeners.delete(listener),
  }

  return { store, listeners }
}

/** Fresh module per test — the snapshot cache lives at module scope. */
async function loadConsent() {
  vi.resetModules()
  return import('../consent')
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window
})

describe('disclaimer acknowledgement', () => {
  beforeEach(() => installFakeWindow())

  it('starts unacknowledged and records an acknowledgement', async () => {
    const consent = await loadConsent()
    expect(consent.readDisclaimer()).toBeNull()

    const record = consent.writeDisclaimer()
    expect(record.version).toBe(consent.DISCLAIMER_VERSION)
    expect(consent.readDisclaimer()?.acknowledgedAt).toBe(record.acknowledgedAt)
  })

  it('asks again when the stored acknowledgement predates the current text', async () => {
    const { store } = installFakeWindow()
    const consent = await loadConsent()
    store.set(
      'whatifiinvested.disclaimer',
      JSON.stringify({ version: 0, acknowledgedAt: '2020-01-01T00:00:00.000Z' })
    )
    expect(consent.readDisclaimer()).toBeNull()
  })
})

describe('storage consent', () => {
  beforeEach(() => installFakeWindow())

  it('records a rejection as a real decision, not an absence of one', async () => {
    const consent = await loadConsent()
    expect(consent.readConsent()).toBeNull()

    consent.writeConsent(consent.ALL_REJECTED)
    const record = consent.readConsent()
    expect(record).not.toBeNull()
    expect(record?.categories.analytics).toBe(false)
    expect(record?.categories.necessary).toBe(true)
  })

  it('records acceptance', async () => {
    const consent = await loadConsent()
    consent.writeConsent(consent.ALL_ACCEPTED)
    expect(consent.readConsent()?.categories.analytics).toBe(true)
  })

  it('never lets necessary be switched off, even if asked', async () => {
    const consent = await loadConsent()
    consent.writeConsent({ necessary: false, analytics: true } as never)
    expect(consent.readConsent()?.categories.necessary).toBe(true)
  })

  it('withdrawal forgets the choice so the banner asks again', async () => {
    const consent = await loadConsent()
    consent.writeConsent(consent.ALL_ACCEPTED)
    consent.clearConsent()
    expect(consent.readConsent()).toBeNull()
  })

  it('treats a malformed or hand-edited record as no decision', async () => {
    const { store } = installFakeWindow()
    const consent = await loadConsent()
    store.set('whatifiinvested.consent', '{ not json')
    expect(consent.readConsent()).toBeNull()
    store.set('whatifiinvested.consent', JSON.stringify({ version: 1, categories: {} }))
    expect(consent.readConsent()).toBeNull()
  })

  it('re-asks when the record predates the current category set', async () => {
    const { store } = installFakeWindow()
    const consent = await loadConsent()
    store.set(
      'whatifiinvested.consent',
      JSON.stringify({ version: 0, decidedAt: 'x', categories: { necessary: true, analytics: true } })
    )
    expect(consent.readConsent()).toBeNull()
  })
})

describe('hasConsent', () => {
  beforeEach(() => installFakeWindow())

  it('always allows necessary, and gates analytics on an explicit opt-in', async () => {
    const consent = await loadConsent()
    expect(consent.hasConsent('necessary', null)).toBe(true)
    expect(consent.hasConsent('analytics', null)).toBe(false)

    consent.writeConsent(consent.ALL_REJECTED)
    expect(consent.hasConsent('analytics', consent.readConsent())).toBe(false)

    consent.writeConsent(consent.ALL_ACCEPTED)
    expect(consent.hasConsent('analytics', consent.readConsent())).toBe(true)
  })
})

describe('external store', () => {
  beforeEach(() => installFakeWindow())

  it('reports not-ready on the server so nothing prompts before hydration', async () => {
    const consent = await loadConsent()
    expect(consent.getServerConsentSnapshot().ready).toBe(false)
    expect(consent.getServerConsentSnapshot().consent).toBeNull()
  })

  it('returns a stable reference until something actually changes', async () => {
    const consent = await loadConsent()
    expect(consent.getConsentSnapshot()).toBe(consent.getConsentSnapshot())
  })

  it('notifies subscribers and swaps the snapshot when a choice is made', async () => {
    const consent = await loadConsent()
    const before = consent.getConsentSnapshot()
    const listener = vi.fn()
    const unsubscribe = consent.subscribeToConsent(listener)

    consent.writeConsent(consent.ALL_ACCEPTED)
    expect(listener).toHaveBeenCalledTimes(1)

    const after = consent.getConsentSnapshot()
    expect(after).not.toBe(before)
    expect(after.ready).toBe(true)
    expect(after.consent?.categories.analytics).toBe(true)

    unsubscribe()
    consent.writeDisclaimer()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('when the browser blocks storage', () => {
  beforeEach(() => installFakeWindow({ throwOnAccess: true }))

  it('degrades to asking again rather than throwing', async () => {
    const consent = await loadConsent()
    expect(() => consent.readConsent()).not.toThrow()
    expect(consent.readConsent()).toBeNull()
    expect(() => consent.writeConsent(consent.ALL_ACCEPTED)).not.toThrow()
    expect(consent.readConsent()).toBeNull()
    expect(() => consent.clearConsent()).not.toThrow()
  })
})
