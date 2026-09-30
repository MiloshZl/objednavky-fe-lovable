import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlotFinder } from '../src/features/reservations/SlotFinder'
import { ReservationComposer } from '../src/features/reservations/ReservationComposer'
import { WeekOverview } from '../src/features/reservations/WeekOverview'
import { ReservationsPage } from '../src/features/reservations/ReservationsPage'
import { reservationsApi } from '../src/features/reservations/api'
import { ApiError } from '../src/api/client'
import type { Reservation } from '../src/features/reservations/types'

vi.mock('../src/features/reservations/api', () => ({ reservationsApi: { availability: vi.fn(), list: vi.fn(), therapists: vi.fn(), create: vi.fn(), update: vi.fn(), changeStatus: vi.fn() } }))
vi.mock('../src/features/reservations/PatientPicker', () => ({ PatientPicker: ({ onChange }: { onChange: (value: { id: number; name: string }) => void }) => <button onClick={() => onChange({ id: 9, name: 'Testovací pacient' })}>Vybrat testovacího pacienta</button> }))
const therapists = [{ id: 1, display_name: 'Terapeutka A' }, { id: 2, display_name: 'Terapeutka B' }]
const slot = (date = '2026-10-05', hour = '08') => ({ start: date + 'T' + hour + ':00:00Z', end: date + 'T' + hour + ':45:00Z' })
const reservation: Reservation = { id: 1, patient_id: 9, patient_name: 'Testovací pacient', therapist_id: 1, therapist_name: 'Terapeutka A', start_at: slot().start, end_at: slot().end, duration_minutes: 45, status: 'ACTIVE', updated_at: '2026-09-29T10:00:00Z', warning: null, insurer_type_snapshot: 'INSURED', insurer_id_snapshot: 1, insurer_code: '111', insurer_name: 'Test pojišťovna' }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(reservationsApi.therapists).mockResolvedValue(therapists)
  vi.mocked(reservationsApi.list).mockResolvedValue([])
  vi.mocked(reservationsApi.availability).mockImplementation(async (_id, date) => [slot(date), slot(date, '13')])
})

describe('availability search', () => {
  it('filters actual results to Mondays and mornings, including the current day', async () => {
    render(<SlotFinder therapists={therapists} initialDate="2026-10-05" initialTherapistId={1} initialDuration={45} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Po', exact: true }))
    fireEvent.click(screen.getByRole('button', { name: 'Dopoledne' }))
    const options = await screen.findAllByRole('button', { name: /Terapeutka A, 10:00/ })
    expect(options).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /15:00 až/ })).toBeNull()
    expect(vi.mocked(reservationsApi.availability).mock.calls.every((call) => ['2026-10-05', '2026-10-12'].includes(call[1]))).toBe(true)
  })
  it('does not present a network failure as a fully booked day and can retry', async () => {
    vi.mocked(reservationsApi.availability).mockRejectedValue(new Error('Spojení se nezdařilo.'))
    render(<SlotFinder therapists={therapists} initialDate="2026-10-05" initialTherapistId={1} initialDuration={45} onSelect={vi.fn()} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Načíst znovu' }).hasAttribute('disabled')).toBe(false))
    vi.mocked(reservationsApi.availability).mockImplementation(async (_id, date) => [slot(date)])
    fireEvent.click(screen.getByRole('button', { name: 'Načíst znovu' }))
    expect((await screen.findAllByRole('button', { name: /10:00 až/ })).length).toBeGreaterThan(0)
  })
  it('aborts the old search when changing therapist', async () => {
    vi.mocked(reservationsApi.availability).mockImplementation(async (_id, date, _duration, signal) => {
      if (!signal?.aborted) return [slot(date)]
      throw new DOMException('Aborted', 'AbortError')
    })
    render(<SlotFinder therapists={therapists} initialDate="2026-10-05" initialTherapistId={1} initialDuration={45} onSelect={vi.fn()} />)
    await screen.findAllByRole('button', { name: /Terapeutka A, 10:00/ })
    const signal = vi.mocked(reservationsApi.availability).mock.calls[0][3]
    fireEvent.change(screen.getByLabelText('U koho'), { target: { value: '2' } })
    await screen.findAllByRole('button', { name: /Terapeutka B, 10:00/ })
    expect(signal?.aborted).toBe(true)
    expect(screen.queryByRole('button', { name: /Terapeutka A, 10:00/ })).toBeNull()
  })
})

