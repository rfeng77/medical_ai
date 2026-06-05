import type { TriageCase } from '../types/triage'

type CaseCardProps = {
  currentCase: TriageCase
}

export function CaseCard({ currentCase }: CaseCardProps) {
  return (
    <section className="info-card case-card">
      <h2>Case Details</h2>
      <dl className="case-details">
        <div>
          <dt>Opening</dt>
          <dd>{currentCase.opening}</dd>
        </div>
        <div>
          <dt>Patient card</dt>
          <dd>{currentCase.patientCard}</dd>
        </div>
      </dl>
    </section>
  )
}
