import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Disclaimer — What If I Invested',
  description:
    'Why every figure on this site is an estimate, what the numbers leave out, and what they should and should not be used for.',
}

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Disclaimer</h1>

      <div className="mt-6 space-y-8 text-sm leading-relaxed text-ink-secondary">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Educational use, not financial advice</h2>
          <p>
            This site is an educational tool. Nothing on it is a personal recommendation to buy,
            sell or hold any investment, and nothing on it takes account of your circumstances,
            goals, tax position or tolerance for risk. We are not licensed to advise you and we are
            not trying to.
          </p>
          <p>
            Before making any investment decision, speak to someone licensed to advise you in your
            own country.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Every number here is an estimate</h2>
          <p>
            Results are worked out from the best data available to us, and will differ from what
            you would actually have seen. Among the reasons:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Prices are monthly closing values from a single free data source, refreshed on a
              rotation, so the most recent month can be several days behind and may still move.
            </li>
            <li>
              Where a fund is not carried on its home exchange, an equivalent listing elsewhere in
              the same currency is used. It is the same instrument, quoted slightly differently.
            </li>
            <li>
              Some holdings currently show price return only, without dividends reinvested. The
              portfolio builder says so when it applies.
            </li>
            <li>
              Everything is shown before tax, inflation, fees, spreads and currency conversion, any
              of which can change the outcome substantially.
            </li>
            <li>
              A portfolio is modelled as buy-and-hold with no rebalancing, and all holdings must
              share one currency, because no exchange-rate conversion is applied.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Projections are assumptions, not forecasts</h2>
          <p>
            In Basic mode the rate of return is a number you choose. The presets are rounded
            long-run historical averages offered as a starting point; they are not predictions, and
            no rate of return is guaranteed.{' '}
            <strong className="font-medium text-ink">
              Past performance does not predict future results.
            </strong>
          </p>
          <p>
            Real returns do not arrive in equal yearly instalments. A smooth curve is a useful way
            to see how compounding behaves over time; it is not what a real account balance looks
            like along the way.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">Where the data comes from</h2>
          <p>
            Share and fund prices come from Alpha Vantage as monthly adjusted closes. Bank rates
            come from the ECB Data Portal (euro-area household deposits). Both ship as static files
            with the site and are refreshed on a schedule, so nothing you do here is sent to a data
            provider.
          </p>
        </section>

        <p>
          Treat what you see here as an illustration of how compounding behaves, not as a statement
          of what your money did or will do.
        </p>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-invest underline underline-offset-2 hover:no-underline">
          ← Back to the calculator
        </Link>
      </p>
    </div>
  )
}
