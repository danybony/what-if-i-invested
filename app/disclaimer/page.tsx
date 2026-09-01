'use client'

import Link from 'next/link'
import { useI18n } from '@/components/LocaleProvider'

/**
 * A client component, unlike the rest of the static pages: the copy has to
 * follow the visitor's language, and language is only known in the browser.
 * The page metadata stays with the layout, in English.
 */
export default function DisclaimerPage() {
  const { t } = useI18n()
  const d = t.disclaimerPage

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{d.title}</h1>

      <div className="mt-6 space-y-8 text-sm leading-relaxed text-ink-secondary">
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">{d.educationalTitle}</h2>
          <p>{d.educationalBody}</p>
          <p>{d.educationalAdvice}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">{d.estimatesTitle}</h2>
          <p>{d.estimatesIntro}</p>
          <ul className="list-disc space-y-2 pl-5">
            {d.estimatesPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">{d.projectionsTitle}</h2>
          <p>
            {d.projectionsBody}{' '}
            <strong className="font-medium text-ink">{d.projectionsStrong}</strong>
          </p>
          <p>{d.projectionsSmooth}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-ink">{d.dataTitle}</h2>
          <p>{d.dataBody}</p>
        </section>

        <p>{d.closing}</p>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-invest underline underline-offset-2 hover:no-underline">
          {d.back}
        </Link>
      </p>
    </div>
  )
}
