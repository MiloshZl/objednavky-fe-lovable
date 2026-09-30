import { apiFetch } from '../../api/client'
import type { Patient, PaymentMode, Reservation, SessionDraft, Slot, Therapist } from './types'

export const reservationsApi = {
  therapists: (signal?: AbortSignal) => apiFetch<Therapist[]>('/reservations/therapists', { signal }),
  list: (date: string, therapistId: number | '', signal?: AbortSignal) => {
    const params = new URLSearchParams({ date })
    if (therapistId) params.set('therapistId', String(therapistId))
    return apiFetch<Reservation[]>(`/reservations?${params}`, { signal })
  },
  availability: (therapistId: number, date: string, durationMinutes: number, signal?: AbortSignal, excludeReservationId?: number) => {
    const params = new URLSearchParams({ therapistId: String(therapistId), date, durationMinutes: String(durationMinutes) })
    if (excludeReservationId) params.set('excludeReservationId', String(excludeReservationId))
    return apiFetch<Slot[]>(`/reservations/availability?${params}`, { signal })
  },
  patients: (query: string, signal?: AbortSignal) => apiFetch<Patient[]>('/patients/search', {
    method: 'POST', body: JSON.stringify({ query }), signal,
  }),
  create: (patientId: number, sessions: SessionDraft[], originalReservationId?: number, paymentMode?: PaymentMode) => {
    if (sessions.length === 1) {
      return apiFetch<Reservation>('/reservations', {
        method: 'POST', body: JSON.stringify({ patientId, ...sessions[0], paymentMode, ...(originalReservationId ? { originalReservationId } : {}) }),
      }).then((reservation) => [reservation])
    }
    return apiFetch<Reservation[]>('/reservations/batch', { method: 'POST', body: JSON.stringify({ patientId, sessions, paymentMode }) })
  },
  update: (reservation: Reservation, session: Partial<SessionDraft>, paymentMode?: PaymentMode) => apiFetch<Reservation>(`/reservations/${reservation.id}`, {
    method: 'PATCH', body: JSON.stringify({ ...session, paymentMode, expectedUpdatedAt: reservation.updated_at }),
  }),
  changeStatus: (reservation: Reservation, action: 'excuse' | 'cancel') => apiFetch<Reservation>(`/reservations/${reservation.id}/${action}`, {
    method: 'POST', body: JSON.stringify({ expectedUpdatedAt: reservation.updated_at }),
  }),
}
