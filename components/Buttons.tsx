'use client'

import type { ButtonHTMLAttributes } from 'react'

const BASE =
  'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--invest)] disabled:opacity-50'

/**
 * `primary` and `neutral` are deliberately the same size and weight. Consent
 * rules require refusing to be as easy as accepting, so "Reject all" must not
 * be visually demoted next to "Accept all".
 */
export function Button({
  variant = 'neutral',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'neutral' | 'quiet' }) {
  const variants = {
    primary: 'bg-invest text-white hover:opacity-90',
    neutral: 'border border-hairline-strong text-ink hover:bg-sunken',
    quiet: 'text-ink-secondary underline underline-offset-2 hover:text-ink hover:no-underline',
  }
  return <button className={`${BASE} ${variants[variant]} ${className}`} {...props} />
}
