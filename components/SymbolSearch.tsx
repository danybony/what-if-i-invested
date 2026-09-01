'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useI18n } from '@/components/LocaleProvider'
import { loadErrorMessage } from '@/lib/i18n/messages'
import { loadSymbols, searchSymbols, type SymbolEntry } from '@/lib/marketData'

/**
 * Autocomplete over the curated symbol universe.
 *
 * The whole index ships as one small JSON file, so matching happens locally —
 * no request per keystroke, no debounce, and results appear as fast as the user
 * types. There is deliberately no "use whatever I typed" escape hatch any more:
 * a symbol outside the universe has no published prices, so offering it would
 * only produce a dead end.
 */
export function SymbolSearch({
  onSelect,
  disabled,
  placeholder,
}: {
  onSelect: (entry: SymbolEntry) => void
  disabled?: boolean
  /** Defaults to the localised prompt. */
  placeholder?: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState<SymbolEntry[] | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    let cancelled = false
    loadSymbols()
      .then((data) => {
        if (!cancelled) setIndex(data.symbols)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const trimmed = query.trim()
  const hits = index ? searchSymbols(index, trimmed) : []
  const showList = open && trimmed.length > 0

  const choose = (entry: SymbolEntry) => {
    onSelect(entry)
    setQuery('')
    setOpen(false)
    setHighlighted(0)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        className="field"
        placeholder={index ? (placeholder ?? t.search.placeholder) : t.search.loading}
        value={query}
        disabled={disabled || (!index && loadError === null)}
        onChange={(event) => {
          setQuery(event.target.value)
          setHighlighted(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setHighlighted((current) => Math.min(current + 1, hits.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setHighlighted((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && hits[highlighted]) {
            event.preventDefault()
            choose(hits[highlighted])
          }
        }}
      />

      {loadError !== null && (
        <p className="mt-1.5 text-[11px] text-ink-muted">{loadErrorMessage(t, loadError)}</p>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-hairline bg-surface py-1 shadow-lg"
        >
          {hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-muted">{t.search.noMatch(trimmed)}</li>
          )}
          {hits.map((entry, position) => (
            <li key={entry.symbol} role="option" aria-selected={position === highlighted}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(position)}
                onClick={() => choose(entry)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-xs ${
                  position === highlighted ? 'bg-sunken' : ''
                }`}
              >
                <span className="tabular font-semibold">{entry.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-ink-secondary">{entry.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">
                  {entry.currency}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
