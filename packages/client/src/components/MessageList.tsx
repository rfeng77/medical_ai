import type { ChatMessage as ChatMessageType } from '../types/triage'
import { ChatMessage } from './ChatMessage'

type MessageListProps = {
  messages: ChatMessageType[]
  isThinking: boolean
  emptyMessage?: string
}

export function MessageList({ messages, isThinking, emptyMessage }: MessageListProps) {
  return (
    <div className="message-list" aria-live="polite">
      {messages.length === 0 ? (
        <div className="empty-chat">
          {emptyMessage ?? 'Send the opening complaint or reveal a symptom to begin the study turn.'}
        </div>
      ) : (
        messages.map((message) => <ChatMessage key={message.id} message={message} />)
      )}
      {isThinking ? (
        <article className="message doctor thinking-message">
          <span>Doctor</span>
          <p>Composing response...</p>
        </article>
      ) : null}
    </div>
  )
}
