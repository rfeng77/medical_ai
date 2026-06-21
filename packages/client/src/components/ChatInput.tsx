import { useState } from 'react'

type ChatInputProps = {
  disabled: boolean
  onSend: (message: string) => void
  placeholder?: string
}

export function ChatInput({ disabled, onSend, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('')

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className="chat-input">
      <textarea
        aria-label="Patient message"
        placeholder={disabled ? 'Trial is locked' : placeholder ?? 'Type patient response...'}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <button type="button" disabled={disabled || !value.trim()} onClick={submit}>
        Send
      </button>
    </div>
  )
}
