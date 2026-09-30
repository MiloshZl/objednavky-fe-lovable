export function therapistTone(therapistId: number | '', ownTherapistId?: number | null) {
  if (!therapistId || !ownTherapistId) return 'neutral'
  return Number(therapistId) === Number(ownTherapistId) ? 'own' : 'other'
}

export function therapistRelation(therapistId: number, ownTherapistId?: number | null) {
  if (!ownTherapistId) return ''
  return Number(therapistId) === Number(ownTherapistId) ? ' · já' : ' · kolegyně'
}
