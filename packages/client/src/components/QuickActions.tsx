type QuickActionsProps = {
  canConclude: boolean
  disabled: boolean
  onOpening: () => void
  onReset: () => void
  onConclude: () => void
}

export function QuickActions({
  canConclude,
  disabled,
  onOpening,
  onReset,
  onConclude,
}: QuickActionsProps) {
  return (
    <div className="quick-actions">
      <button type="button" onClick={onOpening} disabled={disabled}>
        Send opening complaint
      </button>
      <button type="button" onClick={onConclude} disabled={!canConclude || disabled}>
        Conclude
      </button>
      <button type="button" onClick={onReset}>
        Reset trial
      </button>
    </div>
  )
}
