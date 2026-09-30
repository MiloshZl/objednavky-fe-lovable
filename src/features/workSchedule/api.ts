import { apiFetch } from '../../api/client'

export type Therapist = { id: number; display_name: string; is_active: boolean }
export type Interval = { start_time: string; end_time: string }
export type IntervalInput = { startTime: string; endTime: string }
export type ScheduleDay = { date: string; dayOfWeek: number; intervals: Interval[]; isHoliday?: boolean; isDayOff?: boolean; hasOverride?: boolean }
export type Template = { id: number; therapist_id: number; day_of_week: number; start_time: string; end_time: string; valid_from: string; valid_to: string | null; is_active: boolean }
export type TemplateSet = { id: number; therapist_id: number; name: string; is_active: boolean; days: Array<{ day_of_week: number; start_time: string; end_time: string; interval_order: number }> }
export type DaySchedule = ScheduleDay & { overrides: Array<{ override_date: string; is_day_off: boolean; intervals?: Interval[]; start_time?: string | null; end_time?: string | null }> }

export const workScheduleApi = {
  therapists: (signal?: AbortSignal) => apiFetch<Therapist[]>('/work-schedule/therapists', { signal }),
  week: (therapistId: number, startDate: string, days = 5, workdays = false, signal?: AbortSignal) => apiFetch<{ therapistId: number; startDate: string; days: ScheduleDay[] }>(`/work-schedule/week?therapistId=${therapistId}&startDate=${startDate}&days=${days}&workdays=${workdays}`, { signal }),
  day: (therapistId: number, date: string, signal?: AbortSignal) => apiFetch<DaySchedule>(`/work-schedule?therapistId=${therapistId}&date=${date}`, { signal }),
  templates: (therapistId: number, signal?: AbortSignal) => apiFetch<Template[]>(`/work-schedule/templates?therapistId=${therapistId}&from=2000-01-01`, { signal }),
  templateSets: (therapistId: number, signal?: AbortSignal) => apiFetch<TemplateSet[]>(`/work-schedule/template-sets?therapistId=${therapistId}`, { signal }),
  getTemplateSet: (therapistId: number, id: number, signal?: AbortSignal) => apiFetch<{ id: number; therapist_id: number; name: string; is_active: boolean; days: Array<{ day_of_week: number; start_time: string; end_time: string; interval_order: number }> }>(`/work-schedule/template-sets/${id}?therapistId=${therapistId}`, { signal }),
  createTemplateSet: (payload: { therapistId: number; name: string; days: Array<{ dayOfWeek: number; intervals: IntervalInput[] }>; validFrom: string | null; validTo: string | null }) => apiFetch<{ id: number }>('/work-schedule/template-sets', { method: 'POST', body: JSON.stringify(payload) }),
  updateTemplateSet: (id: number, payload: { therapistId: number; name: string; days: Array<{ dayOfWeek: number; intervals: IntervalInput[] }> }) => apiFetch<{ id: number; name: string; isActive: boolean }>('/work-schedule/template-sets/' + id, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTemplateSet: (id: number, therapistId: number) => apiFetch<{ id: number; isActive: boolean; deleted: boolean; softDeleted: boolean }>(`/work-schedule/template-sets/${id}?therapistId=${therapistId}&confirm=true`, { method: 'DELETE' }),
  applyTemplateSet: (id: number, payload: { therapistId: number; validFrom: string; validTo: string | null }) => apiFetch<{ templateId: number }>(`/work-schedule/template-sets/${id}/apply`, { method: 'POST', body: JSON.stringify(payload) }),
  createTemplate: (payload: { therapistId: number; days: number[]; intervals: IntervalInput[]; validFrom: string; validTo: string | null }) => apiFetch<{ ids: number[] }>('/work-schedule/templates', { method: 'POST', body: JSON.stringify(payload) }),
  deactivateTemplate: (id: number) => apiFetch<{ id: number }>(`/work-schedule/templates/${id}/deactivate`, { method: 'POST' }),
  saveOverride: (date: string, payload: { therapistId: number; isDayOff: boolean; intervals?: IntervalInput[] }) => apiFetch<{ id: number }>(`/work-schedule/overrides/${date}`, { method: 'PUT', body: JSON.stringify(payload) }),
}
