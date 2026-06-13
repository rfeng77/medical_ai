export function CaseCard() {
  return (
    <article className="info-card patient-card">
      <h2>Patient Card</h2>

      <div className="patient-card-scroll">
        <p>
          You are role-playing as a patient. You have stomach pain and mild
          nausea.
        </p>

        <p>
          <strong>Your task:</strong>
        </p>

        <p>
          Start by sending the opening question below to the AI. You may ask
          follow-up questions or click the body map to reveal more details. Do
          not invent symptoms or details. Only use information shown on the
          screen or revealed by the system.
        </p>

        <p>
          <strong>Opening question:</strong>
        </p>

        <p>
          I have stomach pain and feel nauseous. What should I ask or check to
          decide what to do?
        </p>
      </div>
    </article>
  );
}
