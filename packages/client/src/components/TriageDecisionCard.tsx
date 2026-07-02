import { useState } from 'react'
import { submitDecision } from '../services/api'
import type { TriageCase } from '../types/triage'
import type { Condition } from '../utils/condition'

const TRIAGE_OPTIONS = [
  'Self-care',
  'Urgent Primary Care',
  'Ambulance',
] as const

type TriageOption = (typeof TRIAGE_OPTIONS)[number]
type ReasoningFieldKey =
  | 'stoodOut'
  | 'riskJudgment'
  | 'thinkingChange'
  | 'wantedInformation'

const REASONING_FIELDS: Array<{
  key: ReasoningFieldKey
  label: string
}> = [
  {
    key: 'stoodOut',
    label: 'Please describe what information stood out to you',
  },
  {
    key: 'riskJudgment',
    label: 'How you judged the level of risk or urgency',
  },
  {
    key: 'thinkingChange',
    label: 'If your thinking changed at any point, please explain what caused that change',
  },
  {
    key: 'wantedInformation',
    label:
      'If there was any information you wished you had, or anything you would have wanted to know before making your decision, please include that as well',
  },
]

const EMPTY_REASONING_DETAILS: Record<ReasoningFieldKey, string> = {
  stoodOut: '',
  riskJudgment: '',
  thinkingChange: '',
  wantedInformation: '',
}

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
  const [reasoningDetails, setReasoningDetails] = useState(EMPTY_REASONING_DETAILS)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const allRequiredFieldsComplete =
    selectedDecision !== null &&
    REASONING_FIELDS.every((field) => reasoningDetails[field.key].trim().length > 0)

  function updateReasoningField(key: ReasoningFieldKey, value: string) {
    setReasoningDetails((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  function buildReasoningSummary() {
    return REASONING_FIELDS.map((field) => `${field.label}: ${reasoningDetails[field.key].trim()}`).join('\n\n')
  }

  async function handleSave() {
    if (!allRequiredFieldsComplete) return

    setSaveStatus('Saving...')

    try {
      const reasoning = buildReasoningSummary()
      await submitDecision({
        participantId,
        caseId: currentCase.caseId,
        condition,
        sessionId,
        selectedDecision,
        reasoning,
        reasoningDetails,
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

      <div className="triage-reasoning-fields">
        {REASONING_FIELDS.map((field) => (
          <label className="triage-reasoning-field" key={field.key}>
            <span>{field.label}</span>
            <textarea
              className="triage-reasoning-input"
              value={reasoningDetails[field.key]}
              onChange={(event) => updateReasoningField(field.key, event.target.value)}
              required
              rows={3}
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        className="full-btn"
        onClick={() => void handleSave()}
        disabled={!allRequiredFieldsComplete}
      >
        Save decision
      </button>
      {saveStatus ? <p className="small-muted">{saveStatus}</p> : null}
    </section>
  )
}
