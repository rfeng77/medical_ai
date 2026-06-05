import type { ChatMessage as ChatMessageType } from '../types/triage'

type ChatMessageProps = {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <article className={`message ${message.role}`}>
      <span>{message.role === 'doctor' ? 'Doctor' : message.role === 'patient' ? 'Patient' : 'System'}</span>
      <p>{message.content}</p>
    </article>
  )
}
