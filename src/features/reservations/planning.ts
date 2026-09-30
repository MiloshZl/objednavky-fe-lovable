import { addDays, isoWeekday, overlaps, slotHour } from './dates'
import type { SessionDraft, Slot } from './types'

export type TimeFilter = 'all' | 'morning' | 'afternoon'
export const timeFilters = [{ id: 'all', label: 'Kdykoliv' }, { id: 'morning', label: 'Dopoledne' }, { id: 'afternoon', label: 'Odpoledne' }] as const
export const matchesTimeFilter = (slot: Slot, filter: TimeFilter) => filter === 'all' || (filter === 'morning' ? slotHour(slot.start) < 12 : slotHour(slot.start) >= 12)

// A horizon is calendar days, even when only Mondays are requested.
export function searchDates(start: string, days: number, weekdays: number[]) {
  return Array.from({ length: days }, (_, index) => addDays(start, index))
    .filter((date) => isoWeekday(date) <= 5 && (!weekdays.length || weekdays.includes(isoWeekday(date))))
}

export function isDraftAvailable(slot: Slot, duration: number, drafts: SessionDraft[]) {
  // One patient cannot attend overlapping appointments, including with a colleague.
  return !drafts.some((draft) => overlaps(slot.start, duration, draft.startAt, draft.durationMinutes))
}

export function groupFreeSlots(slots: Slot[]): Slot[][] {
  const groups: Slot[][] = []
  for (const slot of [...slots].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    const group = groups.at(-1)
    if (group && Date.parse(slot.start) <= Date.parse(group.at(-1)!.end)) group.push(slot)
    else groups.push([slot])
  }
  return groups
}
