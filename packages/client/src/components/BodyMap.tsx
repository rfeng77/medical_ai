import { useState } from "react";
import { HumanBodySvg } from "./HumanBodySvg";
import {
  BODY_HOTSPOTS,
  BODY_REGION_FINDINGS,
  type BodyHotspot,
} from "../data/bodyHotspots";
import { revealClue } from "../services/api";
import type { RevealedClue, TriageCase } from "../types/triage";
import type { Condition } from "../utils/condition";

type BodyMapProps = {
  currentCase: TriageCase;
  condition: Condition;
  revealedClues: RevealedClue[];
  onReveal: (clue: RevealedClue) => void;
};

export function BodyMap({
  currentCase,
  condition,
  revealedClues,
  onReveal,
}: BodyMapProps) {
  const [hoveredHotspot, setHoveredHotspot] = useState<BodyHotspot | null>(
    null,
  );

  async function handleRevealRegion(hotspot: BodyHotspot) {
    const detail = currentCase.regions[hotspot.inquiryKey] ?? BODY_REGION_FINDINGS[hotspot.inquiryKey]
    if (!detail || revealedClues.some((item) => item.id === hotspot.inquiryKey)) return

    onReveal({
      id: hotspot.inquiryKey,
      label: hotspot.label,
      detail,
      source: 'region',
    })

    await revealClue({
      participantId: 'test_web_001',
      caseId: currentCase.caseId,
      condition,
      clueId: hotspot.inquiryKey,
    }).catch((requestError) => {
      console.error('Reveal API failed', requestError)
    })
  }

  return (
    <div className="abdominal-map">
      <div className="body-svg-wrapper">
        <HumanBodySvg />

        {BODY_HOTSPOTS.map((hotspot) => (
          <button
            key={hotspot.id}
            type="button"
            className="body-hotspot-dot"
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
            }}
            aria-label={hotspot.label}
            title={hotspot.label}
            onMouseEnter={() => setHoveredHotspot(hotspot)}
            onMouseLeave={() => setHoveredHotspot(null)}
            onFocus={() => setHoveredHotspot(hotspot)}
            onBlur={() => setHoveredHotspot(null)}
            onClick={() => void handleRevealRegion(hotspot)}
          />
        ))}

        {hoveredHotspot ? (
          <div
            className="body-hotspot-tooltip"
            style={{
              left: `${hoveredHotspot.x}%`,
              top: `${hoveredHotspot.y}%`,
            }}
          >
            <strong>{hoveredHotspot.label}</strong>
            <span>
              {currentCase.regions[hoveredHotspot.inquiryKey] ??
                BODY_REGION_FINDINGS[hoveredHotspot.inquiryKey]}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
