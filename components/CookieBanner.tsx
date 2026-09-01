'use client'

import { useState } from 'react'
import { Button } from '@/components/Buttons'
import { Modal } from '@/components/Modal'
import { Toggle } from '@/components/ui'
import { useConsent } from '@/components/ConsentProvider'
import { useI18n } from '@/components/LocaleProvider'

/**
 * Storage-consent bar and preferences panel.
 *
 * Sequenced after the disclaimer so the visitor never faces two overlays at
 * once. "Reject all" carries the same weight as "Accept all", and the analytics
 * category starts switched off — a pre-ticked non-essential box is not consent.
 */
export function CookieBanner() {
  const {
    ready,
    disclaimerAcknowledged,
    consent,
    settingsOpen,
    openSettings,
    acceptAll,
    rejectAll,
  } = useConsent()
  const { t } = useI18n()

  const undecided = ready && disclaimerAcknowledged && consent === null
  const showBar = undecided && !settingsOpen

  return (
    <>
      {showBar && (
        <div
          role="region"
          aria-label={t.consent.regionAria}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 p-4 backdrop-blur sm:p-5"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink-secondary">
              <p className="mb-1 text-sm font-semibold text-ink">{t.consent.barTitle}</p>
              <p>
                {t.consent.barBody}{' '}
                <span className="text-ink-muted">{t.consent.barQuiet}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="neutral" onClick={openSettings}>
                {t.consent.manage}
              </Button>
              <Button variant="neutral" onClick={rejectAll}>
                {t.consent.rejectAll}
              </Button>
              <Button variant="primary" onClick={acceptAll}>
                {t.consent.acceptAll}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/*
        Mounted only while open, so the draft switch below starts from whatever
        choice is currently in force every time the panel is reopened.
      */}
      {settingsOpen && <ConsentSettingsPanel />}
    </>
  )
}

function ConsentSettingsPanel() {
  const { consent, closeSettings, rejectAll, saveConsent, withdrawConsent } = useConsent()
  const { t } = useI18n()
  const [analytics, setAnalytics] = useState(consent?.categories.analytics ?? false)

  return (
    <Modal
      open
      // Dismissible only once a choice is on record; otherwise closing the panel
      // would quietly stand in for a decision.
      onClose={consent ? closeSettings : undefined}
      labelledBy="consent-settings-title"
      describedBy="consent-settings-body"
    >
      <h2 id="consent-settings-title" className="text-lg font-semibold tracking-tight text-ink">
        {t.consent.settingsTitle}
      </h2>
      <p id="consent-settings-body" className="mt-2 text-sm text-ink-secondary">
        {t.consent.settingsBody}
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-hairline bg-sunken p-3">
          <Toggle
            checked
            disabled
            onChange={() => {}}
            label={t.consent.necessaryLabel}
            hint={t.consent.necessaryHint}
          />
        </div>

        <div className="rounded-lg border border-hairline bg-sunken p-3">
          <Toggle
            checked={analytics}
            onChange={setAnalytics}
            label={t.consent.analyticsLabel}
            hint={t.consent.analyticsHint}
          />
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        {t.consent.settingsFootnoteBefore}{' '}
        <span className="whitespace-nowrap">{t.consent.settingsFootnoteLink}</span>{' '}
        {t.consent.settingsFootnoteAfter}
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {consent && (
          <Button variant="quiet" onClick={withdrawConsent}>
            {t.consent.withdraw}
          </Button>
        )}
        <Button variant="neutral" onClick={rejectAll}>
          {t.consent.rejectAll}
        </Button>
        <Button variant="primary" onClick={() => saveConsent({ necessary: true, analytics })}>
          {t.consent.save}
        </Button>
      </div>
    </Modal>
  )
}
