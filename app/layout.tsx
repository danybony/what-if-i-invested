import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Link from 'next/link'
import { ConsentFooterLinks } from '@/components/ConsentFooterLinks'
import { CalculatorStateProvider } from '@/components/CalculatorState'
import { ConsentProvider } from '@/components/ConsentProvider'
import { CookieBanner } from '@/components/CookieBanner'
import { DisclaimerModal } from '@/components/DisclaimerModal'
import { Nav } from '@/components/Nav'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'What If I Invested',
  description:
    'See what compound interest would have done with your money — and how far ahead of your bank account it would have left you.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ConsentProvider>
          <CalculatorStateProvider>
            <header className="border-b border-hairline">
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                  What If I Invested
                </Link>
                <Nav />
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-hairline px-4 py-6 text-xs text-ink-muted sm:px-6">
              <div className="mx-auto max-w-6xl space-y-2">
                <p>
                  <strong className="font-semibold text-ink-secondary">
                    Educational tool — not financial advice.
                  </strong>{' '}
                  Every figure is an estimate and will differ from real-world results. Past
                  performance does not predict future results.
                </p>
                <p>Prices: Alpha Vantage. Bank rates: ECB Data Portal.</p>
                <ConsentFooterLinks />
              </div>
            </footer>
            <DisclaimerModal />
            <CookieBanner />
          </CalculatorStateProvider>
        </ConsentProvider>
      </body>
    </html>
  )
}
