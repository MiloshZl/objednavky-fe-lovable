import { useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../../api/client'
import type { Patient } from './types'

type Insurer = { id: number; code: string; name: string }

export function PatientEditor({ patientId, onClose, onSaved }: { patientId: number; onClose: () => void; onSaved: (patient: Patient) => void }) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [original, setOriginal] = useState<Patient | null>(null)
  const [correctIdentity, setCorrectIdentity] = useState(false)
  const [insurers, setInsurers] = useState<Insurer[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [stale, setStale] = useState(false)
  const [retry, setRetry] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([apiFetch<Patient>(`/patients/${patientId}`, { signal: controller.signal }), apiFetch<Insurer[]>('/insurers/contracted', { signal: controller.signal })])
      .then(([data, options]) => { if (!controller.signal.aborted) { setPatient(data); setOriginal(data); setCorrectIdentity(false); setInsurers(options) } })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Údaje se nepodařilo načíst.') })
    return () => controller.abort()
  }, [patientId, retry])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!patient || stale || submitting.current || (needsConfirmation && !correctIdentity)) return
    submitting.current = true; setSaving(true); setError('')
    try {
      const updated = await apiFetch<{ firstName: string; lastName: string; phone: string; birthYear: number | null; insurerType: Patient['insurer_type']; insurerId: number | null; note: string | null }>(`/patients/${patientId}`, { method: 'PATCH', body: JSON.stringify({
        firstName: patient.first_name, lastName: patient.last_name, phone: patient.phone, birthYear: patient.birth_year,
        insurerType: patient.insurer_type, insurerId: patient.insurer_id, note: patient.note,
        expectedUpdatedAt: patient.updated_at,
        ...(needsConfirmation ? { correctIdentity } : {}),
      }) })
      const insurer = insurers.find((item) => Number(item.id) === updated.insurerId)
      onSaved({ ...patient, first_name: updated.firstName, last_name: updated.lastName, phone: updated.phone,
        birth_year: updated.birthYear, insurer_type: updated.insurerType, insurer_id: updated.insurerId,
        insurer_code: insurer?.code ?? null, insurer_name: insurer?.name ?? null, note: updated.note })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Údaje se nepodařilo uložit.')
      setStale(err instanceof ApiError && err.code === 'PATIENT_STALE')
      if (err instanceof ApiError && err.code === 'PATIENT_IDENTITY_CONFIRM_REQUIRED') {
        setPatient((current) => current ? { ...current, has_reservations: true } : current)
      }
    } finally { submitting.current = false; setSaving(false) }
  }

  const identityChanged = Boolean(patient && original && (patient.first_name.trim() !== original.first_name
    || patient.last_name.trim() !== original.last_name || patient.birth_year !== original.birth_year))
  const needsConfirmation = Boolean(patient?.has_reservations && identityChanged)

  return <form className="booking-patient-editor" onSubmit={save} aria-label="Úprava klienta">
    <h4>Upravit klienta</h4>
    {!patient && !error && <p role="status">Načítání údajů klienta…</p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    {patient && <fieldset className="booking-fieldset" disabled={saving || stale}>
      <div className="booking-form-grid">
        <label className="booking-field">Jméno<input className="field-control" required maxLength={120} value={patient.first_name} onChange={(e) => setPatient({ ...patient, first_name: e.target.value })} /></label>
        <label className="booking-field">Příjmení<input className="field-control" required maxLength={120} value={patient.last_name} onChange={(e) => setPatient({ ...patient, last_name: e.target.value })} /></label>
        <label className="booking-field">Telefon<input className="field-control" type="tel" required maxLength={32} value={patient.phone} onChange={(e) => setPatient({ ...patient, phone: e.target.value })} /></label>
        <label className="booking-field">Rok narození<input className="field-control" type="number" min={1900} max={new Date().getFullYear()} required={patient.insurer_type === 'INSURED'} value={patient.birth_year ?? ''} onChange={(e) => setPatient({ ...patient, birth_year: e.target.value ? Number(e.target.value) : null })} /></label>
        <label className="booking-field">Pojišťovna klienta<select className="field-control" value={patient.insurer_type === 'UNINSURED' ? 'uninsured' : String(patient.insurer_id)} onChange={(e) => setPatient({ ...patient, insurer_type: e.target.value === 'uninsured' ? 'UNINSURED' : 'INSURED', insurer_id: e.target.value === 'uninsured' ? null : Number(e.target.value) })}>
          <option value="uninsured">Bez pojišťovny</option>
          {patient.insurer_id && !insurers.some((item) => Number(item.id) === patient.insurer_id) && <option value={patient.insurer_id}>Uložená pojišťovna (nyní nesmluvní)</option>}
          {insurers.map((item) => <option key={item.id} value={item.id}>{item.code} – {item.name}</option>)}
        </select></label>
        <label className="booking-field">Poznámka<textarea className="field-control" maxLength={2000} value={patient.note ?? ''} onChange={(e) => setPatient({ ...patient, note: e.target.value })} /></label>
      </div>
      {needsConfirmation && <label className="booking-identity-confirm"><input type="checkbox" required checked={correctIdentity} onChange={(e) => setCorrectIdentity(e.target.checked)} />Opravuji údaje stejného klienta, včetně jeho historie.</label>}
      <button className="secondary-button" type="submit" disabled={needsConfirmation && !correctIdentity}>{saving ? 'Ukládání…' : 'Uložit'}</button>
    </fieldset>}
    <div className="inline-actions">{(stale || (!patient && error)) && <button className="ghost-button" type="button" onClick={() => { setError(''); setPatient(null); setStale(false); setRetry((value) => value + 1) }}>Načíst znovu</button>}<button className="ghost-button" type="button" disabled={saving} onClick={onClose}>Zavřít úpravu</button></div>
  </form>
}
