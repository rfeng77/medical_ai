import type { TriageCase } from '../types/triage'

type ConclusionPanelProps = {
  currentCase: TriageCase
  doctorTurns: number
}

export function ConclusionPanel({ currentCase, doctorTurns }: ConclusionPanelProps) {
  return (
    <section className="conclusion-panel">
      <h2>Session Concluded</h2>
      <p>
        Final hidden target: <strong>{currentCase.target}</strong>
      </p>
      <p>Doctor turns completed: {doctorTurns}</p>
    </section>
  )
}