describe('booking workflow', () => {
  it('books a clicked slot after selecting the patient, without searching again', async () => {
    vi.mocked(reservationsApi.create).mockResolvedValue([reservation])
    const saved = vi.fn()
    render(<ReservationComposer initial={{ date: '2026-10-05', therapistId: 1, durationMinutes: 45, slot: slot() }} therapists={therapists} onClose={vi.fn()} onSaved={saved} onRefresh={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Hledání volných termínů' })).toBeNull()
    fireEvent.click(screen.getByText('Vybrat testovacího pacienta'))
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednání (1)' }))
    await waitFor(() => expect(saved).toHaveBeenCalledWith([reservation]))
    expect(reservationsApi.create).toHaveBeenCalledWith(9, [{ therapistId: 1, startAt: slot().start, durationMinutes: 45 }], undefined, undefined)
  })
  it('books self-pay explicitly while preserving the selected patient', async () => {
    vi.mocked(reservationsApi.create).mockResolvedValue([{ ...reservation, insurer_type_snapshot: 'UNINSURED', insurer_id_snapshot: null }])
    render(<ReservationComposer initial={{ date: '2026-10-05', therapistId: 1, durationMinutes: 45, slot: slot() }} therapists={therapists} onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Vybrat testovacího pacienta'))
    fireEvent.change(screen.getByRole('combobox', { name: /Úhrada vybraných návštěv/ }), { target: { value: 'SELF_PAY' } })
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednání (1)' }))
    await waitFor(() => expect(reservationsApi.create).toHaveBeenCalledWith(9, [{ therapistId: 1, startAt: slot().start, durationMinutes: 45 }], undefined, 'SELF_PAY'))
  })
  it('limits a batch to six and keeps patient selection', async () => {
    const user = userEvent.setup()
    render(<ReservationComposer initial={{ date: '2026-10-05', therapistId: 1, durationMinutes: 45 }} therapists={therapists} onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByText('Vybrat testovacího pacienta'))
    await screen.findAllByRole('button', { name: /Terapeutka A, 10:00/ })
    for (let index = 0; index < 6; index += 1) await user.click(screen.getAllByRole('button', { name: /Terapeutka A, 10:00/ })[0])
    expect(within(screen.getByRole('region', { name: 'Vybrané termíny' })).getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: /Terapeutka A, 15:00/ }).every((button) => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Potvrdit objednání (6)' }).hasAttribute('disabled')).toBe(false)
  })
  it('recovers a 409 conflict by preserving the patient and clearing stale times', async () => {
    vi.mocked(reservationsApi.create).mockRejectedValue(new ApiError('Termín je obsazený.', 409))
    const refresh = vi.fn()
    render(<ReservationComposer initial={{ date: '2026-10-05', therapistId: 1, durationMinutes: 45, slot: slot() }} therapists={therapists} onClose={vi.fn()} onSaved={vi.fn()} onRefresh={refresh} />)
    fireEvent.click(screen.getByText('Vybrat testovacího pacienta'))
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednání (1)' }))
    await screen.findByRole('alert')
    expect(refresh).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Potvrdit objednání (1)' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Vybrat aktuálně volné časy' }))
    expect(screen.getByText(/Testovací pacient · 0 termínů/)).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
  it('requires confirmation before discarding a draft', () => {
    const close = vi.fn()
    render(<ReservationComposer initial={{ date: '2026-10-05', therapistId: 1, durationMinutes: 45, slot: slot() }} therapists={therapists} onClose={close} onSaved={vi.fn()} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Zavřít' }))
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Zahodit výběr' }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('keeps seventh-visit warnings non-blocking after save', async () => {
    vi.mocked(reservationsApi.create).mockResolvedValue([{ ...reservation, warning: { code: 'SEVENTH', message: 'Sedmá návštěva v roce.' } }])
    render(<ReservationsPage ownTherapistId={1} initialDate="2026-10-05" />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Objednat pacienta' }))
    fireEvent.click(screen.getByText('Vybrat testovacího pacienta'))
    fireEvent.click((await screen.findAllByRole('button', { name: /Terapeutka A, 10:00/ }))[0])
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit objednání (1)' }))
    expect(await screen.findByText('Sedmá návštěva v roce.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('still displays visits when availability fails', async () => {
    vi.mocked(reservationsApi.list).mockResolvedValue([reservation])
    vi.mocked(reservationsApi.availability).mockRejectedValue(new Error('Volné časy nelze načíst.'))
    render(<ReservationsPage ownTherapistId={1} initialDate="2026-10-05" />)
    expect(await screen.findByText('Testovací pacient')).toBeTruthy()
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Volné časy nelze načíst.'))
  })
  it('offers a replacement immediately after excusing a visit and retains history', async () => {
    vi.mocked(reservationsApi.list).mockResolvedValue([reservation])
    const excused = { ...reservation, status: 'EXCUSED' as const }
    vi.mocked(reservationsApi.changeStatus).mockResolvedValue(excused)
    render(<ReservationsPage ownTherapistId={1} initialDate="2026-10-05" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Omluvit', exact: true }))
    vi.mocked(reservationsApi.list).mockResolvedValue([excused])
    fireEvent.click(screen.getByRole('button', { name: 'Potvrdit omluvení' }))
    expect(await screen.findByRole('button', { name: 'Vybrat náhradní termín pro Testovací pacient' })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Zobrazit také omluvené a zrušené návštěvy'))
    expect(await screen.findByText('Čas je uvolněný. Návštěva se nepočítá do limitu.')).toBeTruthy()
  })
})

it('refreshes the weekly agenda after a revision and books directly', async () => {
  const book = vi.fn()
  const props = { weekDates: ['2026-10-05'], therapists, therapistId: 1 as const, duration: 45 as const, todayDate: '2026-10-05', onSelectDay: vi.fn(), onBook: book }
  const { rerender } = render(<WeekOverview {...props} revision={0} />)
  fireEvent.click(await screen.findByRole('button', { name: '+ Volno 10:00' }))
  expect(book).toHaveBeenCalledWith({ date: '2026-10-05', therapistId: 1, durationMinutes: 45, slot: slot() })
  vi.mocked(reservationsApi.list).mockResolvedValue([reservation])
  rerender(<WeekOverview {...props} revision={1} />)
  expect(await screen.findByText('Testovací pacient')).toBeTruthy()
})
