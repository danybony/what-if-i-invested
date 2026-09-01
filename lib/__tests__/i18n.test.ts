import { describe, expect, it } from 'vitest'
import { createFormatters } from '../format'
import { en } from '../i18n/en'
import { it as italian } from '../i18n/it'
import { matchLocale } from '../i18n/locale'

describe('matchLocale', () => {
  it('picks Italian for an Italian browser', () => {
    expect(matchLocale(['it-IT', 'it', 'en-US'])).toBe('it')
  })

  it('matches on the primary subtag, so any Italian region counts', () => {
    expect(matchLocale(['it-CH'])).toBe('it')
  })

  it('honours the order the browser gives, not the order we support', () => {
    expect(matchLocale(['en-GB', 'it-IT'])).toBe('en')
  })

  it('skips languages the site does not speak', () => {
    expect(matchLocale(['de-DE', 'fr-FR', 'it'])).toBe('it')
  })

  it('falls back to English when nothing matches', () => {
    expect(matchLocale(['de-DE', 'ja'])).toBe('en')
    expect(matchLocale([])).toBe('en')
  })
})

describe('dictionaries', () => {
  /** A missing key is a type error, but a key left in English is not. */
  it('translates every leaf away from the English wording', () => {
    const untranslated = compare(en, italian, '')
    expect(untranslated).toEqual([])
  })
})

/** Leaf-by-leaf walk, ignoring the handful of entries that read the same in both. */
const SHARED = new Set(['presets.sp500.label', 'footer.sources', 'disclaimerPage.dataTitle'])

/** Enough placeholders to cover the widest interpolating entry. */
const ARGS = ['«a»', '«b»', '«c»']

function compare(a: unknown, b: unknown, path: string): string[] {
  if (typeof a === 'function' && typeof b === 'function') {
    return compare(a(...ARGS), b(...ARGS), path)
  }
  if (typeof a === 'string') {
    return a === b && !SHARED.has(path) ? [path] : []
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.flatMap((item, index) => compare(item, b[index], `${path}[${index}]`))
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    return Object.keys(a).flatMap((key) =>
      compare(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key
      )
    )
  }
  return []
}

describe('formatters', () => {
  it('formats money the way each language writes it', () => {
    expect(createFormatters('en').currency(72910, 'EUR')).toBe('€72,910')
    // Italian puts the symbol last, after a non-breaking space.
    expect(createFormatters('it').currency(72910, 'EUR')).toBe('72.910\u00a0€')
  })

  it('uses the local decimal separator for percentages', () => {
    expect(createFormatters('en').percent(0.08, 1)).toBe('8.0%')
    expect(createFormatters('it').percent(0.08, 1)).toBe('8,0%')
  })

  it('names months in the reader’s language', () => {
    expect(createFormatters('en').month('2019-09')).toBe('Sept 2019')
    expect(createFormatters('it').month('2019-09')).toBe('set 2019')
  })
})
