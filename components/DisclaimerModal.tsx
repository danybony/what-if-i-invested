'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/Buttons'
import { Modal } from '@/components/Modal'
import { useConsent } from '@/components/ConsentProvider'

/**
 * The short version — the three things someone has to have read before using
 * the site. Everything else lives on /disclaimer, one link away, so the first
 * screen a visitor meets is not a wall of caveats.
 */
export function DisclaimerSummary() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-secondary">
      <p>
        <strong className="font-semibold text-ink">
          This site is for educational purposes only. It does not give financial advice.
        </strong>{' '}
        Nothing here is a recommendation to buy, sell or hold any investment.
      </p>
      <p>
        Every figure is an estimate, worked out from the best data available to us, and will
        differ from real-world results.
      </p>
      <p>
        Before making any investment decision, speak to someone licensed to advise you in your own
        country.
      </p>
    </div>
  )
}

/**
 * Shown on first visit and not dismissible — it has to be acknowledged. The
 * detail behind it lives on /disclaimer, linked from here and from the footer.
 *
 * "More info" opens /disclaimer in a new tab, so reading the detail never costs
 * the visitor the dialog they were part-way through. The modal stays out of the
 * way on /disclaimer itself, or that new tab would open onto a copy of the very
 * dialog the link came from.
 */
export function DisclaimerModal() {
  const { ready, disclaimerAcknowledged, acknowledgeDisclaimer } = useConsent()
  const pathname = usePathname()

  if (!ready || disclaimerAcknowledged || pathname === '/disclaimer') return null

  return (
    <Modal
      open
      labelledBy="disclaimer-title"
      describedBy="disclaimer-body"
    >
      <h2 id="disclaimer-title" className="text-lg font-semibold tracking-tight text-ink">
        Educational use only
      </h2>
      <div id="disclaimer-body" className="mt-3">
        <DisclaimerSummary />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/disclaimer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-invest underline underline-offset-2 hover:no-underline"
        >
          More info
        </Link>
        <Button variant="primary" onClick={acknowledgeDisclaimer}>
          I understand
        </Button>
      </div>
    </Modal>
  )
}
