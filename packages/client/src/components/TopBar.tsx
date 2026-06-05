type TopBarProps = {
  isThinking: boolean
}

export function TopBar({ isThinking }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="topbar-title-block">
        <p className="eyebrow">MedChat Study Console</p>
        <h1>Abdominal Pain Triage</h1>
      </div>
      <span className={`status-pill ${isThinking ? 'thinking' : 'ready'}`}>
        {isThinking ? 'Thinking' : 'Ready'}
      </span>
    </header>
  )
}
