import { useMemo, useState } from 'react'
import { BodyPanel } from './components/BodyPanel'
import { ChatPanel } from './components/ChatPanel'
import { ConclusionPanel } from './components/ConclusionPanel'
import { TopBar } from './components/TopBar'
import { CASES, MAX_TURNS, MIN_TURNS } from './data/cases'
import { generateDoctorResponse } from './services/gemini'
import type {
  ChatMessage,
  GeminiMessage,
  RevealedClue,
  SymptomItem,
} from './types/triage'
import './styles/app.css'

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toGeminiMessages(messages: ChatMessage[]): GeminiMessage[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'doctor' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

function App() {
  const [currentCaseId, setCurrentCaseId] = useState(CASES[0].id)
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([])
  const [revealedClues, setRevealedClues] = useState<RevealedClue[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [doctorTurns, setDoctorTurns] = useState(0)
  const [sessionConcluded, setSessionConcluded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCase = useMemo(
    () => CASES.find((caseItem) => caseItem.id === currentCaseId) ?? CASES[0],
    [currentCaseId],
  )

  const revealedSymptoms = useMemo(
    () =>
      new Set(
        revealedClues
          .filter((clue) => clue.source === 'symptom')
          .map((clue) => clue.id.replace('symptom-', '')),
      ),
    [revealedClues],
  )

  const controlsLocked = isThinking || sessionConcluded || doctorTurns >= MAX_TURNS

  function resetTrial(caseId = currentCaseId) {
    setCurrentCaseId(caseId)
    setConversationHistory([])
    setRevealedClues([])
    setIsThinking(false)
    setDoctorTurns(0)
    setSessionConcluded(false)
    setError(null)
  }

  async function sendPatientMessage(content: string) {
    if (controlsLocked) return

    const patientMessage: ChatMessage = {
      id: createId('patient'),
      role: 'patient',
      content,
    }
    const nextHistory = [...conversationHistory, patientMessage]

    setConversationHistory(nextHistory)
    setIsThinking(true)
    setError(null)

    try {
      const doctorResponse = await generateDoctorResponse(toGeminiMessages(nextHistory))
      const doctorMessage: ChatMessage = {
        id: createId('doctor'),
        role: 'doctor',
        content: doctorResponse,
      }

      setConversationHistory([...nextHistory, doctorMessage])
      setDoctorTurns((turns) => {
        const nextTurns = turns + 1
        if (nextTurns >= MAX_TURNS) {
          setSessionConcluded(true)
        }
        return nextTurns
      })
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to generate a doctor response.'
      setError(message)
    } finally {
      setIsThinking(false)
    }
  }

  function revealClue(clue: RevealedClue) {
    if (controlsLocked || revealedClues.some((item) => item.id === clue.id)) return
    setRevealedClues((items) => [...items, clue])
    void sendPatientMessage(clue.detail)
  }

  function handleOpening() {
    revealClue({
      id: 'opening',
      label: 'Opening complaint',
      detail: currentCase.opening,
      source: 'opening',
    })
  }

  function handleRevealSymptom(symptom: SymptomItem) {
    revealClue({
      id: `symptom-${symptom.id}`,
      label: symptom.label,
      detail: symptom.detail,
      source: 'symptom',
    })
  }

  function handleConclude() {
    if (doctorTurns >= MIN_TURNS) {
      setSessionConcluded(true)
    }
  }

  return (
    <div className="app-shell">
      <TopBar isThinking={isThinking} />
      <main className="triage-layout">
        <ChatPanel
          messages={conversationHistory}
          canConclude={doctorTurns >= MIN_TURNS}
          disabled={controlsLocked}
          isThinking={isThinking}
          error={error}
          onOpening={handleOpening}
          onReset={() => resetTrial()}
          onConclude={handleConclude}
          onSend={sendPatientMessage}
        />
        <BodyPanel
          currentCase={currentCase}
          revealedSymptoms={revealedSymptoms}
          disabled={controlsLocked}
          onRevealSymptom={handleRevealSymptom}
        />
      </main>
      {sessionConcluded ? (
        <ConclusionPanel currentCase={currentCase} doctorTurns={doctorTurns} />
      ) : null}
    </div>
  )
}

export default App
