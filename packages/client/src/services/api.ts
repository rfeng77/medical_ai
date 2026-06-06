export type ChatApiRequest = {
  participantId: string
  caseId: string
  condition: 'chat' | 'reasoning'
  message: string
}

export type ChatApiResponse = {
  response: string
  extractedFields?: Record<string, unknown>
  aiVisibleFields?: Record<string, unknown>
  monitorResult?: unknown
  dialoguePlan?: unknown
  safetyPassed?: boolean
  safetyNotes?: string[]
}

export type CaseApiResponse = {
  cases?: TriageCaseApiItem[]
}

export type TriageCaseApiItem = {
  caseId?: string
  id?: string
  label: string
  target: string
  opening: string
  patientCard: string
  probabilities?: Record<string, number>
  notes?: string
  regions?: Record<string, string>
  symptoms?: { id: string; label: string; detail: string }[]
}

export type RevealApiRequest = {
  participantId: string
  caseId: string
  condition: 'chat' | 'reasoning'
  clueId: string
}

export type DecisionApiRequest = {
  participantId: string
  caseId: string
  condition: 'chat' | 'reasoning'
  decision: string
  explanation?: string
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

async function getJson<TResponse>(path: string): Promise<TResponse> {
  const resp = await fetch(`${API_BASE}${path}`)

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`API request failed: ${resp.status} ${text}`)
  }

  return resp.json()
}

async function postJson<TResponse>(
  path: string,
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Chat API failed: ${resp.status} ${text}`)
  }

  return resp.json()
}

export async function fetchCases(): Promise<TriageCaseApiItem[]> {
  const response = await getJson<CaseApiResponse | TriageCaseApiItem[]>('/api/cases')
  return Array.isArray(response) ? response : response.cases ?? []
}

export async function sendChatMessage(
  payload: ChatApiRequest,
): Promise<ChatApiResponse> {
  return postJson<ChatApiResponse>('/api/chat', payload)
}

export async function revealClue(payload: RevealApiRequest): Promise<unknown> {
  return postJson('/api/reveal', payload)
}

export async function submitDecision(
  payload: DecisionApiRequest,
): Promise<unknown> {
  return postJson('/api/decision', payload)
}
