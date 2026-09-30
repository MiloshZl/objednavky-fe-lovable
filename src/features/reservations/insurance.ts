import type { Patient } from './types'

export function insuranceLabel(patient: Pick<Patient, 'insurer_type' | 'insurer_code' | 'insurer_name'>) {
  return patient.insurer_type === 'UNINSURED' ? 'Bez pojišťovny' : [patient.insurer_code, patient.insurer_name].filter(Boolean).join(' – ') || 'Pojišťovna neuvedena'
}

export function shortInsuranceLabel(patient: Pick<Patient, 'insurer_type' | 'insurer_code' | 'insurer_name'>) {
  return patient.insurer_type === 'UNINSURED' ? 'Bez pojišťovny' : patient.insurer_code || patient.insurer_name || 'Pojišťovna neuvedena'
}
