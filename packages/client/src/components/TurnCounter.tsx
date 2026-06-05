type TurnCounterProps = {
  doctorTurns: number
  minTurns: number
  maxTurns: number
}

export function TurnCounter({ doctorTurns, minTurns, maxTurns }: TurnCounterProps) {
  return (
    <section className="turn-counter" aria-label="Doctor turn counter">
      <div>
        <span className="counter-number">{doctorTurns}</span>
        <span>Doctor turns</span>
      </div>
      <div>
        <span>Minimum to conclude: {minTurns}</span>
        <span>Maximum: {maxTurns}</span>
      </div>
    </section>
  )
}
