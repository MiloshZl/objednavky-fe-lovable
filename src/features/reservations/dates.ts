const zone = 'Europe/Prague'

export function dateKey(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const get = (key: string) => parts.find((part) => part.type === key)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function addDays(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

export function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
}

export function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function sessionLabel(value: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function overlaps(start: string, duration: number, otherStart: string, otherDuration: number): boolean {
  const first = new Date(start).getTime()
  const second = new Date(otherStart).getTime()
  return first < second + otherDuration * 60000 && second < first + duration * 60000
}

export function isoWeekday(date: string): number {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export function mondayOf(date: string): string {
  return addDays(date, -(isoWeekday(date) - 1))
}

export function shortWeekdayLabel(date: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, weekday: 'short' }).format(new Date(`${date}T12:00:00Z`))
}

export function shortDayLabel(date: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, day: 'numeric', month: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
}

export function slotHour(value: string): number {
  return Number(new Intl.DateTimeFormat('cs-CZ', { timeZone: zone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(value)))
}
