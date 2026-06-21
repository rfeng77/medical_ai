import type { ChatConditionPanelProps } from './ChatConditionPanel'
import { ChatConditionPanel } from './ChatConditionPanel'
import { ReasoningConditionPanel } from './ReasoningConditionPanel'
import type { Condition } from '../utils/condition'

type LeftPanelProps = ChatConditionPanelProps & {
  condition: Condition
  onReasoningSubmit: (reasoning: string) => void
}

export function LeftPanel({
  condition,
  onReasoningSubmit,
  ...chatProps
}: LeftPanelProps) {
  if (condition === 'reasoning') {
    return (
      <ReasoningConditionPanel
        messages={chatProps.messages}
        disabled={chatProps.disabled}
        error={chatProps.error}
        ratingPanel={chatProps.ratingPanel}
        onSubmit={onReasoningSubmit}
      />
    )
  }

  return <ChatConditionPanel {...chatProps} />
}
