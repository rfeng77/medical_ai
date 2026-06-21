export type ChatApiRequest = {
  participantId: string
  caseId: string
  condition: 'chat' | 'reasoning'
  sessionId: string
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
  sessionId: string
  regionKey: string
}

export type DecisionApiRequest = {
  participantId: string
  caseId: string
  condition: 'chat' | 'reasoning'
  sessionId: string
  selectedDecision: string
  reasoning: string
}

export type PostTurnRatingRequest = {
  participantId: string
  caseId: string
  condition: 'chat' | 'reasoning'
  sessionId: string
  turnIndex: number
  messageId?: string
  doctorMessageId?: string
  perceivedUrgency: number
  perceivedRisk: number
  confidence: number
  timestamp?: string
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

export async function sendChatMessageStream(
  payload: ChatApiRequest,
  onDelta: (text: string) => void,
): Promise<ChatApiResponse> {
  const resp = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Chat stream failed: ${resp.status} ${text}`)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let finalResponse: ChatApiResponse | null = null
  let streamedResponse = ''

  function handleEvent(event: string, data: string) {
    const parsed = JSON.parse(data) as { text?: string; error?: string } | ChatApiResponse

    if (event === 'delta') {
      const text = 'text' in parsed && typeof parsed.text === 'string' ? parsed.text : ''
      streamedResponse += text
      onDelta(text)
      return
    }

    if (event === 'final') {
      finalResponse = parsed as ChatApiResponse
      return
    }

    if (event === 'error') {
      const error = 'error' in parsed && typeof parsed.error === 'string' ? parsed.error : 'Chat stream failed.'
      throw new Error(error)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const rawEvent of events) {
      const lines = rawEvent.split('\n')
      const dataLines: string[] = []
      eventName = 'message'

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice('event:'.length).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trim())
        }
      }

      if (dataLines.length > 0) {
        handleEvent(eventName, dataLines.join('\n'))
      }
    }
  }

  if (!finalResponse) {
    return { response: streamedResponse }
  }

  return finalResponse
}

export async function revealClue(payload: RevealApiRequest): Promise<unknown> {
  return postJson('/api/reveal', payload)
}

export async function submitDecision(
  payload: DecisionApiRequest,
): Promise<unknown> {
  return postJson('/api/decision', payload)
}

export async function savePostTurnRatings(
  payload: PostTurnRatingRequest,
): Promise<unknown> {
  return postJson('/api/ratings', payload)
}
