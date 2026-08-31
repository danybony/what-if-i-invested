'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Dialog shell used by the disclaimer and the cookie preferences panel.
 *
 * Omitting `onClose` makes the dialog non-dismissible: no backdrop click, no
 * Escape, no close button. That is what the first-run disclaimer needs — it has
 * to be acknowledged rather than waved away.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  describedBy,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean
  onClose?: () => void
  labelledBy: string
  describedBy?: string
  children: ReactNode
  maxWidth?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null
    const { body } = document
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    // Move focus into the dialog so a keyboard or screen-reader user lands on it.
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    focusables?.[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const items = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!items || items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]

      // Keep Tab inside the dialog — the page behind it is inert.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      body.style.overflow = previousOverflow
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-4">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`relative w-full ${maxWidth} rounded-t-2xl border border-hairline bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6`}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
