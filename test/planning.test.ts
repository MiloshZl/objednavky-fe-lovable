import { describe, expect, it } from 'vitest'
import { dateKey, mondayOf } from '../src/features/reservations/dates'
import { groupFreeSlots, isDraftAvailable, matchesTimeFilter, searchDates } from '../src/features/reservations/planning'

describe('planning rules', () => {
  it('searches calendar weeks, not 30 matching Mondays', () => {
    expect(searchDates('2026-09-29', 14, [1])).toEqual(['2026-10-05', '2026-10-12'])
    expect(searchDates('2026-09-29', 14, [])).toHaveLength(10)
  })
  it('supports several weekdays and the turn of the year', () => {
    expect(searchDates('2026-12-28', 7, [1, 5])).toEqual(['2026-12-28', '2027-01-01'])
    // Holidays are excluded by authoritative API availability, never guessed here.
    expect(mondayOf('2027-01-01')).toBe('2026-12-28')
  })
  it('uses Prague noon in winter and summer', () => {
    expect(matchesTimeFilter({ start: '2026-07-01T09:45:00Z', end: '' }, 'morning')).toBe(true)
    expect(matchesTimeFilter({ start: '2026-07-01T10:00:00Z', end: '' }, 'morning')).toBe(false)
    expect(matchesTimeFilter({ start: '2026-12-01T11:00:00Z', end: '' }, 'afternoon')).toBe(true)
    expect(dateKey('2026-07-01T22:30:00Z')).toBe('2026-07-02')
  })
  it('groups alternative starts but preserves the gap over a break', () => {
    const slot = (start: string, end: string) => ({ start: '2026-10-05T' + start + ':00Z', end: '2026-10-05T' + end + ':00Z' })
    const groups = groupFreeSlots([slot('09:00', '09:45'), slot('08:15', '09:00'), slot('08:00', '08:45'), slot('11:00', '11:45')])
    expect(groups.map((group) => group.length)).toEqual([3, 1])
  })
  it('prevents overlapping appointments for one patient even across therapists', () => {
    const drafts = [{ therapistId: 2, startAt: '2026-10-05T08:00:00Z', durationMinutes: 60 as const }]
    expect(isDraftAvailable({ start: '2026-10-05T08:45:00Z', end: '' }, 45, drafts)).toBe(false)
    expect(isDraftAvailable({ start: '2026-10-05T09:00:00Z', end: '' }, 45, drafts)).toBe(true)
  })
})
