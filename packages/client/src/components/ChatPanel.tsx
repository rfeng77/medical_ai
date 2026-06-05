import type { ChatMessage as ChatMessageType } from '../types/triage'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { QuickActions } from './QuickActions'

type ChatPanelProps = {
  messages: ChatMessageType[]
  canConclude: boolean
  disabled: boolean
  isThinking: boolean
  error: string | null
  onOpening: () => void
  onReset: () => void
  onConclude: () => void
  onSend: (message: string) => void
}

export function ChatPanel({
  messages,
  canConclude,
  disabled,
  isThinking,
  error,
  onOpening,
  onReset,
  onConclude,
  onSend,
}: ChatPanelProps) {
  return (
    <section className="chat-panel">
      {error ? <div className="error-banner">{error}</div> : null}
      <MessageList messages={messages} isThinking={isThinking} />
      <QuickActions
        canConclude={canConclude}
        disabled={disabled}
        onOpening={onOpening}
        onReset={onReset}
        onConclude={onConclude}
      />
      <ChatInput disabled={disabled} onSend={onSend} />
    </section>
  )
}
