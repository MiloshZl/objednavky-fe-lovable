import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { reservationsApi } from './api'
import { sessionLabel } from './dates'
import { PatientPicker } from './PatientPicker'
import { PatientDetails } from './PatientDetails'
import { insuranceLabel } from './insurance'
import { SlotFinder } from './SlotFinder'
import { isDraftAvailable } from './planning'
import { therapistRelation, therapistTone } from './therapistContext'
import type { ComposerInitial, PatientChoice, PaymentMode, Reservation, SessionDraft, Therapist } from './types'

type Props = {
  initial: ComposerInitial; therapists: Therapist[]; ownTherapistId?: number | null
  onClose: () => void; onSaved: (reservations: Reservation[]) => void; onRefresh: () => void
}

export function ReservationComposer({ initial, therapists, ownTherapistId, onClose, onSaved, onRefresh }: Props) {
  const source = initial.reservation ?? initial.original
  const [bookingTherapistId, setBookingTherapistId] = useState<number | ''>(source?.therapist_id ?? initial.therapistId)
  const [searchTherapistId, setSearchTherapistId] = useState<number | ''>(source?.therapist_id ?? initial.therapistId)
  const [patient, setPatient] = useState<PatientChoice | null>(source ? { id: source.patient_id, name: source.patient_name, details: source.patient } : null)
  const [paymentMode, setPaymentMode] = useState<PaymentMode | ''>('')
  const [patientEditing, setPatientEditing] = useState(false)
  const [drafts, setDrafts] = useState<SessionDraft[]>(initial.reservation
    ? [{ therapistId: initial.reservation.therapist_id, startAt: initial.reservation.start_at, durationMinutes: initial.reservation.duration_minutes }]
    : initial.slot && initial.therapistId ? [{ therapistId: initial.therapistId, startAt: initial.slot.start, durationMinutes: initial.durationMinutes }] : [])
  const [choosing, setChoosing] = useState(!initial.slot)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [discard, setDiscard] = useState(false)
  const [conflict, setConflict] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const single = Boolean(source)
  const targetIds = [...new Set(drafts.length ? drafts.map((draft) => draft.therapistId) : searchTherapistId ? [searchTherapistId] : [])]
  const targetNames = targetIds.map((id) => therapists.find((therapist) => Number(therapist.id) === id)?.display_name ?? 'Terapeutka není dostupná')
  const contextTone = therapistTone(targetIds.length === 1 ? targetIds[0] : '', ownTherapistId)
  const contextLabel = targetIds.length > 1 ? 'Objednáváte do obou plánů' : !targetIds.length ? 'Výběr terapeutky' : contextTone === 'own' ? 'Objednáváte do svého plánu' : contextTone === 'other' ? 'Objednáváte ke kolegyni' : 'Terapeutka návštěvy'

  useEffect(() => {
    const dialog = dialogRef.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus() }
  }, [])

  function close() {
    if (saving || patientEditing) return
    if (patient || drafts.length) setDiscard(true)
    else onClose()
  }

  async function save() {
    if (!bookingTherapistId || !patient || !drafts.length || submitting.current || conflict || patientEditing) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const saved = initial.reservation
        ? [await reservationsApi.update(initial.reservation, drafts[0], paymentMode || undefined)]
        : await reservationsApi.create(patient.id, drafts, initial.original?.id, paymentMode || undefined)
      onSaved(saved)
    } catch (err) {
      const isConflict = err instanceof ApiError && err.status === 409
      setConflict(isConflict)
      setError((err instanceof Error ? err.message : 'Rezervaci se nepodařilo uložit.') + (isConflict ? ' Data se mezitím změnila. Vyberte termíny znovu; pacient zůstane vybraný.' : ''))
      setRevision((current) => current + 1)
      onRefresh()
    } finally { submitting.current = false; setSaving(false) }
  }

  return <dialog ref={dialogRef} className="booking-dialog" aria-labelledby="booking-composer-heading" onCancel={(event) => { event.preventDefault(); close() }}>
    <div className="booking-composer">
      <div className="booking-section-heading"><div><p className="eyebrow">{initial.reservation ? 'Změna termínu' : initial.original ? 'Náhradní návštěva' : 'Nová rezervace'}</p><h3 id="booking-composer-heading" tabIndex={-1} autoFocus>{initial.reservation ? 'Přesunout návštěvu' : 'Objednat pacienta'}</h3></div><button className="ghost-button" type="button" disabled={saving || patientEditing} onClick={close}>Zavřít</button></div>
      <div className="booking-context booking-context--composer" data-therapist-tone={contextTone} aria-live="polite" aria-atomic="true"><div className="booking-context-copy"><p className="booking-context-label">{contextLabel}</p><strong>{targetNames.join(' + ') || (bookingTherapistId ? 'Obě terapeutky' : 'Vyberte terapeutku')}</strong></div></div>
      {discard && <div className="booking-confirm" role="alert"><p>Zavřít rozpracovanou rezervaci? Vybrané termíny se neuloží.</p><div className="inline-actions"><button className="secondary-button" type="button" onClick={() => setDiscard(false)}>Pokračovat v objednání</button><button className="ghost-button" type="button" onClick={onClose}>Zahodit výběr</button></div></div>}
      {!bookingTherapistId && <label className="booking-field">Terapeutka pro objednání<select className="field-control" value="" onChange={(event) => { const id = Number(event.target.value); if (therapists.some((therapist) => Number(therapist.id) === id)) { setBookingTherapistId(id); setSearchTherapistId(id); setChoosing(true) } }}><option value="">Vyberte terapeutku</option>{therapists.map((therapist) => <option key={therapist.id} value={therapist.id}>{therapist.display_name}{therapistRelation(Number(therapist.id), ownTherapistId)}</option>)}</select></label>}
      {bookingTherapistId !== '' && <>
      {source ? <div className="booking-selected-patient"><div><small>Pacient</small><strong>{source.patient_name}</strong><span>{initial.original ? 'Omluvená návštěva' : 'Původní termín'}: {sessionLabel(source.start_at)}</span></div></div>
        : <PatientPicker value={patient} onChange={(value) => { if (value?.id !== patient?.id) setPaymentMode(''); setPatient(value) }} therapistId={ownTherapistId ?? bookingTherapistId} disabled={saving} onEditingChange={setPatientEditing} />}
      {source?.patient && <PatientDetails patient={source.patient} />}
      {patient && <label className="booking-field">Úhrada {initial.reservation ? 'návštěvy' : 'vybraných návštěv'}<select className="field-control" value={paymentMode} disabled={saving} onChange={(event) => setPaymentMode(event.target.value as PaymentMode | '')}>
        <option value="">{initial.reservation ? `Ponechat: ${insuranceLabel({ insurer_type: initial.reservation.insurer_type_snapshot, insurer_code: initial.reservation.insurer_code, insurer_name: initial.reservation.insurer_name })}` : `Podle klienta${patient.details ? ': ' + insuranceLabel(patient.details) : ''}`}</option>
        <option value="SELF_PAY">Bez pojišťovny</option>
        {initial.reservation && <option value="PATIENT">Podle aktuální pojišťovny klienta{patient.details ? ': ' + insuranceLabel(patient.details) : ''}</option>}
      </select></label>}
      <section className="booking-drafts" aria-label="Vybrané termíny">
        <div className="booking-section-heading"><h4>Vybrané termíny <span className="soft-label">{drafts.length}/{single ? 1 : 6}</span></h4>{!choosing && <button type="button" className="secondary-button" disabled={saving} onClick={() => setChoosing(true)}>{single ? 'Změnit čas' : '+ Další termín'}</button>}</div>
        {!drafts.length && <p className="booking-hint">Vyberte čas z nabídky níže. {single ? '' : 'Pacienta stačí vybrat jednou pro všech 6 návštěv.'}</p>}
        <ol>{drafts.map((draft, index) => <li className="booking-therapist-group" data-therapist-tone={therapistTone(draft.therapistId, ownTherapistId)} key={draft.therapistId + '-' + draft.startAt}><div><strong>{sessionLabel(draft.startAt)}</strong><span>{therapists.find((therapist) => Number(therapist.id) === draft.therapistId)?.display_name}{therapistRelation(draft.therapistId, ownTherapistId)} · {draft.durationMinutes} min</span></div><button type="button" className="ghost-button" disabled={saving} aria-label={'Odebrat termín ' + sessionLabel(draft.startAt)} onClick={() => { setDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index)); setChoosing(true) }}>Odebrat</button></li>)}</ol>
        <p role="status" className="booking-hint">{drafts.length === 6 ? 'Máte vybráno všech 6 termínů. Můžete je uložit.' : drafts.length ? 'Termíny jsou připravené. Potvrďte je tlačítkem dole.' : ''}</p>
      </section>
      {error && <div role="alert" className="error-banner">{error}{conflict && (initial.reservation ? <button className="secondary-button" type="button" onClick={onClose}>Zpět k aktuálnímu plánu</button> : <button className="secondary-button" type="button" onClick={() => { setDrafts([]); setConflict(false); setError(''); setChoosing(true) }}>Vybrat aktuálně volné časy</button>)}</div>}
      {choosing && <SlotFinder therapists={therapists} initialDate={initial.date} initialTherapistId={searchTherapistId} therapistId={searchTherapistId} onTherapistChange={setSearchTherapistId} ownTherapistId={ownTherapistId} initialDuration={initial.durationMinutes} initialSearch={initial.search} drafts={single ? [] : drafts} excludeReservationId={initial.reservation?.id} revision={revision} disabled={saving || conflict || (!single && drafts.length >= 6)} onSelect={(slot, therapistId, durationMinutes) => {
        setDrafts((current) => single ? [{ therapistId, startAt: slot.start, durationMinutes }] : current.length < 6 && isDraftAvailable(slot, durationMinutes, current) ? [...current, { therapistId, startAt: slot.start, durationMinutes }] : current)
        setError('')
        if (single) setChoosing(false)
      }} />}
      </>}
      <div className="booking-save-bar"><div><strong>{patient ? patient.name : !bookingTherapistId ? 'Nejdřív vyberte terapeutku' : 'Nejdřív vyberte pacienta'} · {drafts.length} termínů</strong><p className="booking-hint">{patientEditing ? 'Nejdřív dokončete úpravu klienta.' : drafts.length ? targetNames.join(' + ') : 'Vyberte termín pro objednání.'}</p></div><button className="primary-button" type="button" disabled={saving || patientEditing || conflict || !bookingTherapistId || !patient || !drafts.length} onClick={save}>{saving ? 'Ukládání…' : initial.reservation ? 'Uložit změnu' : 'Potvrdit objednání (' + drafts.length + ')'}</button></div>
    </div>
  </dialog>
}
