import { CARE_LABELS, type TriageCase } from '../types/triage'

type ProbabilityDistributionProps = {
  currentCase: TriageCase
}

export function ProbabilityDistribution({ currentCase }: ProbabilityDistributionProps) {
  return (
    <section className="info-card probability-card">
      <h2>Probability Distribution</h2>
      <div className="probability-list">
        {CARE_LABELS.map((label) => {
          const value = currentCase.probabilities[label]
          return (
            <div className="probability-row" key={label}>
              <div className="probability-label">
                <span>{label}</span>
                <strong>{value}%</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${value}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
