import { useEffect, useState } from 'react'
import { reservationsApi } from './api'
import { addDays, dayLabel, shortDayLabel, timeLabel } from './dates'
import { isDraftAvailable, matchesTimeFilter, searchDates, timeFilters, type TimeFilter } from './planning'
import type { ComposerInitial, SessionDraft, Slot, Therapist } from './types'
import { therapistRelation, therapistTone } from './therapistContext'

type Result = { queryKey: string; date: string; therapist: Therapist; slots: Slot[]; error?: string }
type Props = {
  therapists: Therapist[]; initialDate: string; initialTherapistId: number | ''; initialDuration: 45 | 60
  drafts?: SessionDraft[]; excludeReservationId?: number; disabled?: boolean; revision?: number
  initialSearch?: ComposerInitial['search']
  therapistId?: number | ''; onTherapistChange?: (id: number | '') => void; ownTherapistId?: number | null
  onSelect: (slot: Slot, therapistId: number, duration: 45 | 60, search: NonNullable<ComposerInitial['search']>) => void
}

export function SlotFinder({ therapists, initialDate, initialTherapistId, initialDuration, initialSearch, drafts = [], excludeReservationId, disabled, revision = 0, onSelect, therapistId: controlledTherapistId, onTherapistChange, ownTherapistId }: Props) {
  const [date, setDate] = useState(initialDate)
  const [localTherapistId, setTherapistId] = useState<number | ''>(initialTherapistId)
  const therapistId = controlledTherapistId ?? localTherapistId
  const [duration, setDuration] = useState(initialDuration)
  const [weekdays, setWeekdays] = useState<number[]>(initialSearch?.weekdays ?? [])
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialSearch?.timeFilter ?? 'all')
  const [horizon, setHorizon] = useState(initialSearch?.horizon ?? 14)
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const weekdayKey = weekdays.join(',')
  const queryKey = JSON.stringify([date, therapistId, duration, weekdayKey, horizon, revision, retry, excludeReservationId])

  useEffect(() => {
    const controller = new AbortController()
    setResults([])
    setLoading(Boolean(date && therapists.length))
    if (!date || !therapists.length) return () => controller.abort()
    const tasks = searchDates(date, horizon, weekdayKey ? weekdayKey.split(',').map(Number) : [])
      .flatMap((day) => therapists.filter((therapist) => !therapistId || Number(therapist.id) === therapistId).map((therapist) => ({ date: day, therapist })))
    // Bound parallel requests to avoid flooding the API on a mobile connection.
    let cursor = 0
    const worker = async () => {
      while (cursor < tasks.length && !controller.signal.aborted) {
        const task = tasks[cursor++]
        try {
          const slots = await reservationsApi.availability(Number(task.therapist.id), task.date, duration, controller.signal, excludeReservationId)
          if (!controller.signal.aborted) setResults((current) => [...current, { ...task, queryKey, slots }])
        } catch (error) {
          if (!controller.signal.aborted) setResults((current) => [...current, { ...task, queryKey, slots: [], error: error instanceof Error ? error.message : 'Termíny se nepodařilo načíst.' }])
        }
      }
    }
    const timeout = window.setTimeout(() => {
      void Promise.all([worker(), worker(), worker()]).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [date, therapistId, duration, weekdayKey, horizon, therapists, excludeReservationId, revision, retry, queryKey])

  const currentResults = results.filter((result) => result.queryKey === queryKey)
  const visible = currentResults.map((result) => ({ ...result, slots: result.slots.filter((slot) => matchesTimeFilter(slot, timeFilter) && isDraftAvailable(slot, duration, drafts)) }))
    .filter((result) => result.slots.length)
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.therapist.id) - Number(b.therapist.id))
  const failed = currentResults.filter((result) => result.error)

  return <section className="booking-finder" aria-label="Hledání volných termínů">
    <fieldset className="booking-fieldset" disabled={disabled}>
      <div className="booking-form-grid">
        <label className="booking-field">U koho<select className="field-control" value={therapistId} onChange={(event) => { const value = event.target.value ? Number(event.target.value) : ''; if (onTherapistChange) onTherapistChange(value); else setTherapistId(value) }}><option value="">Obě terapeutky</option>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.display_name}{therapistRelation(Number(therapist.id), ownTherapistId)}</option>)}</select></label>
        <label className="booking-field">Délka návštěvy<select className="field-control" value={duration} onChange={(event) => setDuration(Number(event.target.value) as 45 | 60)}><option value="45">45 minut</option><option value="60">60 minut</option></select></label>
        <label className="booking-field">Hledat od<input type="date" className="field-control" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label className="booking-field">Období<select className="field-control" value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}><option value="14">2 týdny</option><option value="28">4 týdny</option></select></label>
      </div>
      <p className="booking-filter-label">Které dny klientovi vyhovují?</p>
      <div className="booking-chip-row" role="group" aria-label="Dny návštěvy"><button type="button" className={`booking-chip${!weekdays.length ? ' booking-chip--active' : ''}`} aria-pressed={!weekdays.length} onClick={() => setWeekdays([])}>Kterýkoliv</button>{['Po', 'Út', 'St', 'Čt', 'Pá'].map((label, index) => <button type="button" key={label} aria-pressed={weekdays.includes(index + 1)} className={`booking-chip${weekdays.includes(index + 1) ? ' booking-chip--active' : ''}`} onClick={() => setWeekdays((current) => current.includes(index + 1) ? current.filter((day) => day !== index + 1) : [...current, index + 1].sort())}>{label}</button>)}</div>
      <div className="booking-chip-row" role="group" aria-label="Část dne">{timeFilters.map((filter) => <button type="button" key={filter.id} aria-pressed={timeFilter === filter.id} className={`booking-chip${timeFilter === filter.id ? ' booking-chip--active' : ''}`} onClick={() => setTimeFilter(filter.id)}>{filter.label}</button>)}</div>
    </fieldset>
    <p className="booking-hint">Dopoledne = začátek před 12:00. Nabídky časů se mohou překrývat; nejde o počet samostatných návštěv.</p>
    {!date && <p className="booking-empty">Zvolte datum, od kterého chcete hledat.</p>}
    {loading && <p role="status" className="booking-hint">Hledám volné termíny…</p>}
    {failed.length > 0 && <div role="alert" className="error-banner">Část dnů se nepodařilo ověřit. Zobrazené časy pocházejí z načtených dnů. <button type="button" className="ghost-button" disabled={disabled || loading} onClick={() => setRetry((current) => current + 1)}>Načíst znovu</button></div>}
    {!loading && date && !visible.length && <p className="booking-empty">{failed.length ? 'Pro nenačtené dny dostupnost neznáme.' : 'V tomto období nejsou termíny odpovídající výběru.'} Zkuste obě terapeutky, jiné dny nebo další období.</p>}
    <div className="booking-search-results">{visible.map((result) => <section className="booking-search-day booking-therapist-group" data-therapist-tone={therapistTone(Number(result.therapist.id), ownTherapistId)} key={`${result.date}-${result.therapist.id}`}><div className="booking-section-heading"><h4>{dayLabel(result.date)}</h4><span>{result.therapist.display_name}{therapistRelation(Number(result.therapist.id), ownTherapistId)}</span></div><div className="booking-slot-grid">{result.slots.map((slot) => <button key={slot.start} type="button" className="booking-slot" disabled={disabled} onClick={() => onSelect(slot, Number(result.therapist.id), duration, { weekdays, timeFilter, horizon })} aria-label={`${dayLabel(result.date)}, ${result.therapist.display_name}, ${timeLabel(slot.start)} až ${timeLabel(slot.end)}`}>{timeLabel(slot.start)}<small>– {timeLabel(slot.end)}</small></button>)}</div></section>)}</div>
    {date && <div className="booking-search-footer"><span>{shortDayLabel(date)} – {shortDayLabel(addDays(date, horizon - 1))}</span><button type="button" className="secondary-button" disabled={disabled || loading} onClick={() => setDate(addDays(date, horizon))}>Další {horizon === 14 ? '2' : '4'} týdny →</button></div>}
  </section>
}
