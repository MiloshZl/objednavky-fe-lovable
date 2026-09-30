export type Therapist = { id: number; display_name: string }
export type ReservationStatus = 'ACTIVE' | 'EXCUSED' | 'CANCELLED'
export type Reservation = {
  id: number
  therapist_id: number
  therapist_name: string
  patient_id: number
  patient_name: string
  patient?: Patient
  insurer_type_snapshot: 'INSURED' | 'UNINSURED'
  insurer_id_snapshot: number | null
  insurer_code: string | null
  insurer_name: string | null
  start_at: string
  end_at: string
  duration_minutes: 45 | 60
  status: ReservationStatus
  updated_at: string
  warning: { code: string; message: string } | null
}
export type Slot = { start: string; end: string }
export type SessionDraft = { therapistId: number; startAt: string; durationMinutes: 45 | 60 }
export type Patient = {
  id: number
  first_name: string
  last_name: string
  birth_year: number | null
  phone: string
  insurer_type: 'INSURED' | 'UNINSURED'
  insurer_code: string | null
  insurer_id: number | null
  insurer_name: string | null
  can_edit: boolean
  note?: string | null
  updated_at?: string
  has_reservations?: boolean
}
export type PaymentMode = 'PATIENT' | 'SELF_PAY'
export type PatientChoice = { id: number; name: string; details?: Patient }
export type ComposerInitial = {
  date: string
  therapistId: number | ''
  durationMinutes: 45 | 60
  search?: { weekdays: number[]; timeFilter: 'all' | 'morning' | 'afternoon'; horizon: number }
  slot?: Slot
  reservation?: Reservation
  original?: Reservation
}
