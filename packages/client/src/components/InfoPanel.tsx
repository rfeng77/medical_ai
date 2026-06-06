import type { TriageCase } from '../types/triage'
import type { Condition } from '../utils/condition'
import { CaseCard } from './CaseCard'
import { TriageDecisionCard } from './TriageDecisionCard'

type InfoPanelProps = {
  currentCase: TriageCase
  condition: Condition
}

export function InfoPanel({
  currentCase,
  condition,
}: InfoPanelProps) {
  return (
    <div className="info-panel">
      <CaseCard />
      <TriageDecisionCard
        key={currentCase.caseId}
        currentCase={currentCase}
        condition={condition}
      />
    </div>
  )
}
