import type { RevealedClue } from '../types/triage'

type RevealLogProps = {
  revealedClues: RevealedClue[]
}

export function RevealLog({ revealedClues }: RevealLogProps) {
  return (
    <section className="info-card reveal-log-card">
      <h2>Revealed Information Log</h2>
      {revealedClues.length === 0 ? (
        <p className="muted">No case information has been revealed yet.</p>
      ) : (
        <ol className="reveal-log">
          {revealedClues.map((clue) => (
            <li key={clue.id}>
              <strong>{clue.label}</strong>
              <span>{clue.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
