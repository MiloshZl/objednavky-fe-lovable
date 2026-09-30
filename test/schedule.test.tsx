import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { WorkSchedulePage } from '../src/features/workSchedule/WorkSchedulePage'
import { workScheduleApi, type TemplateSet } from '../src/features/workSchedule/api'

vi.mock('../src/features/workSchedule/api', () => ({ workScheduleApi: { therapists: vi.fn(), week: vi.fn(), day: vi.fn(), templates: vi.fn(), templateSets: vi.fn(), createTemplateSet: vi.fn(), updateTemplateSet: vi.fn(), applyTemplateSet: vi.fn(), saveOverride: vi.fn(), deleteTemplateSet: vi.fn() } }))
const template: TemplateSet = { id: 1, therapist_id: 1, name: 'Ranní týden', is_active: true, days: [{ day_of_week: 1, start_time: '08:00:00', end_time: '12:00:00', interval_order: 1 }] }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(workScheduleApi.therapists).mockResolvedValue([{ id: 1, display_name: 'Terapeutka A', is_active: true }, { id: 2, display_name: 'Terapeutka B', is_active: true }])
  vi.mocked(workScheduleApi.week).mockResolvedValue({ therapistId: 1, startDate: '2026-10-05', days: [{ date: '2026-10-05', dayOfWeek: 1, intervals: [{ start_time: '08:00:00', end_time: '16:00:00' }] }, { date: '2026-10-28', dayOfWeek: 3, intervals: [], isHoliday: true }] })
  vi.mocked(workScheduleApi.templates).mockResolvedValue([])
  vi.mocked(workScheduleApi.templateSets).mockResolvedValue([template])
  vi.mocked(workScheduleApi.day).mockResolvedValue({ date: '2026-10-05', dayOfWeek: 1, intervals: [{ start_time: '08:00:00', end_time: '16:00:00' }], overrides: [] })
  vi.mocked(workScheduleApi.updateTemplateSet).mockResolvedValue({ id: 1, name: template.name, isActive: true })
})

it('has one editor, allows adding a missing weekday and copies actual edited hours', async () => {
  render(<WorkSchedulePage ownTherapistId={1} isAdmin={false} initialDate="2026-10-05" />)
  fireEvent.click(screen.getByRole('button', { name: /Běžný týden/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Upravit', exact: true }))
  fireEvent.click(screen.getByLabelText('Úterý'))
  fireEvent.change(screen.getAllByLabelText('Od', { exact: true })[0], { target: { value: '09:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Zkopírovat časy prvního dne do ostatních' }))
  expect(screen.getAllByRole('button', { name: 'Uložit běžný týden' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Uložit běžný týden' }))
  await waitFor(() => expect(workScheduleApi.updateTemplateSet).toHaveBeenCalledWith(1, { therapistId: 1, name: 'Ranní týden', days: [{ dayOfWeek: 1, intervals: [{ startTime: '09:00', endTime: '12:00' }] }, { dayOfWeek: 2, intervals: [{ startTime: '09:00', endTime: '12:00' }] }] }))
  expect(workScheduleApi.applyTemplateSet).not.toHaveBeenCalled()
})

it('applies the chosen template without accidentally switching the edited template', async () => {
  render(<WorkSchedulePage ownTherapistId={1} isAdmin={false} initialDate="2026-10-05" />)
  fireEvent.click(screen.getByRole('button', { name: /Běžný týden/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Použít od…' }))
  fireEvent.change(screen.getByLabelText('Od', { exact: true }), { target: { value: '2026-11-02' } })
  fireEvent.change(screen.getByLabelText('Do (nepovinné)'), { target: { value: '2026-11-30' } })
  fireEvent.click(screen.getByRole('button', { name: 'Použít pro toto období' }))
  await waitFor(() => expect(workScheduleApi.applyTemplateSet).toHaveBeenCalledWith(1, { therapistId: 1, validFrom: '2026-11-02', validTo: '2026-11-30' }))
  expect(workScheduleApi.updateTemplateSet).not.toHaveBeenCalled()
})

it('opens a day only on demand, disallows holiday edits and saves a day off', async () => {
  render(<WorkSchedulePage ownTherapistId={1} isAdmin={false} initialDate="2026-10-05" />)
  expect(screen.queryByRole('button', { name: 'Uložit pracovní dobu' })).toBeNull()
  const calendar = await screen.findByRole('region', { name: 'Pracovní týden' })
  expect(within(calendar).getByRole('button', { name: /Svátek/ }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(within(calendar).getByRole('button', { name: /08:00–16:00/ }))
  await waitFor(() => expect(screen.queryByText('Načítání pracovní doby…')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Volno', exact: true }))
  fireEvent.click(screen.getByRole('button', { name: 'Uložit den volna' }))
  await waitFor(() => expect(workScheduleApi.saveOverride).toHaveBeenCalledWith('2026-10-05', { therapistId: 1, isDayOff: true, intervals: [] }))
})

it('keeps a failed daily load unsavable and retries it', async () => {
  vi.mocked(workScheduleApi.day).mockRejectedValueOnce(new Error('Spojení se nezdařilo.'))
  render(<WorkSchedulePage ownTherapistId={1} isAdmin={false} initialDate="2026-10-05" />)
  fireEvent.click(await screen.findByRole('button', { name: /08:00–16:00/ }))
  const alert = await screen.findByRole('alert')
  const save = screen.getByRole('button', { name: 'Uložit pracovní dobu' })
  expect(save.closest('fieldset')?.disabled).toBe(true)
  fireEvent.click(within(alert).getByRole('button', { name: 'Zkusit znovu' }))
  await waitFor(() => expect(save.closest('fieldset')?.disabled).toBe(false))
  expect(workScheduleApi.saveOverride).not.toHaveBeenCalled()
})

it('keeps own-schedule selection locked for a therapist and confirms deactivation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<WorkSchedulePage ownTherapistId={1} isAdmin={false} initialDate="2026-10-05" />)
  expect((screen.getByLabelText('Terapeutka') as HTMLSelectElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /Běžný týden/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Deaktivovat', exact: true }))
  expect(confirm).toHaveBeenCalledOnce()
  expect(workScheduleApi.deleteTemplateSet).not.toHaveBeenCalled()
})
