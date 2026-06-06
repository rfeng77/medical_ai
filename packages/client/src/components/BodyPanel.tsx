import type { Condition } from "../utils/condition";
import type { RevealedClue, TriageCase } from "../types/triage";
import { BodyMap } from "./BodyMap";
import { InfoPanel } from "./InfoPanel";

type BodyPanelProps = {
  currentCase: TriageCase;
  condition: Condition;
  revealedClues: RevealedClue[];
  onReveal: (clue: RevealedClue) => void;
};

export function BodyPanel({
  currentCase,
  condition,
  revealedClues,
  onReveal,
}: BodyPanelProps) {
  return (
    <aside className="body-panel panel-right">
      <section className="body-card body-zone">
        <div className="panel-heading">
          <h2>Body Map</h2>
        </div>
        <BodyMap
          currentCase={currentCase}
          condition={condition}
          revealedClues={revealedClues}
          onReveal={onReveal}
        />
      </section>
      <InfoPanel currentCase={currentCase} condition={condition} />
    </aside>
  );
}
