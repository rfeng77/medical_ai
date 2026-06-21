import type { ReactNode } from 'react'
import type { ChatMessage as ChatMessageType } from '../types/triage'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'

type ReasoningConditionPanelProps = {
  messages: ChatMessageType[]
  disabled: boolean
  error: string | null
  ratingPanel?: ReactNode
  onSubmit: (reasoning: string) => void
}

export function ReasoningConditionPanel({
  messages,
  disabled,
  error,
  ratingPanel,
  onSubmit,
}: ReasoningConditionPanelProps) {
  return (
    <section className="chat-panel reasoning-panel">
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="reasoning-header">
        <h2>Clinical Reasoning Notes</h2>
        <p>
          Write your reasoning at any time. If you open a new body-map point, submit a
          reasoning note before opening another new point.
        </p>
      </div>
      <MessageList
        messages={messages}
        isThinking={false}
        emptyMessage="Submit your reasoning notes here. You can start before or after opening a body-map point."
      />
      {ratingPanel}
      <ChatInput
        disabled={disabled}
        placeholder="Type your reasoning note..."
        onSend={onSubmit}
      />
    </section>
  )
}
