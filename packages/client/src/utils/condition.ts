export type Condition = 'chat' | 'reasoning'

export function getConditionFromUrl(): Condition {
  const params = new URLSearchParams(window.location.search)
  const condition = params.get('condition')

  if (condition === 'chat' || condition === 'reasoning') {
    return condition
  }

  console.warn(
    condition
      ? `Invalid condition "${condition}" in URL. Defaulting to "chat".`
      : 'Missing condition in URL. Defaulting to "chat".',
  )
  return 'chat'
}
