'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  ALL_ACCEPTED,
  ALL_REJECTED,
  clearConsent,
  getConsentSnapshot,
  getServerConsentSnapshot,
  hasConsent,
  subscribeToConsent,
  writeConsent,
  writeDisclaimer,
  type ConsentCategories,
  type ConsentRecord,
} from '@/lib/consent'

type ConsentContextValue = {
  /** False until the stored answer is known — nothing prompts before this. */
  ready: boolean
  disclaimerAcknowledged: boolean
  acknowledgeDisclaimer: () => void
  consent: ConsentRecord | null
  saveConsent: (categories: ConsentCategories) => void
  acceptAll: () => void
  rejectAll: () => void
  withdrawConsent: () => void
  settingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  /** The gate a non-essential script must pass before loading. */
  allows: (category: keyof ConsentCategories) => boolean
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext)
  if (!context) throw new Error('useConsent must be used inside <ConsentProvider>')
  return context
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  )

  const [settingsOpen, setSettingsOpen] = useState(false)

  const saveConsent = useCallback((categories: ConsentCategories) => {
    writeConsent(categories)
    setSettingsOpen(false)
  }, [])

  const acceptAll = useCallback(() => saveConsent(ALL_ACCEPTED), [saveConsent])
  const rejectAll = useCallback(() => saveConsent(ALL_REJECTED), [saveConsent])

  const withdrawConsent = useCallback(() => {
    clearConsent()
    setSettingsOpen(false)
  }, [])

  const value = useMemo<ConsentContextValue>(
    () => ({
      ready: stored.ready,
      disclaimerAcknowledged: stored.disclaimer !== null,
      acknowledgeDisclaimer: () => writeDisclaimer(),
      consent: stored.consent,
      saveConsent,
      acceptAll,
      rejectAll,
      withdrawConsent,
      settingsOpen,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      allows: (category) => hasConsent(category, stored.consent),
    }),
    [stored, settingsOpen, saveConsent, acceptAll, rejectAll, withdrawConsent]
  )

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
}
