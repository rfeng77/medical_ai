import { useState } from 'react'
import { submitDecision } from '../services/api'
import type { TriageCase } from '../types/triage'
import type { Condition } from '../utils/condition'

const TRIAGE_OPTIONS = [
  'Self-care',
  'Routine GP',
  'Urgent Primary Care',
  'A&E',
  'Ambulance',
] as const

type TriageOption = (typeof TRIAGE_OPTIONS)[number]

type TriageDecisionCardProps = {
  currentCase: TriageCase
  condition: Condition
  participantId: string
  sessionId: string
}

export function TriageDecisionCard({
  currentCase,
  condition,
  participantId,
  sessionId,
}: TriageDecisionCardProps) {
  const [selectedDecision, setSelectedDecision] = useState<TriageOption | null>(null)
  const [reasoning, setReasoning] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  async function handleSave() {
    if (!selectedDecision) return

    setSaveStatus('Saving...')

    try {
      await submitDecision({
        participantId,
        caseId: currentCase.caseId,
        condition,
        sessionId,
        selectedDecision,
        reasoning,
      })
      setSaveStatus('Decision saved.')
    } catch (requestError) {
      setSaveStatus(
        requestError instanceof Error ? requestError.message : 'Decision could not be saved.',
      )
    }
  }

  return (
    <section className="info-card triage-decision-card">
      <h2>Your triage decision</h2>
      <p className="small-muted">
        Based on the available information, choose the most appropriate care destination.
      </p>

      <div className="triage-options">
        {TRIAGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={
              selectedDecision === option ? 'triage-option selected' : 'triage-option'
            }
            onClick={() => setSelectedDecision(option)}
          >
            {option}
          </button>
        ))}
      </div>

      <textarea
        className="triage-reasoning-input"
        value={reasoning}
        onChange={(event) => setReasoning(event.target.value)}
        placeholder="Briefly explain your decision..."
        rows={4}
      />

      <button
        type="button"
        className="full-btn"
        onClick={() => void handleSave()}
        disabled={!selectedDecision}
      >
        Save decision
      </button>
      {saveStatus ? <p className="small-muted">{saveStatus}</p> : null}
    </section>
  )
}
