'use client'

import { useState } from 'react'
import { Button } from '@/components/Buttons'
import { Modal } from '@/components/Modal'
import { Toggle } from '@/components/ui'
import { useConsent } from '@/components/ConsentProvider'

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

  const undecided = ready && disclaimerAcknowledged && consent === null
  const showBar = undecided && !settingsOpen

  return (
    <>
      {showBar && (
        <div
          role="region"
          aria-label="Storage and cookie consent"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 p-4 backdrop-blur sm:p-5"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="min-w-0 flex-1 text-xs leading-relaxed text-ink-secondary">
              <p className="mb-1 text-sm font-semibold text-ink">Your data on this site</p>
              <p>
                We store a small record in your browser to remember this choice and that you have
                seen the disclaimer. That much is needed for the site to work. Anything beyond it is
                optional and stays off unless you turn it on.{' '}
                <span className="text-ink-muted">
                  No advertising, no profiling, and nothing is sold or shared.
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button variant="neutral" onClick={openSettings}>
                Manage
              </Button>
              <Button variant="neutral" onClick={rejectAll}>
                Reject all
              </Button>
              <Button variant="primary" onClick={acceptAll}>
                Accept all
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
        Storage preferences
      </h2>
      <p id="consent-settings-body" className="mt-2 text-sm text-ink-secondary">
        This site uses browser storage rather than server-side cookies, which privacy law treats the
        same way. Here is everything it can store.
      </p>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-hairline bg-sunken p-3">
          <Toggle
            checked
            disabled
            onChange={() => {}}
            label="Strictly necessary — always on"
            hint="Two records: that you acknowledged the disclaimer, and the choice you make here. Without them you would be asked again on every page. They hold no identifier and never leave your browser."
          />
        </div>

        <div className="rounded-lg border border-hairline bg-sunken p-3">
          <Toggle
            checked={analytics}
            onChange={setAnalytics}
            label="Analytics — optional"
            hint="Anonymous, aggregated usage statistics showing which features get used. Nothing is loaded today, and this stays off until you switch it on; if analytics is ever added, it will not run without it."
          />
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        Calculations run in your browser. The only requests leaving it are for share prices and ECB
        interest rates, fetched through this site&apos;s own server so the data providers never see
        you. You can change or withdraw this at any time from{' '}
        <span className="whitespace-nowrap">“Storage preferences”</span> in the footer.
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {consent && (
          <Button variant="quiet" onClick={withdrawConsent}>
            Withdraw and ask again
          </Button>
        )}
        <Button variant="neutral" onClick={rejectAll}>
          Reject all
        </Button>
        <Button variant="primary" onClick={() => saveConsent({ necessary: true, analytics })}>
          Save choices
        </Button>
      </div>
    </Modal>
  )
}
