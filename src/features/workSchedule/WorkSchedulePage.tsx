import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { addDays, dateKey, dayLabel, mondayOf } from '../reservations/dates'
import { workScheduleApi, type ScheduleDay, type Template, type TemplateSet, type Therapist } from './api'
import './workSchedule.css'

type TimeRangeInput = { startTime: string; endTime: string }

const weekdayNames = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek']
const time = (value: string) => value.slice(0, 5)
const dateLabel = (value: string) => new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
const shortDateLabel = (value: string) => new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
const monthLabel = (value: string) => new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
const intervalLabel = (intervals: Array<{ start_time: string; end_time: string }>) => intervals.map((item) => `${time(item.start_time)}–${time(item.end_time)}`).join(' · pauza · ')
const workdaysInMonth = (value: string) => {
  const year = Number(value.slice(0, 4)); const month = Number(value.slice(5, 7)); const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let count = 0
  for (let day = 1; day <= lastDay; day += 1) { const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); if (weekday !== 0 && weekday !== 6) count += 1 }
  return count
}

function intervalsToEditor(intervals: Array<{ start_time: string; end_time: string }>) {
  if (!intervals.length) return { workStart: '08:00', workEnd: '16:00', breaks: [] as TimeRangeInput[] }
  const sorted = [...intervals].sort((left, right) => left.start_time.localeCompare(right.start_time))
  return {
    workStart: time(sorted[0].start_time),
    workEnd: time(sorted[sorted.length - 1].end_time),
    breaks: sorted.slice(1).map((interval, index) => ({
      startTime: time(sorted[index].end_time),
      endTime: time(interval.start_time),
    })),
  }
}

function editorToIntervals(workStart: string, workEnd: string, breaks: TimeRangeInput[]) {
  const orderedBreaks = [...breaks].sort((left, right) => left.startTime.localeCompare(right.startTime))
  let cursor = workStart
  const intervals: TimeRangeInput[] = []
  for (const pause of orderedBreaks) {
    if (pause.startTime <= cursor || pause.endTime <= pause.startTime || pause.endTime >= workEnd) {
      throw new Error('Pauzy musí být uvnitř pracovní doby a nesmí se překrývat.')
    }
    intervals.push({ startTime: cursor, endTime: pause.startTime })
    cursor = pause.endTime
  }
  if (workEnd <= cursor) throw new Error('Konec pracovní doby musí být později než začátek.')
  intervals.push({ startTime: cursor, endTime: workEnd })
  return intervals
}

