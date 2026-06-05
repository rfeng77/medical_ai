type StudyStripProps = {
  target: string
}

export function StudyStrip({ target }: StudyStripProps) {
  return (
    <section className="study-strip" aria-label="Study instructions">
      <strong>Research mode</strong>
      <span>
        Reveal only clicked information. The hidden target for this case is{' '}
        <strong>{target}</strong>.
      </span>
    </section>
  )
}
