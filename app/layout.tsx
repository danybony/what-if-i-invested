import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { CalculatorStateProvider } from '@/components/CalculatorState'
import { ConsentProvider } from '@/components/ConsentProvider'
import { CookieBanner } from '@/components/CookieBanner'
import { DisclaimerModal } from '@/components/DisclaimerModal'
import { LocaleProvider } from '@/components/LocaleProvider'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

/**
 * Static metadata is English: the export is prerendered once, with no server to
 * vary it by Accept-Language. LocaleProvider corrects <html lang> in the
 * browser once the visitor's language is known.
 */
export const metadata: Metadata = {
  title: 'What If I Invested',
  description:
    'See what compound interest would have done with your money — and how far ahead of your bank account it would have left you.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LocaleProvider>
          <ConsentProvider>
            <CalculatorStateProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
              <DisclaimerModal />
              <CookieBanner />
            </CalculatorStateProvider>
          </ConsentProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
