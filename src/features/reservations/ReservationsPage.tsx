import { useEffect, useRef, useState } from 'react'
import { reservationsApi } from './api'
import { addDays, dateKey, dayLabel, mondayOf, shortDayLabel, shortWeekdayLabel, timeLabel } from './dates'
import { ReservationComposer } from './ReservationComposer'
import { ReservationPatient } from './ReservationPatient'
import { SlotFinder } from './SlotFinder'
import { groupFreeSlots, matchesTimeFilter, timeFilters, type TimeFilter } from './planning'
import { WeekOverview } from './WeekOverview'
import { therapistRelation, therapistTone } from './therapistContext'
import type { ComposerInitial, Reservation, Slot, Therapist } from './types'
import './reservations.css'



export function ReservationsPage({ ownTherapistId, initialDate = dateKey(), onDateChange }: { ownTherapistId?: number | null; initialDate?: string; onDateChange?: (date: string) => void }) {
  const [date, setDate] = useState(initialDate)
  useEffect(() => { if (date) onDateChange?.(date) }, [date, onDateChange])
  const [therapistId, setTherapistId] = useState<number | ''>(ownTherapistId ?? '')
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistsError, setTherapistsError] = useState('')
  const [therapistsLoading, setTherapistsLoading] = useState(true)
  const [metadataRevision, setMetadataRevision] = useState(0)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'fortnight' | 'search'>('day')
  const [showHistory, setShowHistory] = useState(false)
  const [duration, setDuration] = useState<45 | 60>(45)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [available, setAvailable] = useState<{ therapist: Therapist; slots: Slot[] }[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(true)
  const [availabilityError, setAvailabilityError] = useState('')
  const [revision, setRevision] = useState(0)
  const [composer, setComposer] = useState<{ key: number; initial: ComposerInitial } | null>(null)
  const [confirmation, setConfirmation] = useState<{ reservation: Reservation; action: 'excuse' | 'cancel' } | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [replacement, setReplacement] = useState<Reservation | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const submitting = useRef(false)
  const composerKey = useRef(0)

  const refresh = () => setRevision((current) => current + 1)

  useEffect(() => {
    const controller = new AbortController()
    setTherapistsLoading(true)
    setTherapistsError('')
    reservationsApi.therapists(controller.signal)
      .then(setTherapists)
      .catch((err) => { if (!controller.signal.aborted) setTherapistsError(err instanceof Error ? err.message : 'Terapeutky se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setTherapistsLoading(false) })
    return () => controller.abort()
  }, [metadataRevision])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setReservations([])
    if (!date || viewMode !== 'day') {
      setLoading(false)
      return () => controller.abort()
    }
    reservationsApi.list(date, therapistId, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setReservations(items) })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Rezervace se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [date, therapistId, revision, viewMode])

  useEffect(() => {
    const controller = new AbortController()
    setAvailabilityLoading(true)
    setAvailabilityError('')
    setAvailable([])
    if (!date || !therapists.length || viewMode !== 'day') {
      setAvailabilityLoading(false)
      return () => controller.abort()
    }
    const selected = therapists.filter((therapist) => !therapistId || Number(therapist.id) === therapistId)
    Promise.all(selected.map(async (therapist) => ({ therapist, slots: await reservationsApi.availability(therapist.id, date, duration, controller.signal) })))
      .then((items) => { if (!controller.signal.aborted) setAvailable(items) })
      .catch((err) => { if (!controller.signal.aborted) setAvailabilityError(err instanceof Error ? err.message : 'Volné termíny se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false) })
    return () => controller.abort()
  }, [date, therapistId, duration, therapists, revision, viewMode])

  function openComposer(initial: ComposerInitial) {
    setReplacement(null)
    setConfirmation(null)
    setMessage('')
    setWarnings([])
    setActionError('')
    setComposer({ key: ++composerKey.current, initial: { ...initial, search: initial.search ?? { weekdays: [], timeFilter, horizon: 14 } } })
  }

  function handleSaved(saved: Reservation[]) {
    const edited = Boolean(composer?.initial.reservation)
    setComposer(null)
    setReservations([])
    setAvailable([])
    setLoading(true)
    setAvailabilityLoading(true)
    setMessage(edited ? 'Změna rezervace byla uložena.' : `Uloženo ${saved.length} ${saved.length === 1 ? 'sezení' : 'sezení'}.`)
    setWarnings([...new Set(saved.flatMap((reservation) => reservation.warning ? [reservation.warning.message] : []))])
    if (saved[0]) {
      setDate(dateKey(saved[0].start_at))
      if (therapistId && saved.some((reservation) => reservation.therapist_id !== therapistId)) setTherapistId('')
    }
    refresh()
  }

  async function changeStatus() {
    if (!confirmation || submitting.current) return
    submitting.current = true
    setSavingStatus(true)
    setActionError('')
    try {
      const changed = await reservationsApi.changeStatus(confirmation.reservation, confirmation.action)
      setReplacement(confirmation.action === 'excuse' ? changed : null)
      setMessage(confirmation.action === 'excuse' ? 'Návštěva byla omluvena. Čas se uvolnil a návštěva se nezapočítává do limitu.' : 'Rezervace byla zrušena a čas se uvolnil.')
      setWarnings([])
      setConfirmation(null)
      refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Změnu se nepodařilo uložit.')
      setConfirmation(null)
      refresh()
    } finally { submitting.current = false; setSavingStatus(false) }
  }

  function changeDate(value: string) {
    if (value === date) return
    setReservations([])
    setAvailable([])
    setLoading(true)
    setAvailabilityLoading(true)
    setDate(value)
    setConfirmation(null)
  }

  function changeTherapist(value: number | '') {
    if (value === therapistId || savingStatus || composer) return
    setReservations([])
    setAvailable([])
    setLoading(true)
    setAvailabilityLoading(true)
    setTherapistId(value)
    setConfirmation(null)
    setReplacement(null)
    setMessage('')
    setWarnings([])
    setActionError('')
    setError('')
    setAvailabilityError('')
  }

  const weekDates = Array.from({ length: viewMode === 'fortnight' ? 10 : 5 }, (_, index) => addDays(mondayOf(date || dateKey()), index + Math.floor(index / 5) * 2))
  const therapistsInScope = therapistId ? therapists.filter((therapist) => Number(therapist.id) === therapistId) : therapists
  const selectedTherapist = therapists.find((therapist) => Number(therapist.id) === therapistId)
  const contextTone = therapistTone(therapistId, ownTherapistId)
  const scopeLabel = !therapistId ? 'Společný přehled' : contextTone === 'own' ? 'Můj plán' : contextTone === 'other' ? 'Plán kolegyně' : 'Plán terapeutky'
  const scopeName = therapistId ? selectedTherapist?.display_name ?? (therapistsLoading ? 'Načítání terapeutky…' : 'Terapeutka není dostupná') : 'Obě terapeutky'
  const canReturnOwn = ownTherapistId && therapistId !== Number(ownTherapistId) && therapists.some((item) => Number(item.id) === Number(ownTherapistId))
  const orderedTherapists = [...therapists].sort((a, b) => Number(Number(b.id) === ownTherapistId) - Number(Number(a.id) === ownTherapistId))

  return <div className="booking-page">
    <header className="booking-context booking-context--sticky" data-therapist-tone={contextTone}>
      <div className="booking-context-copy" aria-live="polite" aria-atomic="true"><p className="booking-context-label">{scopeLabel}</p><h2>{scopeName}</h2><p className="booking-context-detail">{viewMode === 'day' ? (date ? dayLabel(date) : 'Vyberte datum') : viewMode === 'search' ? 'Volné termíny' : `${viewMode === 'fortnight' ? '2 týdny' : 'Týden'} · ${shortDayLabel(weekDates[0])} – ${shortDayLabel(weekDates[weekDates.length - 1])}`}</p></div>
      {canReturnOwn && <button type="button" className="booking-context-return" disabled={savingStatus || Boolean(composer)} onClick={() => changeTherapist(Number(ownTherapistId))}>← Můj plán</button>}
    </header>
    <div className="booking-scope-controls">
      <div className="booking-therapist-switch" role="group" aria-label="Čí plán zobrazit">{orderedTherapists.map((therapist) => <button key={therapist.id} type="button" data-therapist-tone={therapistTone(Number(therapist.id), ownTherapistId)} aria-pressed={therapistId === Number(therapist.id)} disabled={therapistsLoading || savingStatus || Boolean(composer)} onClick={() => changeTherapist(Number(therapist.id))}><span className="booking-context-dot" aria-hidden="true" />{Number(therapist.id) === ownTherapistId ? 'Můj plán' : therapist.display_name}</button>)}<button type="button" data-therapist-tone="neutral" aria-pressed={!therapistId} disabled={therapistsLoading || savingStatus || Boolean(composer)} onClick={() => changeTherapist('')}>Obě</button></div>
      <button type="button" className="primary-button booking-context-book" disabled={!date || !therapists.length || Boolean(composer) || savingStatus || Boolean(therapistId && !selectedTherapist)} onClick={() => openComposer({ date, therapistId, durationMinutes: duration })}>{!therapistId ? '+ Objednat pacienta' : contextTone === 'own' ? '+ Objednat u mě' : `+ Objednat · ${scopeName}`}</button>
    </div>
    <section className={`panel booking-filters${viewMode === 'search' ? ' booking-filters--search' : ''}`} aria-label="Filtry přehledu">
      <div className="booking-view-switch" role="group" aria-label="Zobrazení">{([{ id: 'day', label: 'Den' }, { id: 'week', label: 'Týden' }, { id: 'fortnight', label: '2 týdny' }, { id: 'search', label: 'Volné termíny' }] as const).map((view) => <button key={view.id} type="button" aria-pressed={viewMode === view.id} className={`booking-chip${viewMode === view.id ? ' booking-chip--active' : ''}`} onClick={() => setViewMode(view.id)}>{view.label}</button>)}</div>
      <div className="booking-date-navigation"><button className="secondary-button" type="button" disabled={!date || savingStatus} onClick={() => changeDate(addDays(date, viewMode === 'day' ? -1 : viewMode === 'fortnight' ? -14 : -7))} aria-label="Předchozí">←</button><label className="booking-field">Datum<input className="field-control" type="date" value={date} disabled={savingStatus} onChange={(event) => changeDate(event.target.value)} /></label><button className="secondary-button" type="button" disabled={!date || savingStatus} onClick={() => changeDate(addDays(date, viewMode === 'day' ? 1 : viewMode === 'fortnight' ? 14 : 7))} aria-label="Další">→</button><button className="secondary-button" type="button" disabled={savingStatus} onClick={() => changeDate(dateKey())}>Dnes</button></div>
      <button className="ghost-button booking-refresh" type="button" disabled={loading || savingStatus} onClick={refresh}>Obnovit</button>
    </section>
    {date && viewMode === 'day' && <nav className="booking-week-strip" aria-label="Rychlý výběr dne v týdnu">
      <button type="button" className="ghost-button" disabled={savingStatus} onClick={() => changeDate(addDays(date, -7))} aria-label="Předchozí týden">‹</button>
      {weekDates.map((day) => { const active = day === date; return <button key={day} type="button" aria-pressed={active} disabled={savingStatus} className={`booking-week-day${active ? ' booking-week-day--active' : ''}${day === dateKey() ? ' booking-week-day--today' : ''}`} onClick={() => changeDate(day)}><small>{shortWeekdayLabel(day)}</small><strong>{shortDayLabel(day)}</strong></button> })}
      <button type="button" className="ghost-button" disabled={savingStatus} onClick={() => changeDate(addDays(date, 7))} aria-label="Následující týden">›</button>
    </nav>}
    {therapistsError && <div role="alert" className="error-banner">{therapistsError} <button type="button" className="ghost-button" onClick={() => setMetadataRevision((current) => current + 1)}>Zkusit znovu</button></div>}
    {!therapistsLoading && !therapistsError && therapists.length === 0 && <p className="booking-empty">Zatím nejsou dostupné terapeutky.</p>}
    {message && <p className="booking-success" role="status">{message}</p>}
    {replacement && <button type="button" className="secondary-button" onClick={() => openComposer({ date, therapistId: replacement.therapist_id, durationMinutes: replacement.duration_minutes, original: replacement })}>Vybrat náhradní termín pro {replacement.patient_name}</button>}
    {warnings.map((warning) => <p key={warning} className="booking-warning" role="status">{warning}</p>)}
    {actionError && <p className="error-banner" role="alert">{actionError}</p>}
    {composer && <ReservationComposer key={composer.key} initial={composer.initial} therapists={therapists} ownTherapistId={ownTherapistId} onClose={() => setComposer(null)} onSaved={handleSaved} onRefresh={refresh} />}
    {viewMode === 'search' ? <section className="panel"><SlotFinder therapists={therapists} initialDate={date || dateKey()} initialTherapistId={therapistId} therapistId={therapistId} onTherapistChange={changeTherapist} ownTherapistId={ownTherapistId} initialDuration={duration} revision={revision} onSelect={(slot, selectedTherapist, selectedDuration, search) => openComposer({ date: dateKey(slot.start), therapistId: selectedTherapist, durationMinutes: selectedDuration, slot, search })} /></section> : viewMode !== 'day'
      ? <WeekOverview key={`${therapistId}:${weekDates.join(',')}:${duration}:${revision}`} ownTherapistId={ownTherapistId} weekDates={weekDates} therapists={therapists} therapistId={therapistId} duration={duration} todayDate={dateKey()} revision={revision} onBook={openComposer} onSelectDay={(value) => { changeDate(value); setViewMode('day') }} />
      : <>
        <details className="booking-options"><summary>Nabídka volných časů · {duration} min{timeFilter === 'morning' ? ' · dopoledne' : timeFilter === 'afternoon' ? ' · odpoledne' : ''}</summary><div className="booking-timeline-controls">
          <label className="booking-field">Délka terapie<select className="field-control" value={duration} disabled={savingStatus} onChange={(event) => setDuration(Number(event.target.value) as 45 | 60)}><option value="45">45 minut</option><option value="60">60 minut</option></select></label>
          <div className="booking-chip-row" role="group" aria-label="Filtr podle denní doby">{timeFilters.map((filter) => <button key={filter.id} type="button" aria-pressed={timeFilter === filter.id} className={`booking-chip${timeFilter === filter.id ? ' booking-chip--active' : ''}`} onClick={() => setTimeFilter(filter.id)}>{filter.label}</button>)}</div>
        </div></details>
        {(loading || availabilityLoading) && <p role="status" className="booking-hint">Načítání plánu dne…</p>}
        {error && <div role="alert" className="error-banner">{error} <button type="button" className="ghost-button" onClick={refresh}>Zkusit znovu</button></div>}
        {availabilityError && <div role="alert" className="error-banner">{availabilityError} <button type="button" className="ghost-button" onClick={refresh}>Zkusit znovu</button></div>}
        {!date && <p className="booking-empty">Vyberte datum pro zobrazení plánu.</p>}
        {date && !loading && !error && therapistsInScope.map((therapist) => {
          const visits = reservations.filter((reservation) => Number(reservation.therapist_id) === Number(therapist.id) && (showHistory || reservation.status === 'ACTIVE'))
          const freeSlots = (availabilityLoading || availabilityError ? [] : available.find((entry) => Number(entry.therapist.id) === Number(therapist.id))?.slots ?? []).filter((slot) => matchesTimeFilter(slot, timeFilter))
          type Entry = { time: number; kind: 'reservation'; reservation: Reservation } | { time: number; kind: 'slot'; slot: Slot; slots: Slot[] }
          const entries: Entry[] = [
            ...visits.map((reservation) => ({ time: Date.parse(reservation.start_at), kind: 'reservation' as const, reservation })),
            ...groupFreeSlots(freeSlots).map((slots) => ({ time: Date.parse(slots[0].start), kind: 'slot' as const, slot: slots[0], slots })),
          ].sort((a, b) => a.time - b.time)
          return <section className="panel booking-timeline booking-therapist-group" data-therapist-tone={therapistTone(Number(therapist.id), ownTherapistId)} key={therapist.id} aria-labelledby={`booking-timeline-${therapist.id}`}>
            <div className="booking-section-heading"><h3 id={`booking-timeline-${therapist.id}`}>{therapist.display_name}<small className="booking-therapist-relation">{therapistRelation(Number(therapist.id), ownTherapistId)}</small></h3><span className="soft-label">{visits.filter((reservation) => reservation.status === 'ACTIVE').length} aktivních · {groupFreeSlots(freeSlots).length} volných úseků</span></div>
            {entries.length === 0 && <p className="booking-empty">Pro tento den, délku a filtr nejsou žádné položky. Zkuste jiný den, délku nebo denní dobu.</p>}
            <div className="booking-visits">{entries.map((entry) => entry.kind === 'slot'
              ? <details key={`slot-${entry.slot.start}`} className="booking-free-window"><summary><span><strong>{timeLabel(entry.slot.start)}–{timeLabel(entry.slots.at(-1)!.end)}</strong> · Volný úsek</span><span>Vybrat čas +</span></summary><div className="booking-slot-grid">{entry.slots.map((slot) => <button type="button" className="booking-slot" key={slot.start} disabled={Boolean(composer) || savingStatus} onClick={() => openComposer({ date, therapistId: Number(therapist.id), durationMinutes: duration, slot })}>{timeLabel(slot.start)}<small>– {timeLabel(slot.end)}</small></button>)}</div></details>
              : <article key={`visit-${entry.reservation.id}`} className={`booking-visit booking-visit--${entry.reservation.status.toLowerCase()}${entry.reservation.insurer_type_snapshot === 'INSURED' && entry.reservation.warning ? ' booking-visit--warning' : ''}`}>
                <ReservationPatient reservation={entry.reservation} disabled={savingStatus || Boolean(composer)}
                  onRefresh={() => { setWarnings([]); setMessage(''); refresh() }}
                  onMove={() => openComposer({ date: dateKey(entry.reservation.start_at), therapistId: entry.reservation.therapist_id, durationMinutes: entry.reservation.duration_minutes, reservation: entry.reservation })}
                  onReplacement={() => openComposer({ date, therapistId: entry.reservation.therapist_id, durationMinutes: entry.reservation.duration_minutes, original: entry.reservation })}
                  onRequestStatus={(action) => { setConfirmation({ reservation: entry.reservation, action }); setActionError('') }}
                  confirmation={confirmation?.reservation.id === entry.reservation.id ? confirmation.action : undefined}
                  savingStatus={savingStatus} onConfirmStatus={changeStatus} onCancelStatus={() => setConfirmation(null)} />
              </article>)}</div>
          </section>
        })}
        <label className="booking-history-toggle"><input type="checkbox" checked={showHistory} onChange={(event) => setShowHistory(event.target.checked)} /> Zobrazit také omluvené a zrušené návštěvy</label>
        <p className="booking-hint">Víkendy a české svátky se nenabízejí. Dostupnost se při uložení znovu ověří.</p>
      </>}
  </div>
}
