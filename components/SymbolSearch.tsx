'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type SearchHit = {
  symbol: string
  name: string
  exchange: string
  type: 'ETF' | 'EQUITY'
}

/**
 * Debounced ticker autocomplete over /api/search. Kept deliberately quiet about
 * upstream trouble: if search is unavailable the user can still type a symbol
 * and press Enter, because the history endpoint is what actually validates it.
 */
export function SymbolSearch({
  onSelect,
  disabled,
  placeholder = 'Search a stock or ETF — e.g. VWCE.DE, AAPL, SWDA.MI',
}: {
  onSelect: (hit: SearchHit) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  /**
   * Results are stamped with the query they came from, so a stale list is
   * simply not rendered rather than being cleared by an extra effect pass.
   */
  const [results, setResults] = useState<{
    query: string
    hits: SearchHit[]
    error: string | null
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const trimmed = query.trim()
  const isSearchable = trimmed.length >= 2
  const current = results?.query === trimmed ? results : null
  const hits = current?.hits ?? []
  const error = current?.error ?? null

  useEffect(() => {
    if (!isSearchable) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        })
        const data = await response.json()
        setResults({
          query: trimmed,
          hits: data.results ?? [],
          error: response.ok ? null : (data.error ?? 'Search is unavailable.'),
        })
      } catch (caught) {
        if ((caught as Error).name !== 'AbortError') {
          setResults({ query: trimmed, hits: [], error: 'Search is unavailable.' })
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [trimmed, isSearchable])

  // Close the list when focus or a click goes elsewhere.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const choose = (hit: SearchHit) => {
    onSelect(hit)
    setQuery('')
    setResults(null)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="field"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter') {
            event.preventDefault()
            const typed = trimmed.toUpperCase()
            if (hits.length > 0) choose(hits[0])
            else if (typed.length >= 1) {
              choose({ symbol: typed, name: typed, exchange: '', type: 'EQUITY' })
            }
          }
        }}
      />

      {open && isSearchable && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-hairline bg-surface py-1 shadow-lg"
        >
          {loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-muted">Searching…</li>
          )}
          {!loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-ink-muted">
              {error ?? 'No matches.'} Press Enter to use “{trimmed.toUpperCase()}” anyway.
            </li>
          )}
          {hits.map((hit) => (
            <li key={`${hit.symbol}-${hit.exchange}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => choose(hit)}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-xs hover:bg-sunken"
              >
                <span className="tabular font-semibold">{hit.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-ink-secondary">{hit.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-muted">
                  {hit.type === 'ETF' ? 'ETF' : hit.exchange}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
