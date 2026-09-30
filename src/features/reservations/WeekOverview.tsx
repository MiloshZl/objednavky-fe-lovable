import { useEffect, useState } from 'react'
import { reservationsApi } from './api'
import { shortDayLabel, shortWeekdayLabel, timeLabel } from './dates'
import type { ComposerInitial, Reservation, Slot, Therapist } from './types'
import { therapistRelation, therapistTone } from './therapistContext'

type DaySummary = { date: string; reservations: Reservation[]; available: { therapist: Therapist; slots: Slot[] }[]; error?: string }

export function WeekOverview({ weekDates, therapists, therapistId, duration, todayDate, revision, onSelectDay, onBook, ownTherapistId }: {
  weekDates: string[]; therapists: Therapist[]; therapistId: number | ''; duration: 45 | 60
  todayDate: string; revision: number; onSelectDay: (date: string) => void; onBook: (initial: ComposerInitial) => void
  ownTherapistId?: number | null
}) {
  const [summaries, setSummaries] = useState<DaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const weekKey = weekDates.join(',')

  useEffect(() => {
    const controller = new AbortController()
    setSummaries([])
    const scoped = therapists.filter((therapist) => !therapistId || Number(therapist.id) === therapistId)
    setLoading(Boolean(scoped.length))
    if (!scoped.length) return () => controller.abort()
    const dates = weekKey.split(',')
    // Load one day at a time; a fortnight never creates a burst of 30 requests.
    void (async () => {
      for (const date of dates) {
        if (controller.signal.aborted) return
        try {
          const [reservations, available] = await Promise.all([
            reservationsApi.list(date, therapistId, controller.signal),
            Promise.all(scoped.map(async (therapist) => ({ therapist, slots: await reservationsApi.availability(Number(therapist.id), date, duration, controller.signal) }))),
          ])
          if (!controller.signal.aborted) setSummaries((current) => [...current, { date, reservations, available }])
        } catch (error) {
          if (!controller.signal.aborted) setSummaries((current) => [...current, { date, reservations: [], available: [], error: error instanceof Error ? error.message : 'Den se nepodařilo načíst.' }])
        }
      }
      if (!controller.signal.aborted) setLoading(false)
    })()
    return () => controller.abort()
  }, [weekKey, therapistId, duration, therapists, revision, retry])

  return <section className="booking-week-overview" aria-label="Přehled návštěv v týdnu">
    {loading && <p role="status" className="booking-hint">Načítání plánu…</p>}
    <div className="booking-week-grid">{weekDates.map((date) => {
      const summary = summaries.find((entry) => entry.date === date)
      return <article key={date} className={'booking-week-card' + (date === todayDate ? ' booking-week-card--today' : '')}>
        <button type="button" className="booking-week-card-heading ghost-button" onClick={() => onSelectDay(date)} aria-label={'Otevřít den ' + shortDayLabel(date)}><small>{shortWeekdayLabel(date)}</small><strong>{shortDayLabel(date)}</strong>{date === todayDate && <span>Dnes</span>}</button>
        {!summary && <p className="booking-hint">{therapists.length ? 'Načítání…' : 'Nejsou dostupné terapeutky.'}</p>}
        {summary?.error && <div className="error-banner" role="alert">{summary.error}<button type="button" className="ghost-button" disabled={loading} onClick={() => setRetry((value) => value + 1)}>Zkusit znovu</button></div>}
        {summary?.available.map(({ therapist, slots }) => {
          const visits = summary.reservations.filter((visit) => Number(visit.therapist_id) === Number(therapist.id) && visit.status === 'ACTIVE')
          return <div key={therapist.id} className="booking-week-card-row booking-therapist-group" data-therapist-tone={therapistTone(Number(therapist.id), ownTherapistId)}>
            <strong>{therapist.display_name}{therapistRelation(Number(therapist.id), ownTherapistId)}</strong>
            {!visits.length && <p className="booking-hint">Bez objednaných návštěv</p>}
            {visits.map((visit) => <button type="button" key={visit.id} className="booking-week-visit" onClick={() => onSelectDay(date)}><time>{timeLabel(visit.start_at)}</time><span>{visit.patient_name}{visit.warning && <small>⚑ 7. a další návštěva</small>}</span></button>)}
            {slots[0] ? <button className="secondary-button" type="button" onClick={() => onBook({ date, therapistId: Number(therapist.id), durationMinutes: duration, slot: slots[0] })}>+ Volno {timeLabel(slots[0].start)}</button> : <p className="booking-hint">Bez volného termínu pro {duration} min</p>}
            <button type="button" className="ghost-button" onClick={() => onSelectDay(date)}>Zobrazit den →</button>
          </div>
        })}
      </article>
    })}</div>
  </section>
}
