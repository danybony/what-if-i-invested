'use client'

import { Button } from '@/components/Buttons'
import { Modal } from '@/components/Modal'
import { useConsent } from '@/components/ConsentProvider'

export function DisclaimerText() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-secondary">
      <p>
        <strong className="font-semibold text-ink">
          This site is an educational tool. It does not give financial advice.
        </strong>{' '}
        Nothing here is a personal recommendation to buy, sell or hold any investment, and nothing
        here takes account of your circumstances, goals or risk tolerance.
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          Basic mode shows a <em>hypothetical</em> projection. The return you type in is an
          assumption, not a forecast, and no rate of return is guaranteed.
        </li>
        <li>
          Advanced mode shows what a portfolio <em>did</em> in the past.{' '}
          <strong className="font-medium text-ink">
            Past performance does not predict future results.
          </strong>
        </li>
        <li>
          All figures are shown before tax, inflation, fees, spreads and currency conversion, any of
          which can change the outcome substantially.
        </li>
        <li>
          Prices and interest rates come from third-party sources and may be delayed, incomplete or
          wrong. Nothing is verified for accuracy.
        </li>
      </ul>
      <p>
        Before making any investment decision, speak to a professional who is licensed to advise you
        in your own country.
      </p>
    </div>
  )
}

/**
 * Shown on first visit and not dismissible — it has to be acknowledged. The
 * same text is re-openable from the footer afterwards, where it is dismissible
 * because the acknowledgement already stands.
 */
export function DisclaimerModal() {
  const {
    ready,
    disclaimerAcknowledged,
    acknowledgeDisclaimer,
    reviewingDisclaimer,
    closeDisclaimerReview,
  } = useConsent()

  const mustAcknowledge = ready && !disclaimerAcknowledged
  const open = mustAcknowledge || reviewingDisclaimer
  if (!open) return null

  return (
    <Modal
      open
      onClose={mustAcknowledge ? undefined : closeDisclaimerReview}
      labelledBy="disclaimer-title"
      describedBy="disclaimer-body"
    >
      <h2 id="disclaimer-title" className="text-lg font-semibold tracking-tight text-ink">
        Educational use only
      </h2>
      <div id="disclaimer-body" className="mt-3">
        <DisclaimerText />
      </div>
      <div className="mt-5 flex justify-end">
        {mustAcknowledge ? (
          <Button variant="primary" onClick={acknowledgeDisclaimer}>
            I understand
          </Button>
        ) : (
          <Button variant="neutral" onClick={closeDisclaimerReview}>
            Close
          </Button>
        )}
      </div>
    </Modal>
  )
}
