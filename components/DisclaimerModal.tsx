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
      <p>
        <strong className="font-semibold text-ink">
          Every number on this site is an estimate.
        </strong>{' '}
        Results are worked out from the best data available to us, and will differ from what you
        would actually have seen. Among the reasons:
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          Prices are monthly closing values from a single free data source, refreshed on a
          rotation, so the most recent month can be several days behind and may still move.
        </li>
        <li>
          Where a fund is not carried on its home exchange, an equivalent listing elsewhere in the
          same currency is used. It is the same instrument, quoted slightly differently.
        </li>
        <li>
          Some holdings currently show price return only, without dividends reinvested. The
          portfolio builder says so when it applies.
        </li>
        <li>
          Everything is shown before tax, inflation, fees, spreads and currency conversion, any of
          which can change the outcome substantially.
        </li>
        <li>
          Projected returns are assumptions you choose, not forecasts, and no rate of return is
          guaranteed.{' '}
          <strong className="font-medium text-ink">
            Past performance does not predict future results.
          </strong>
        </li>
      </ul>
      <p>
        Treat what you see here as an illustration of how compounding behaves, not as a statement
        of what your money did or will do. Before making any investment decision, speak to someone
        licensed to advise you in your own country.
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
        Educational use, estimated figures
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
