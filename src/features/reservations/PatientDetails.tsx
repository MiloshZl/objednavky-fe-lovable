import type { Patient } from './types'
import { insuranceLabel, shortInsuranceLabel } from './insurance'

export function PatientDetails({ patient }: { patient: Patient }) {
  const phone = patient.phone?.replace(/[^+\d]/g, '')
  return <div>
    <div className="booking-compact-meta">
      {phone && <a href={`tel:${phone}`} aria-label={`Volat ${patient.phone}`}>{patient.phone}</a>}
      {patient.birth_year && <span title="Rok narození">{patient.birth_year}</span>}
      <span title={`Pojišťovna klienta: ${insuranceLabel(patient)}`}>{shortInsuranceLabel(patient)}</span>
    </div>
    {patient.note && <details className="booking-compact-note"><summary>Poznámka</summary><p>{patient.note}</p></details>}
  </div>
}
