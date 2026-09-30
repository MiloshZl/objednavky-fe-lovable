import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../../api/client'
import { reservationsApi } from './api'
import { PatientDetails } from './PatientDetails'
import { PatientEditor } from './PatientEditor'
import type { Patient, PatientChoice } from './types'

type Props = { value: PatientChoice | null; onChange: (patient: PatientChoice | null) => void; therapistId: number; disabled: boolean; onEditingChange?: (editing: boolean) => void }

export function PatientPicker({ value, onChange, therapistId, disabled, onEditingChange }: Props) {
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(false)
  useEffect(() => { onEditingChange?.(editing); return () => onEditingChange?.(false) }, [editing, onEditingChange])

  useEffect(() => {
    if (value || creating) return
    const controller = new AbortController()
    setLoading(true)
    setPatients([])
    setError('')
    const timeout = window.setTimeout(() => {
      reservationsApi.patients(query, controller.signal)
        .then(setPatients)
        .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Pacienty se nepodařilo načíst.') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { controller.abort(); window.clearTimeout(timeout) }
  }, [query, value, creating, retry])

  if (value) return <section className="booking-patient-summary"><div className="booking-selected-patient"><div><small>Pacient</small><strong>{value.name}</strong></div><button className="ghost-button" type="button" disabled={disabled || editing} onClick={() => { setEditing(false); onChange(null) }}>Změnit pacienta</button></div>
    {value.details && <PatientDetails patient={value.details} />}
    {value.details?.can_edit && !editing && <button className="booking-subtle-action" type="button" disabled={disabled} onClick={() => setEditing(true)}>Upravit klienta</button>}
    {editing && <PatientEditor patientId={value.id} onClose={() => setEditing(false)} onSaved={(details) => { onChange({ id: details.id, name: `${details.first_name} ${details.last_name}`, details }); setEditing(false) }} />}
  </section>

  if (creating) return <NewPatient therapistId={therapistId} onCancel={() => setCreating(false)} onCreated={(patient) => { onChange(patient); setCreating(false) }} />

  return <section className="booking-patient-picker" aria-label="Výběr pacienta">
    <div className="booking-section-heading"><h4>1. Vyberte pacienta</h4><button className="ghost-button" type="button" disabled={disabled} onClick={() => setCreating(true)}>+ Nový pacient</button></div>
    <label className="booking-field">Hledat podle jména, příjmení nebo telefonu<input className="field-control" type="search" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" disabled={disabled} /></label>
    {loading && <p role="status" className="booking-hint">Načítání pacientů…</p>}
    {error && <div className="error-banner" role="alert">{error} <button className="ghost-button" type="button" onClick={() => setRetry((current) => current + 1)}>Zkusit znovu</button></div>}
    {!loading && !error && patients.length === 0 && <p className="booking-hint">Žádný pacient neodpovídá hledání. Můžete založit nového.</p>}
    {!loading && !error && <div className="booking-patient-results">{patients.map((patient) => <button key={patient.id} type="button" disabled={disabled} className="booking-patient-result" onClick={() => onChange({ id: patient.id, name: `${patient.first_name} ${patient.last_name}`, details: patient })}>
      <strong>{patient.last_name} {patient.first_name}</strong>
      <span>{patient.birth_year ?? 'Rok neuveden'} · {patient.insurer_type === 'UNINSURED' ? 'Bez pojišťovny' : patient.insurer_code ?? 'Pojištěný'} · {patient.phone}</span>
    </button>)}</div>}
    {!loading && patients.length >= 50 && <p className="booking-hint">Zobrazeno prvních 50 pacientů. Zpřesněte hledání.</p>}
  </section>
}

function NewPatient({ therapistId, onCancel, onCreated }: { therapistId: number; onCancel: () => void; onCreated: (patient: PatientChoice) => void }) {
  const [insurers, setInsurers] = useState<{ id: number; code: string; name: string }[]>([])
  const [insurersLoading, setInsurersLoading] = useState(true)
  const [insurersError, setInsurersError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [insurance, setInsurance] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    apiFetch<typeof insurers>('/insurers/contracted', { signal: controller.signal })
      .then(setInsurers)
      .catch((err) => { if (!controller.signal.aborted) setInsurersError(err instanceof Error ? err.message : 'Pojišťovny se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setInsurersLoading(false) })
    return () => controller.abort()
  }, [])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const patient = await apiFetch<{ id: number; firstName: string; lastName: string }>('/patients', { method: 'POST', body: JSON.stringify({
        firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), birthYear: birthYear ? Number(birthYear) : null,
        insurerType: insurance === 'uninsured' ? 'UNINSURED' : 'INSURED', insurerId: insurance === 'uninsured' ? null : Number(insurance), therapistId, note: note.trim() || null,
      }) })
      const insurer = insurers.find((item) => Number(item.id) === Number(insurance))
      onCreated({ id: patient.id, name: `${patient.firstName} ${patient.lastName}`, details: { id: patient.id, first_name: patient.firstName, last_name: patient.lastName, phone: phone.trim(), birth_year: birthYear ? Number(birthYear) : null, insurer_type: insurance === 'uninsured' ? 'UNINSURED' : 'INSURED', insurer_id: insurance === 'uninsured' ? null : Number(insurance), insurer_code: insurer?.code ?? null, insurer_name: insurer?.name ?? null, note: note.trim() || null, can_edit: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pacienta se nepodařilo uložit.')
    } finally { submitting.current = false; setSaving(false) }
  }

  return <form onSubmit={save} className="booking-new-patient">
    <h4>Nový pacient</h4>
    <fieldset disabled={saving} className="booking-fieldset">
      <div className="booking-form-grid">
        <label className="booking-field">Jméno<input className="field-control" required maxLength={100} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="off" /></label>
        <label className="booking-field">Příjmení<input className="field-control" required maxLength={100} value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="off" /></label>
        <label className="booking-field">Telefon<input className="field-control" required type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="off" /></label>
        <label className="booking-field">Pojišťovna<select className="field-control" required value={insurance} onChange={(event) => setInsurance(event.target.value)}><option value="">Zvolte pojišťovnu nebo samoplátce</option><option value="uninsured">Bez pojišťovny</option>{insurers.map((insurer) => <option key={insurer.id} value={insurer.id}>{insurer.code} – {insurer.name}</option>)}</select></label>
        <label className="booking-field">Rok narození{insurance === 'uninsured' ? ' (nepovinný)' : ''}<input className="field-control" type="number" inputMode="numeric" min="1900" max={new Date().getFullYear()} required={insurance !== 'uninsured'} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} autoComplete="off" /></label>
        <label className="booking-field">Rozlišovací poznámka (nepovinná)<input className="field-control" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} autoComplete="off" /></label>
      </div>
      {insurersLoading && <p className="booking-hint" role="status">Načítání smluvních pojišťoven…</p>}
      {insurersError && <p className="error-banner" role="alert">{insurersError} Pro pojištěného pacienta zavřete formulář a zkuste jej otevřít znovu.</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="inline-actions"><button className="secondary-button" type="submit">{saving ? 'Ukládání…' : 'Uložit a vybrat pacienta'}</button><button className="ghost-button" type="button" onClick={onCancel}>Zpět k výběru</button></div>
    </fieldset>
    <p className="booking-hint">Pacient se uloží samostatně. Rezervace vzniknou až po potvrzení vybraných termínů.</p>
  </form>
}
