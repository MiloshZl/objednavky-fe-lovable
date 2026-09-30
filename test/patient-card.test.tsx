import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReservationPatient } from '../src/features/reservations/ReservationPatient'
import { PatientEditor } from '../src/features/reservations/PatientEditor'
import { reservationsApi } from '../src/features/reservations/api'
import { apiFetch, ApiError } from '../src/api/client'
import type { Patient, Reservation } from '../src/features/reservations/types'

vi.mock('../src/features/reservations/api', () => ({ reservationsApi: { update: vi.fn() } }))
vi.mock('../src/api/client', async (original) => ({ ...await original<typeof import('../src/api/client')>(), apiFetch: vi.fn() }))
const patient: Patient = { id: 10, first_name: 'Test', last_name: 'Klient', birth_year: 1980, phone: '+420 111 222 333', insurer_type: 'INSURED', insurer_id: 1, insurer_code: '111', insurer_name: 'Test pojišťovna', can_edit: true, note: 'Rozlišovací poznámka', updated_at: '2026-09-29 10:00:00', has_reservations: true }
const reservation: Reservation = { id: 1, patient_id: 10, patient_name: 'Test Klient', patient, therapist_id: 1, therapist_name: 'Terapeutka', start_at: '2026-10-05T09:00:00+02:00', end_at: '2026-10-05T09:45:00+02:00', duration_minutes: 45, status: 'ACTIVE', updated_at: '2026-09-29 10:00:00', warning: null, insurer_type_snapshot: 'UNINSURED', insurer_id_snapshot: null, insurer_code: null, insurer_name: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiFetch).mockImplementation(async (path) => path === '/insurers/contracted' ? [{ id: 1, code: '111', name: 'Test pojišťovna' }] : patient)
})

it('shows contact, birth year, note and both patient insurance and visit payment', () => {
  render(<ReservationPatient reservation={reservation} disabled={false} onRefresh={vi.fn()} />)
  expect(screen.getByRole('link', { name: 'Volat +420 111 222 333' }).getAttribute('href')).toBe('tel:+420111222333')
  expect(screen.getByText('1980')).toBeTruthy()
  expect(screen.getByText('Rozlišovací poznámka')).toBeTruthy()
  expect(screen.getByText('111 – Test pojišťovna')).toBeTruthy()
  expect(screen.getByText(/Bez pojišťovny/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Upravit klienta' })).toBeTruthy()
})

it('changes only the chosen visit payment with the current version and refreshes the card', async () => {
  vi.mocked(reservationsApi.update).mockResolvedValue(reservation)
  const refresh = vi.fn()
  render(<ReservationPatient reservation={{ ...reservation, insurer_type_snapshot: 'INSURED' }} disabled={false} onRefresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Změnit úhradu' }))
  expect(reservationsApi.update).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Uložit úhradu' }))
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  expect(reservationsApi.update).toHaveBeenCalledWith(expect.objectContaining({ id: 1, updated_at: reservation.updated_at }), {}, 'SELF_PAY')
  expect(apiFetch).not.toHaveBeenCalled()
})

it('does not show editing for another therapist’s patient or payment actions for cancelled visits', () => {
  render(<ReservationPatient reservation={{ ...reservation, status: 'CANCELLED', patient: { ...patient, can_edit: false, note: undefined } }} disabled={false} onRefresh={vi.fn()} />)
  expect(screen.queryByRole('button', { name: 'Upravit klienta' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Změnit úhradu' })).toBeNull()
})

it('opens patient editing from the card and saves changed phone with concurrency protection', async () => {
  const refresh = vi.fn()
  render(<ReservationPatient reservation={reservation} disabled={false} onRefresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: 'Upravit klienta' }))
  const phone = await screen.findByRole('textbox', { name: 'Telefon' })
  expect(screen.getByRole('textbox', { name: 'Jméno', exact: true }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(phone, { target: { value: '+420 999 888 777' } })
  vi.mocked(apiFetch).mockResolvedValue({ firstName: 'Test', lastName: 'Klient', phone: '+420 999 888 777', birthYear: 1980, insurerType: 'INSURED', insurerId: 1, note: patient.note })
  fireEvent.click(screen.getByRole('button', { name: 'Uložit klienta' }))
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  const call = vi.mocked(apiFetch).mock.calls.find(([, init]) => init?.method === 'PATCH')!
  expect(call[0]).toBe('/patients/10')
  expect(JSON.parse(call[1]!.body as string)).toMatchObject({ phone: '+420 999 888 777', expectedUpdatedAt: patient.updated_at })
})

it('keeps unsaved fields and blocks resubmission after a stale patient conflict', async () => {
  const saved = vi.fn()
  render(<PatientEditor patientId={10} onClose={vi.fn()} onSaved={saved} />)
  fireEvent.change(await screen.findByRole('textbox', { name: 'Telefon' }), { target: { value: '999' } })
  vi.mocked(apiFetch).mockRejectedValue(new ApiError('Klient se mezitím změnil.', 409, 'PATIENT_STALE'))
  fireEvent.click(screen.getByRole('button', { name: 'Uložit klienta' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Klient se mezitím změnil.')
  expect(screen.getByRole('textbox', { name: 'Telefon' })).toHaveProperty('value', '999')
  expect(screen.getByRole('button', { name: 'Načíst znovu' })).toBeTruthy()
  expect(saved).not.toHaveBeenCalled()
})
