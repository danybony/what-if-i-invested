'use client'

import type { ReactNode } from 'react'

export function Card({
  title,
  description,
  children,
  className = '',
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-hairline bg-surface p-4 sm:p-5 ${className}`}
    >
      {title && (
        <header className="mb-4">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-xs text-ink-secondary">{description}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-ink-muted">{hint}</span>}
    </label>
  )
}

/**
 * A numeric input kept as a string while focused, so a half-typed value like
 * "1." or an empty box doesn't get rewritten under the cursor.
 */
export function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  step = 'any',
  min,
  max,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  prefix?: string
  suffix?: string
  step?: string | number
  min?: number
  max?: number
  ariaLabel?: string
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
          {prefix}
        </span>
      )}
      <input
        type="number"
        inputMode="decimal"
        className="field"
        style={{
          paddingLeft: prefix ? '1.75rem' : undefined,
          paddingRight: suffix ? '2rem' : undefined,
        }}
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(event) => {
          const next = event.target.valueAsNumber
          onChange(Number.isNaN(next) ? 0 : next)
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  ariaLabel?: string
}) {
  return (
    <select
      className="field"
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
  /** Used for a consent category that cannot be switched off. */
  disabled?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--invest)] disabled:opacity-60"
      />
      <span>
        <span className="block text-xs font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function Callout({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error'
  children: ReactNode
}) {
  const toneClass =
    tone === 'error'
      ? 'border-[color-mix(in_srgb,#d03b3b_45%,transparent)] bg-[color-mix(in_srgb,#d03b3b_8%,transparent)]'
      : 'border-hairline bg-sunken'
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${toneClass}`}>
      {children}
    </div>
  )
}
