import type { SymptomItem } from '../types/triage'

type SymptomRevealCardProps = {
  symptoms: SymptomItem[]
  revealedIds: Set<string>
  disabled: boolean
  onReveal: (symptom: SymptomItem) => void
}

export function SymptomRevealCard({
  symptoms,
  revealedIds,
  disabled,
  onReveal,
}: SymptomRevealCardProps) {
  return (
    <section className="info-card symptom-card">
      <h2>Symptom Reveal</h2>
      <div className="symptom-grid">
        {symptoms.map((symptom) => {
          const revealed = revealedIds.has(symptom.id)
          return (
            <button
              key={symptom.id}
              type="button"
              className={revealed ? 'revealed' : ''}
              disabled={disabled || revealed}
              onClick={() => onReveal(symptom)}
            >
              {symptom.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
