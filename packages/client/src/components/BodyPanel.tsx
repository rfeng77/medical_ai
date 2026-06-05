import type { SymptomItem, TriageCase } from "../types/triage";
import { BodyMap } from "./BodyMap";
import { InfoPanel } from "./InfoPanel";

type BodyPanelProps = {
  currentCase: TriageCase;
  revealedSymptoms: Set<string>;
  disabled: boolean;
  onRevealSymptom: (symptom: SymptomItem) => void;
};

export function BodyPanel({
  currentCase,
  revealedSymptoms,
  disabled,
  onRevealSymptom,
}: BodyPanelProps) {
  return (
    <aside className="body-panel panel-right">
      <section className="body-card body-zone">
        <div className="panel-heading">
          <h2>Body Map</h2>
          <p>Hover over a region to preview the finding.</p>
        </div>
        <BodyMap />
      </section>
      <InfoPanel
        currentCase={currentCase}
        revealedSymptoms={revealedSymptoms}
        disabled={disabled}
        onRevealSymptom={onRevealSymptom}
      />
    </aside>
  );
}
