import { describe, expect, it } from 'vitest'
import { monthKeyInTimeZone } from '../yahoo'

/**
 * Regression: Yahoo stamps monthly bars at midnight in the exchange's own
 * timezone. Reading them as UTC files European bars one month early, and using
 * meta.gmtoffset only fixes the half of the year that shares its DST state.
 */
describe('monthKeyInTimeZone', () => {
  it('files a XETRA month-start bar under the right month, not the previous one', () => {
    // 2019-08-31T22:00Z === 2019-09-01T00:00 in Berlin (CEST).
    expect(monthKeyInTimeZone(1567288800, 'Europe/Berlin')).toBe('2019-09')
    expect(monthKeyInTimeZone(1567288800, 'UTC')).toBe('2019-08') // the bug
  })

  it('handles both sides of a DST boundary, which a fixed offset cannot', () => {
    // November bar: Berlin is on CET (+1) here but CEST (+2) in summer.
    expect(monthKeyInTimeZone(1572562800, 'Europe/Berlin')).toBe('2019-11')
    // And the most recent bar in the same series, back on CEST.
    expect(monthKeyInTimeZone(1785535200, 'Europe/Berlin')).toBe('2026-08')
  })

  it('handles a negative offset exchange', () => {
    expect(monthKeyInTimeZone(946702800, 'America/New_York')).toBe('2000-01')
    expect(monthKeyInTimeZone(1785556800, 'America/New_York')).toBe('2026-08')
  })

  it('falls back to UTC for an unknown timezone rather than throwing', () => {
    expect(monthKeyInTimeZone(946702800, 'Not/AZone')).toBe('2000-01')
  })
})
