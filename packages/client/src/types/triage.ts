export const CARE_LABELS = [
  'Self-care',
  'Routine GP',
  'Urgent Primary Care',
  'A&E',
  'Ambulance',
] as const

export type CareLabel = (typeof CARE_LABELS)[number]

export type RegionKey = 'epigastric' | 'periumbilical' | 'rlq' | 'llq' | 'general'

export type SymptomItem = {
  id: string
  label: string
  detail: string
}

export type TriageCase = {
  caseId: string
  id?: string
  label: string
  target: CareLabel
  opening: string
  patientCard: string
  probabilities: Record<CareLabel, number>
  notes: string
  regions: Record<string, string>
  symptoms: SymptomItem[]
}

export type RevealedClue = {
  id: string
  label: string
  detail: string
  source: 'symptom' | 'region' | 'manual' | 'opening'
}

export type ChatRole = 'patient' | 'doctor' | 'system'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}
