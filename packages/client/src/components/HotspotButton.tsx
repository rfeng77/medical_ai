import type { RegionKey } from '../types/triage'

type HotspotButtonProps = {
  id: RegionKey
  label: string
  revealed: boolean
  disabled: boolean
  onReveal: (region: RegionKey) => void
}

export function HotspotButton({ id, label, revealed, disabled, onReveal }: HotspotButtonProps) {
  return (
    <button
      type="button"
      className={`hotspot hotspot-${id} ${revealed ? 'revealed' : ''}`}
      disabled={disabled || revealed}
      onClick={() => onReveal(id)}
    >
      {label}
    </button>
  )
}
