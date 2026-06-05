import type { SymptomItem, TriageCase } from '../types/triage'
import { CaseCard } from './CaseCard'
import { SymptomRevealCard } from './SymptomRevealCard'

type InfoPanelProps = {
  currentCase: TriageCase
  revealedSymptoms: Set<string>
  disabled: boolean
  onRevealSymptom: (symptom: SymptomItem) => void
}

export function InfoPanel({
  currentCase,
  revealedSymptoms,
  disabled,
  onRevealSymptom,
}: InfoPanelProps) {
  return (
    <div className="info-panel">
      <CaseCard currentCase={currentCase} />
      <SymptomRevealCard
        symptoms={currentCase.symptoms}
        revealedIds={revealedSymptoms}
        disabled={disabled}
        onReveal={onRevealSymptom}
      />
    </div>
  )
}
