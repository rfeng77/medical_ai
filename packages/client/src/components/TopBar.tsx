import type { Condition } from '../utils/condition'

type TopBarProps = {
  isThinking: boolean
  condition: Condition
}

export function TopBar({ isThinking, condition }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="topbar-title-block">
        <p className="eyebrow">MedChat Study Console</p>
        <h1>Abdominal Pain Triage</h1>
      </div>
      <div className="topbar-meta">
        {/* TODO: Remove after Qualtrics condition testing is complete. */}
        <span className="condition-label">Condition: {condition}</span>
        <span className={`status-pill ${isThinking ? 'thinking' : 'ready'}`}>
          {isThinking ? 'Thinking' : 'Ready'}
        </span>
      </div>
    </header>
  )
}
