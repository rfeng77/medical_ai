import type { ChatConditionPanelProps } from './ChatConditionPanel'
import { ChatConditionPanel } from './ChatConditionPanel'
import { ReasoningConditionPanel } from './ReasoningConditionPanel'
import type { Condition } from '../utils/condition'

type LeftPanelProps = ChatConditionPanelProps & {
  condition: Condition
}

export function LeftPanel({ condition, ...chatProps }: LeftPanelProps) {
  if (condition === 'reasoning') {
    return <ReasoningConditionPanel />
  }

  return <ChatConditionPanel {...chatProps} />
}
