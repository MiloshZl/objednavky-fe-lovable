import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { reservationsApi } from './api'
import { timeLabel } from './dates'
import { insuranceLabel, shortInsuranceLabel } from './insurance'
import { PatientEditor } from './PatientEditor'
import type { PaymentMode, Reservation } from './types'

type Props = {
  reservation: Reservation; disabled: boolean; onRefresh: () => void
  onMove: () => void; onReplacement: () => void; onRequestStatus: (action: 'excuse' | 'cancel') => void
  confirmation?: 'excuse' | 'cancel'; savingStatus: boolean; onConfirmStatus: () => void; onCancelStatus: () => void
}

export function ReservationPatient({ reservation, disabled, onRefresh, onMove, onReplacement, onRequestStatus, confirmation, savingStatus, onConfirmStatus, onCancelStatus }: Props) {
  const [editing, setEditing] = useState(false)
  const [changingPayment, setChangingPayment] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('SELF_PAY')
  const [saving, setSaving] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const patient = reservation.patient
  const payer = { insurer_type: reservation.insurer_type_snapshot, insurer_code: reservation.insurer_code, insurer_name: reservation.insurer_name }
  const differentPayer = patient && (patient.insurer_type !== reservation.insurer_type_snapshot || patient.insurer_id !== reservation.insurer_id_snapshot)
  const phone = patient?.phone?.replace(/[^+\d]/g, '')
  const busy = disabled || editing || changingPayment || Boolean(confirmation)

  useEffect(() => {
    if (!menuOpen) return
    function outside(event: PointerEvent) { if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false) }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); menuButton.current?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menuOpen])

  function choose(action: () => void) { setMenuOpen(false); action() }
  async function savePayment() {
    if (submitting.current || stale || disabled) return
    submitting.current = true; setSaving(true); setError('')
    try { await reservationsApi.update(reservation, {}, paymentMode); setChangingPayment(false); onRefresh() }
    catch (err) { setError(err instanceof Error ? err.message : 'Úhradu se nepodařilo uložit.'); setStale(err instanceof ApiError && err.status === 409) }
    finally { submitting.current = false; setSaving(false) }
  }

  return <>
    <div className="booking-compact-heading">
      <div className="booking-compact-time"><strong>{timeLabel(reservation.start_at)}</strong><small>{timeLabel(reservation.end_at)} · {reservation.duration_minutes} min</small></div>
      <div className="booking-compact-name"><h4>{reservation.patient_name}</h4>{reservation.status !== 'ACTIVE' && <span className="booking-compact-status">{reservation.status === 'EXCUSED' ? 'Omluveno' : 'Zrušeno'}</span>}</div>
      <div className="booking-card-menu" ref={menuRef} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false) }}>
        <button ref={menuButton} type="button" className="booking-more" aria-label={'Akce rezervace: ' + reservation.patient_name} aria-expanded={menuOpen} aria-controls={menuId} disabled={busy} onClick={() => setMenuOpen(!menuOpen)}>⋯</button>
        {menuOpen && <div id={menuId} className="booking-card-menu-items" role="group" aria-label="Akce rezervace">
          {patient?.can_edit && <button type="button" onClick={() => choose(() => setEditing(true))}>Upravit klienta</button>}
          {reservation.status === 'ACTIVE' && <>
            <button type="button" onClick={() => choose(onMove)}>Upravit termín</button>
            <button type="button" onClick={() => choose(() => { setPaymentMode(reservation.insurer_type_snapshot === 'UNINSURED' ? 'PATIENT' : 'SELF_PAY'); setChangingPayment(true); setError(''); setStale(false) })}>Změnit úhradu</button>
            <button type="button" onClick={() => choose(() => onRequestStatus('excuse'))}>Omluvit</button>
            <button type="button" className="booking-menu-cancel" onClick={() => choose(() => onRequestStatus('cancel'))}>Zrušit rezervaci</button>
          </>}
          {reservation.status === 'EXCUSED' && <button type="button" onClick={() => choose(onReplacement)}>Náhradní termín</button>}
          {!patient?.can_edit && reservation.status === 'CANCELLED' && <span>Bez dostupných akcí</span>}
        </div>}
      </div>
    </div>
    <div className="booking-compact-meta">
      {phone && <a href={'tel:' + phone} aria-label={'Volat ' + patient?.phone}>{patient?.phone}</a>}
      {patient?.birth_year && <span title="Rok narození">{patient.birth_year}</span>}
      <span title={'Úhrada návštěvy: ' + insuranceLabel(payer)}>{shortInsuranceLabel(payer)}</span>
      {differentPayer && <span className="booking-client-insurer" title={'Pojišťovna klienta: ' + insuranceLabel(patient)}>Klient: {shortInsuranceLabel(patient)}</span>}
    </div>
    {patient?.note && (patient.note.length > 100 ? <details className="booking-compact-note"><summary>Poznámka</summary><p>{patient.note}</p></details> : <p className="booking-compact-note">{patient.note}</p>)}
    {reservation.insurer_type_snapshot === 'INSURED' && reservation.warning && <p className="booking-compact-warning" title={reservation.warning.message}>7. a další návštěva</p>}
    {confirmation && <div className="booking-confirm"><p>{confirmation === 'excuse' ? 'Omluvit návštěvu?' : 'Zrušit rezervaci?'}</p><div className="inline-actions"><button className="secondary-button" type="button" disabled={savingStatus} onClick={onConfirmStatus}>{savingStatus ? 'Ukládání…' : 'Potvrdit'}</button><button className="ghost-button" type="button" disabled={savingStatus} onClick={onCancelStatus}>Zpět</button></div></div>}
    {changingPayment && <div className="booking-payment-editor">
      <label className="booking-field">Úhrada návštěvy<select className="field-control" value={paymentMode} disabled={saving || stale} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}><option value="SELF_PAY">Bez pojišťovny</option><option value="PATIENT">Podle klienta{patient ? ': ' + shortInsuranceLabel(patient) : ''}</option></select></label>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="inline-actions">{stale ? <button type="button" className="secondary-button" onClick={onRefresh}>Obnovit kartu</button> : <button type="button" className="secondary-button" disabled={saving || disabled} onClick={savePayment}>{saving ? 'Ukládání…' : 'Uložit'}</button>}<button type="button" className="ghost-button" disabled={saving} onClick={() => setChangingPayment(false)}>Zpět</button></div>
    </div>}
    {editing && <PatientEditor patientId={reservation.patient_id} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onRefresh() }} />}
  </>
}
