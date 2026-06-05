import { useMemo, useState } from 'react'

export function ReasoningConditionPanel() {
  const [notes, setNotes] = useState('')

  const wordCount = useMemo(() => {
    const trimmed = notes.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [notes])

  return (
    <section className="chat-panel reasoning-panel">
      <div className="reasoning-header">
        <h2>Clinical Reasoning Notes</h2>
        <p>
          Please review the available patient information and write your reasoning about the
          likely triage decision.
        </p>
      </div>
      <textarea
        className="reasoning-textarea"
        aria-label="Clinical reasoning notes"
        placeholder="Write your clinical reasoning notes here..."
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <div className="reasoning-footer">
        <span>
          {wordCount} words / {notes.length} characters
        </span>
        <button type="button">Save reasoning</button>
      </div>
    </section>
  )
}