function ScheduleIntervals({
  breaks,
  onChange,
  onAdd,
  onRemove,
}: {
  breaks: TimeRangeInput[]
  onChange: (index: number, field: 'startTime' | 'endTime', value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return <div className="schedule-breaks">
    <div className="schedule-intervals__header">
      <strong>Přestávky</strong>
      <span>Zadejte pauzu, ne další pracovní okno.</span>
    </div>
    {breaks.map((pause, index) => <div className="schedule-break-row" key={`break-${index}`}>
      <label>Od<input className="field-control" type="time" required value={pause.startTime} onChange={(event) => onChange(index, 'startTime', event.target.value)} /></label>
      <label>Do<input className="field-control" type="time" required value={pause.endTime} onChange={(event) => onChange(index, 'endTime', event.target.value)} /></label>
      <button type="button" className="ghost-button schedule-remove-break" onClick={() => onRemove(index)} aria-label={`Odebrat pauzu ${index + 1}`}>Odebrat</button>
    </div>)}
    <button type="button" className="ghost-button" onClick={onAdd} disabled={breaks.length >= 4}>+ Přidat pauzu</button>
  </div>
}

export function WorkSchedulePage({ ownTherapistId, isAdmin, initialDate = dateKey(), onDateChange }: { ownTherapistId?: number | null; isAdmin: boolean; initialDate?: string; onDateChange?: (date: string) => void }) {
  const [revision, setRevision] = useState(0)
  const [metadataRevision, setMetadataRevision] = useState(0)
  const [metadataError, setMetadataError] = useState('')
  const [dayError, setDayError] = useState('')
  const [editingDay, setEditingDay] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(false)
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | ''>('')
  const editorRef = useRef<HTMLDivElement>(null)
  const submitting = useRef(false)
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [therapistId, setTherapistId] = useState<number | ''>(ownTherapistId ?? '')
  const [weekStart, setWeekStart] = useState(mondayOf(initialDate))
  const [calendarPeriod, setCalendarPeriod] = useState<'week' | 'fortnight' | 'month'>('week')
  const [days, setDays] = useState<ScheduleDay[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateSets, setTemplateSets] = useState<TemplateSet[]>([])
  const [loading, setLoading] = useState(true)
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [dayLoading, setDayLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(initialDate)
  useEffect(() => { onDateChange?.(selectedDate) }, [selectedDate, onDateChange])
  const [activeSection, setActiveSection] = useState<'calendar' | 'templates'>('calendar')
  const [templateName, setTemplateName] = useState('')
  const [selectedTemplateSetId, setSelectedTemplateSetId] = useState<number | ''>('')
  const [applyFrom, setApplyFrom] = useState('')
  const [applyTo, setApplyTo] = useState('')
  const [templateDays, setTemplateDays] = useState<Record<number, { workStart: string; workEnd: string; breaks: TimeRangeInput[] }>>(() => Object.fromEntries([1, 2, 3, 4, 5].map((day) => [day, { workStart: '08:00', workEnd: '16:00', breaks: [] }])))
  const [template, setTemplate] = useState({ days: [1, 2, 3, 4, 5], workStart: '08:00', workEnd: '16:00', breaks: [] as TimeRangeInput[], validFrom: '', validTo: '' })
  const [override, setOverride] = useState({ isDayOff: false, workStart: '08:00', workEnd: '16:00', breaks: [] as TimeRangeInput[] })

  
  const calendarStart = calendarPeriod === 'month' ? `${weekStart.slice(0, 7)}-01` : weekStart
  const calendarLength = calendarPeriod === 'week' ? 5 : calendarPeriod === 'fortnight' ? 10 : workdaysInMonth(weekStart)
  const calendarWorkdays = true
  const calendarEnd = days.length ? days[days.length - 1].date : addDays(calendarStart, calendarLength - 1)
  const calendarLabel = calendarPeriod === 'month' ? monthLabel(calendarStart) : `${shortDateLabel(calendarStart)}–${shortDateLabel(calendarEnd)}`
  const displayDays = useMemo(() => {
    if (calendarPeriod !== 'month' || !days.length) return days.map((day) => ({ ...day, outsideMonth: false }))
    const first = new Date(`${calendarStart}T12:00:00Z`)
    const last = new Date(`${days[days.length - 1].date}T12:00:00Z`)
    const leading: Array<ScheduleDay & { outsideMonth: boolean }> = []
    const cursor = new Date(first)
    while (cursor.getUTCDay() !== 1) {
      cursor.setUTCDate(cursor.getUTCDate() - 1)
      if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) leading.unshift({ date: cursor.toISOString().slice(0, 10), dayOfWeek: cursor.getUTCDay(), outsideMonth: true, intervals: [], isHoliday: false, isDayOff: false, hasOverride: false })
    }
    const trailing: Array<ScheduleDay & { outsideMonth: boolean }> = []
    const tail = new Date(last)
    while (tail.getUTCDay() !== 5) {
      tail.setUTCDate(tail.getUTCDate() + 1)
      if (tail.getUTCDay() !== 0 && tail.getUTCDay() !== 6) trailing.push({ date: tail.toISOString().slice(0, 10), dayOfWeek: tail.getUTCDay(), outsideMonth: true, intervals: [], isHoliday: false, isDayOff: false, hasOverride: false })
    }
    const merged = [...leading, ...days.map((day) => ({ ...day, outsideMonth: false })), ...trailing]
    const unique = new Map<string, (typeof merged)[number]>()
    for (const day of merged) {
      const previous = unique.get(day.date)
      if (!previous || (previous.outsideMonth && !day.outsideMonth)) unique.set(day.date, day)
    }
    return [...unique.values()]
  }, [calendarPeriod, calendarStart, days])

  function refresh() { setRevision((value) => value + 1) }

  useEffect(() => {
    if (editingDay || editingTemplate || applyingTemplateId) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      editorRef.current?.focus()
    }
  }, [editingDay, editingTemplate, applyingTemplateId, selectedDate])

  useEffect(() => {
    const controller = new AbortController()
    setMetadataLoading(true)
    setMetadataError('')
    workScheduleApi.therapists(controller.signal)
      .then((items) => { if (!controller.signal.aborted) { setTherapists(items); setTherapistId((current) => current || items[0]?.id || '') } })
      .catch((reason) => { if (!controller.signal.aborted) setMetadataError(reason instanceof Error ? reason.message : 'Terapeutky se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setMetadataLoading(false) })
    return () => controller.abort()
  }, [metadataRevision])

  useEffect(() => {
    if (!therapistId) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setDays([])
    setTemplates([])
    setTemplateSets([])
    Promise.all([workScheduleApi.week(therapistId, calendarStart, calendarLength, calendarWorkdays, controller.signal), workScheduleApi.templates(therapistId, controller.signal), workScheduleApi.templateSets(therapistId, controller.signal)])
      .then(([week, currentTemplates, currentTemplateSets]) => { if (!controller.signal.aborted) { setDays(week.days); setTemplates(currentTemplates); setTemplateSets(currentTemplateSets) } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Rozvrh se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [therapistId, calendarStart, calendarLength, revision])

  useEffect(() => {
    if (!therapistId || !selectedDate || !editingDay) return
    const controller = new AbortController()
    setDayLoading(true)
    setDayError('')
    workScheduleApi.day(therapistId, selectedDate, controller.signal)
      .then((day) => {
        if (controller.signal.aborted) return
        const saved = day.overrides.find((item) => String(item.override_date).slice(0, 10) === selectedDate)
        setOverride({ isDayOff: Boolean(saved?.is_day_off), ...intervalsToEditor(saved?.intervals?.length ? saved.intervals : day.intervals) })
      })
      .catch((reason) => { if (!controller.signal.aborted) setDayError(reason instanceof Error ? reason.message : 'Pracovní dobu se nepodařilo načíst.') })
      .finally(() => { if (!controller.signal.aborted) setDayLoading(false) })
    return () => controller.abort()
  }, [therapistId, selectedDate, editingDay, revision])

  function selectDay(value: string) {
    if (editingDay && value === selectedDate) return
    setSelectedDate(value)
    setDayLoading(true)
    setEditingDay(true)
  }

  function hydrateTemplateEditor(set: TemplateSet) {
    const nextDays: typeof templateDays = {}
    for (let day = 1; day <= 5; day += 1) nextDays[day] = intervalsToEditor(set.days.filter((row) => Number(row.day_of_week) === day))
    setTemplateDays(nextDays)
    setTemplate({ ...template, days: [...new Set(set.days.map((row) => Number(row.day_of_week)))].sort() })
    setTemplateName(set.name)
    setSelectedTemplateSetId(set.id)
    setEditingTemplate(true)
    setApplyingTemplateId('')
  }

  async function mutate(operation: () => Promise<unknown>, success: string, after?: () => void) {
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await operation()
      setMessage(success)
      after?.()
      refresh()
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 409
        ? 'Změna koliduje s rezervací nebo pracovní dobou. Obnovte přehled; dotčenou návštěvu nejdříve přesuňte nebo omluvte.'
        : reason instanceof Error ? reason.message : 'Změnu se nepodařilo uložit.')
    } finally { submitting.current = false; setSaving(false) }
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault()
    if (!therapistId) return
    await mutate(async () => {
      if (!templateName.trim() || !template.days.length) throw new Error('Vyplňte název a alespoň jeden pracovní den.')
      const payload = { therapistId, name: templateName.trim(), days: template.days.map((dayOfWeek) => ({ dayOfWeek, intervals: editorToIntervals(templateDays[dayOfWeek].workStart, templateDays[dayOfWeek].workEnd, templateDays[dayOfWeek].breaks) })) }
      if (selectedTemplateSetId) await workScheduleApi.updateTemplateSet(selectedTemplateSetId, payload)
      else await workScheduleApi.createTemplateSet({ ...payload, validFrom: null, validTo: null })
    }, 'Běžný týden je uložený. Nyní jej můžete použít pro konkrétní období.', () => setEditingTemplate(false))
  }

  async function saveOverride(event: React.FormEvent) {
    event.preventDefault()
    if (!therapistId || dayLoading || dayError) return
    await mutate(() => workScheduleApi.saveOverride(selectedDate, { therapistId, isDayOff: override.isDayOff, intervals: override.isDayOff ? [] : editorToIntervals(override.workStart, override.workEnd, override.breaks) }),
      'Pracovní doba pro vybraný den byla uložena.', () => setEditingDay(false))
  }

  async function deactivate(id: number) {
    if (!window.confirm('Deaktivovat tuto pracovní dobu? Historie zůstane zachována.')) return
    await mutate(() => workScheduleApi.deactivateTemplate(id), 'Pracovní interval byl deaktivován.')
  }

  async function deleteTemplateSet(id: number) {
    if (!therapistId || !window.confirm('Deaktivovat běžný týden pro další použití? Naplánované směny a historie zůstanou zachované.')) return
    await mutate(() => workScheduleApi.deleteTemplateSet(id, therapistId), 'Běžný týden byl deaktivován.', () => { setEditingTemplate(false); setApplyingTemplateId('') })
  }

  async function applyTemplateSet(item: TemplateSet) {
    if (!therapistId || !applyFrom) return
    await mutate(() => workScheduleApi.applyTemplateSet(item.id, { therapistId, validFrom: applyFrom, validTo: applyTo || null }), 'Běžný týden byl použitý ve zvoleném období.', () => {
      setApplyingTemplateId(''); setActiveSection('calendar'); setWeekStart(mondayOf(applyFrom)); setSelectedDate(applyFrom)
    })
  }

  const updateOverrideBreak = (index: number, field: 'startTime' | 'endTime', value: string) => setOverride((current) => ({ ...current, breaks: current.breaks.map((item, i) => i === index ? { ...item, [field]: value } : item) }))
  const addOverrideBreak = () => setOverride((current) => ({ ...current, breaks: [...current.breaks, { startTime: '12:00', endTime: '13:00' }] }))
  const removeOverrideBreak = (index: number) => setOverride((current) => ({ ...current, breaks: current.breaks.filter((_, i) => i !== index) }))
  const toggleTemplateDay = (day: number) => setTemplate((current) => ({ ...current, days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day].sort() }))
  const copyFirstDayToAll = () => setTemplateDays((current) => ({ ...current, ...Object.fromEntries(template.days.map((day) => [day, { ...current[template.days[0]], breaks: current[template.days[0]].breaks.map((pause) => ({ ...pause })) }])) }))
  const updateTemplateDay = (day: number, field: 'workStart' | 'workEnd', value: string) => setTemplateDays((current) => ({ ...current, [day]: { ...current[day], [field]: value } }))
  const updateTemplateDayBreak = (day: number, index: number, field: 'startTime' | 'endTime', value: string) => setTemplateDays((current) => ({ ...current, [day]: { ...current[day], breaks: current[day].breaks.map((item, i) => i === index ? { ...item, [field]: value } : item) } }))
  const addTemplateDayBreak = (day: number) => setTemplateDays((current) => ({ ...current, [day]: { ...current[day], breaks: [...current[day].breaks, { startTime: '12:00', endTime: '13:00' }] } }))
  const removeTemplateDayBreak = (day: number, index: number) => setTemplateDays((current) => ({ ...current, [day]: { ...current[day], breaks: current[day].breaks.filter((_, i) => i !== index) } }))
  const shiftCalendar = (direction: number) => {
    const current = new Date(calendarStart + 'T12:00:00Z')
    if (calendarPeriod === 'month') current.setUTCMonth(current.getUTCMonth() + direction)
    else current.setUTCDate(current.getUTCDate() + direction * (calendarPeriod === 'week' ? 7 : 14))
    setWeekStart(calendarPeriod === 'month' ? current.toISOString().slice(0, 7) + '-01' : mondayOf(current.toISOString().slice(0, 10)))
    setSelectedDate(current.toISOString().slice(0, 10))
    setEditingDay(false)
  }
  const changeCalendarPeriod = (period: 'week' | 'fortnight' | 'month') => {
    setCalendarPeriod(period); setEditingDay(false)
    setWeekStart(period === 'month' ? weekStart.slice(0, 7) + '-01' : mondayOf(weekStart))
  }

  return <div className="schedule-page">
    <header className="schedule-page__header"><div><p className="eyebrow">Pracovní doba</p><h2>{activeSection === 'calendar' ? 'Moje směny' : 'Běžný pracovní týden'}</h2><p className="schedule-muted">{activeSection === 'calendar' ? 'Klepněte na den pro úpravu směny nebo volno.' : 'Připravte týden a zvolte, kdy má platit.'}</p></div><button type="button" className="ghost-button" disabled={saving || loading} onClick={refresh}>Obnovit</button></header>
    <nav className="schedule-sections" aria-label="Část plánování směn"><button type="button" aria-pressed={activeSection === 'calendar'} className={'schedule-section' + (activeSection === 'calendar' ? ' schedule-section--active' : '')} disabled={saving} onClick={() => { setActiveSection('calendar'); setEditingTemplate(false); setApplyingTemplateId('') }}><strong>Kalendář směn</strong><span>Směny a jednorázové změny</span></button><button type="button" aria-pressed={activeSection === 'templates'} className={'schedule-section' + (activeSection === 'templates' ? ' schedule-section--active' : '')} disabled={saving} onClick={() => { setActiveSection('templates'); setEditingDay(false) }}><strong>Běžný týden</strong><span>Opakující se pracovní doba</span></button></nav>
    <section className="panel schedule-toolbar" aria-label="Výběr rozvrhu">
      <label className="booking-field">Terapeutka<select className="field-control" disabled={metadataLoading || saving || !isAdmin} value={therapistId} onChange={(event) => { setTherapistId(Number(event.target.value)); setEditingDay(false); setEditingTemplate(false); setApplyingTemplateId(''); setMessage('') }}>{therapists.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}</select></label>
      {activeSection === 'calendar' && <div className="schedule-calendar-controls"><div className="schedule-period-switcher" role="group" aria-label="Rozsah přehledu">{(['week', 'fortnight', 'month'] as const).map((period) => <button key={period} type="button" aria-pressed={calendarPeriod === period} className={'schedule-period' + (calendarPeriod === period ? ' schedule-period--active' : '')} disabled={saving} onClick={() => changeCalendarPeriod(period)}>{period === 'week' ? 'Týden' : period === 'fortnight' ? '2 týdny' : 'Měsíc'}</button>)}</div><div className="schedule-week-controls"><button type="button" className="secondary-button" disabled={saving} aria-label="Předchozí období" onClick={() => shiftCalendar(-1)}>←</button><strong>{calendarLabel}</strong><button type="button" className="secondary-button" disabled={saving} aria-label="Následující období" onClick={() => shiftCalendar(1)}>→</button><button type="button" className="ghost-button" disabled={saving} onClick={() => { setWeekStart(mondayOf(dateKey())); setSelectedDate(dateKey()); setEditingDay(false) }}>Dnes</button></div></div>}
    </section>
    {metadataError && <div role="alert" className="error-banner">{metadataError}<button type="button" className="ghost-button" onClick={() => setMetadataRevision((value) => value + 1)}>Zkusit znovu</button></div>}
    {error && <div role="alert" className="error-banner">{error}<button type="button" className="ghost-button" disabled={saving} onClick={refresh}>Obnovit přehled</button></div>}
    {message && <p role="status" className="booking-success">{message}</p>}
    {loading && <p role="status" className="booking-hint">Načítání směn…</p>}
    {activeSection === 'calendar' && !loading && !error && <section className="schedule-week" aria-label="Pracovní týden">{displayDays.map((day) => {
      const state = day.outsideMonth ? 'outside' : day.isHoliday ? 'holiday' : day.isDayOff ? 'dayoff' : day.hasOverride ? 'override' : day.intervals.length ? 'working' : 'closed'
      return <button type="button" key={day.date} disabled={day.outsideMonth || day.isHoliday || saving} aria-pressed={editingDay && selectedDate === day.date} className={'schedule-day schedule-day--' + state + (editingDay && selectedDate === day.date ? ' schedule-day--active' : '')} onClick={() => selectDay(day.date)}><strong className="schedule-date-label">{dateLabel(day.date)}</strong><small>{day.outsideMonth ? '' : day.isHoliday ? 'Svátek' : day.isDayOff ? 'Volno' : day.intervals.length ? intervalLabel(day.intervals) : 'Bez směny'}</small>{day.hasOverride && !day.isHoliday && <span>Jednorázová změna</span>}</button>
    })}</section>}
    {activeSection === 'calendar' && !loading && !error && !days.some((day) => day.intervals.length) && <div className="booking-empty"><p>V tomto období není nastavena pracovní doba. Použijte běžný týden nebo klepněte na den a nastavte směnu.</p><button type="button" className="secondary-button" disabled={saving} onClick={() => { setActiveSection('templates'); setEditingDay(false) }}>Nastavit běžný týden</button></div>}
    {activeSection === 'templates' && <section className="panel schedule-template-library">
      <div className="booking-section-heading"><div><h3>Moje běžné týdny</h3><p className="schedule-muted">Uložte si pracovní týden a potom zvolte, od kdy má platit.</p></div><button type="button" className="primary-button" disabled={saving || loading} onClick={() => { setSelectedTemplateSetId(''); setTemplateName(''); setTemplate({ days: [1, 2, 3, 4, 5], workStart: '08:00', workEnd: '16:00', breaks: [], validFrom: '', validTo: '' }); setTemplateDays(Object.fromEntries([1, 2, 3, 4, 5].map((day) => [day, { workStart: '08:00', workEnd: '16:00', breaks: [] }]))); setEditingTemplate(true); setApplyingTemplateId('') }}>+ Nový běžný týden</button></div>
      {!loading && !templateSets.some((item) => item.is_active) && <p className="booking-empty">Zatím nemáte uložený běžný týden. Vytvořte první a použijte jej pro zvolené období.</p>}
      <div className="schedule-template-list">{templateSets.filter((item) => item.is_active).map((item) => <article className="schedule-template" key={item.id}><div><strong>{item.name}</strong><span>{[...new Set(item.days.map((day) => day.day_of_week))].map((day) => weekdayNames[day - 1]).join(' · ')}</span></div><div className="schedule-template-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => { setApplyingTemplateId(item.id); setApplyFrom(selectedDate); setApplyTo(''); setEditingTemplate(false) }}>Použít od…</button><button type="button" className="ghost-button" disabled={saving} onClick={() => hydrateTemplateEditor(item)}>Upravit</button><button type="button" className="ghost-button" disabled={saving} onClick={() => deleteTemplateSet(item.id)}>Deaktivovat</button></div></article>)}</div>
    </section>}
    <div ref={editorRef} tabIndex={-1} className="schedule-editor-anchor">
    {activeSection === 'templates' && applyingTemplateId && <form className="panel schedule-apply-panel" onSubmit={(event) => { event.preventDefault(); const item = templateSets.find((entry) => entry.id === applyingTemplateId); if (item) void applyTemplateSet(item) }}>
      <h3>Použít „{templateSets.find((item) => item.id === applyingTemplateId)?.name}“</h3><p className="schedule-muted">V tomto období se otevřou termíny pro objednávání. Jednorázové změny dnů mají přednost.</p>
      <fieldset className="booking-fieldset" disabled={saving}><div className="schedule-form__row"><label className="booking-field">Od<input className="field-control" type="date" required value={applyFrom} onChange={(event) => setApplyFrom(event.target.value)} /></label><label className="booking-field">Do (nepovinné)<input className="field-control" type="date" min={applyFrom} value={applyTo} onChange={(event) => setApplyTo(event.target.value)} /></label></div><div className="inline-actions"><button type="submit" className="primary-button">{saving ? 'Ukládání…' : 'Použít pro toto období'}</button><button type="button" className="ghost-button" onClick={() => setApplyingTemplateId('')}>Zpět</button></div></fieldset>
    </form>}
    {activeSection === 'templates' && editingTemplate && <form className="panel schedule-form" onSubmit={saveTemplate}>
      <h3>{selectedTemplateSetId ? 'Upravit běžný týden' : 'Nový běžný týden'}</h3><p className="schedule-muted">Uložení týden pouze připraví. Do kalendáře jej vložíte tlačítkem „Použít od…“.</p>
      <fieldset className="booking-fieldset" disabled={saving}>
        <label>Název<input className="field-control" required maxLength={100} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Např. Běžný týden" /></label>
        <fieldset className="schedule-day-picker"><legend>Pracovní dny</legend>{weekdayNames.map((name, index) => <label key={name}><input type="checkbox" checked={template.days.includes(index + 1)} onChange={() => toggleTemplateDay(index + 1)} />{name}</label>)}</fieldset>
        <button type="button" className="ghost-button" onClick={copyFirstDayToAll} disabled={template.days.length < 2}>Zkopírovat časy prvního dne do ostatních</button>
        {template.days.map((day) => <details className="schedule-day-editor" key={day} open={template.days[0] === day ? true : undefined}><summary><strong>{weekdayNames[day - 1]} <span aria-hidden="true">⌄</span></strong><span>{templateDays[day].workStart}–{templateDays[day].workEnd}{templateDays[day].breaks.length ? ' · s přestávkou' : ''}</span></summary><div className="schedule-form__row"><label>Od<input className="field-control" type="time" required value={templateDays[day].workStart} onChange={(event) => updateTemplateDay(day, 'workStart', event.target.value)} /></label><label>Do<input className="field-control" type="time" required value={templateDays[day].workEnd} onChange={(event) => updateTemplateDay(day, 'workEnd', event.target.value)} /></label></div><ScheduleIntervals breaks={templateDays[day].breaks} onChange={(index, field, value) => updateTemplateDayBreak(day, index, field, value)} onAdd={() => addTemplateDayBreak(day)} onRemove={(index) => removeTemplateDayBreak(day, index)} /></details>)}
        <div className="inline-actions"><button type="submit" className="primary-button" disabled={!therapistId || !template.days.length}>{saving ? 'Ukládání…' : 'Uložit běžný týden'}</button><button type="button" className="ghost-button" onClick={() => setEditingTemplate(false)}>Zpět</button></div>
      </fieldset>
    </form>}
    {activeSection === 'calendar' && editingDay && <form className="panel schedule-form" onSubmit={saveOverride}>
      <div className="booking-section-heading"><h3>{dayLabel(selectedDate)}</h3><button type="button" className="ghost-button" disabled={saving} onClick={() => setEditingDay(false)}>Zavřít</button></div>
      <p className="schedule-muted">Změna platí pouze pro tento den. Ostatní směny se nezmění.</p>
      {dayLoading && <p role="status">Načítání pracovní doby…</p>}
      {dayError && <div role="alert" className="error-banner">{dayError}<button type="button" className="ghost-button" onClick={refresh}>Zkusit znovu</button></div>}
      <fieldset className="booking-fieldset" disabled={saving || dayLoading || Boolean(dayError)}>
        <div className="booking-chip-row" role="group" aria-label="Pracovní režim dne"><button type="button" aria-pressed={!override.isDayOff} className={'booking-chip' + (!override.isDayOff ? ' booking-chip--active' : '')} onClick={() => setOverride({ ...override, isDayOff: false })}>Pracuji</button><button type="button" aria-pressed={override.isDayOff} className={'booking-chip' + (override.isDayOff ? ' booking-chip--active' : '')} onClick={() => setOverride({ ...override, isDayOff: true })}>Volno</button></div>
        {!override.isDayOff && <><div className="schedule-form__row"><label>Od<input className="field-control" type="time" required value={override.workStart} onChange={(event) => setOverride({ ...override, workStart: event.target.value })} /></label><label>Do<input className="field-control" type="time" required value={override.workEnd} onChange={(event) => setOverride({ ...override, workEnd: event.target.value })} /></label></div><ScheduleIntervals breaks={override.breaks} onChange={updateOverrideBreak} onAdd={addOverrideBreak} onRemove={removeOverrideBreak} /></>}
        <button type="submit" className="primary-button" disabled={!therapistId}>{saving ? 'Ukládání…' : override.isDayOff ? 'Uložit den volna' : 'Uložit pracovní dobu'}</button>
      </fieldset>
      <p className="booking-hint">Pokud změně brání návštěva, nejdříve ji přesuňte nebo omluvte v plánu rezervací.</p>
    </form>}
    </div>
    {activeSection === 'templates' && <details className="panel schedule-history"><summary>Platná pracovní doba a historie</summary><p className="schedule-muted">Jednotlivé použité pracovní intervaly. Deaktivace běžného týdne výše již naplánované směny nezmění.</p><div className="schedule-template-list">{templates.map((item) => <article key={item.id} className="schedule-template"><div><strong>{weekdayNames[item.day_of_week - 1]} · {time(item.start_time)}–{time(item.end_time)}</strong><span>{String(item.valid_from).slice(0, 10)} – {item.valid_to ? String(item.valid_to).slice(0, 10) : 'bez konce'} · {item.is_active ? 'Platná' : 'Neaktivní'}</span></div>{item.is_active && <button type="button" className="ghost-button" disabled={saving} onClick={() => deactivate(item.id)}>Deaktivovat interval</button>}</article>)}</div></details>}
  </div>
}
