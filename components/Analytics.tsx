'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useConsent } from '@/components/ConsentProvider'

/**
 * Google Analytics, and nothing until it is asked for.
 *
 * The consent panel promises that nothing non-essential runs unless the
 * visitor switches it on, so the tag is not merely configured-and-denied: the
 * script is never added to the page at all while consent is absent. That is
 * stricter than Consent Mode's default-denied, and it is the only version of
 * the promise the panel actually makes.
 *
 * The measurement ID is supplied at build time. Without it — a local build, a
 * fork — this component renders nothing, so development traffic never reaches
 * the property.
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ''

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function Analytics() {
  const { ready, allows } = useConsent()
  const pathname = usePathname()
  const granted = ready && MEASUREMENT_ID !== '' && allows('analytics')
  const loaded = useRef(false)

  // Queue the configuration before the tag arrives. gtag's whole job is to push
  // onto dataLayer, which gtag.js replays once it loads, so ordering between
  // this effect and the <Script> below does not matter.
  useEffect(() => {
    if (!granted) return
    window.dataLayer = window.dataLayer ?? []
    if (!window.gtag) {
      window.gtag = function gtag() {
        // The canonical snippet pushes the arguments object, not an array;
        // gtag.js reads dataLayer entries expecting exactly that shape.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer!.push(arguments)
      }
    }
    window.gtag('js', new Date())
    window.gtag('config', MEASUREMENT_ID, {
      // Client-side navigation means one automatic page_view would be the only
      // one ever sent; the effect below sends them all instead.
      send_page_view: false,
      // The consent panel says there is no advertising and no profiling. These
      // two are what make that true rather than aspirational.
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    })
    loaded.current = true
  }, [granted])

  useEffect(() => {
    if (!granted) return
    window.gtag?.('event', 'page_view', {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [granted, pathname])

  // Withdrawal has to actually stop things, including for a visitor who
  // consented earlier in the session or on an earlier visit.
  useEffect(() => {
    if (granted || !ready) return
    if (loaded.current) {
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' })
      loaded.current = false
    }
    if (MEASUREMENT_ID !== '') {
      // Google's documented opt-out: gtag.js checks this before every hit, and
      // before initialising if it is set early enough.
      ;(window as unknown as Record<string, boolean>)[`ga-disable-${MEASUREMENT_ID}`] = true
    }
    clearAnalyticsCookies()
  }, [granted, ready])

  if (!granted) return null

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  )
}

/**
 * Remove anything Google Analytics left behind. Its cookies are set on the
 * registrable domain, so expiring them takes both the exact host and the
 * dot-prefixed parent — a delete that misses the domain silently does nothing.
 */
function clearAnalyticsCookies() {
  if (typeof document === 'undefined') return
  const host = window.location.hostname
  const domains = [undefined, host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]

  for (const entry of document.cookie.split(';')) {
    const name = entry.split('=')[0]?.trim()
    if (!name || !/^_(ga|gid|gat)/.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${
        domain ? `; domain=${domain}` : ''
      }`
    }
  }
}
