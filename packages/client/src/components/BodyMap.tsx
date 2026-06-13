import { useState, type CSSProperties } from "react";
import { HumanBodySvg } from "./HumanBodySvg";
import {
  BODY_HOTSPOTS,
  BODY_MARKER_STYLE,
  BODY_REGION_FINDINGS,
  type BodyHotspot,
} from "../data/bodyHotspots";
import { revealClue } from "../services/api";
import type { RevealedClue, TriageCase } from "../types/triage";
import type { Condition } from "../utils/condition";

type BodyMapProps = {
  currentCase: TriageCase;
  condition: Condition;
  participantId: string;
  sessionId: string;
  revealedClues: RevealedClue[];
  onReveal: (clue: RevealedClue) => void;
};

type BodyMarkerCssProperties = CSSProperties & {
  "--marker-width": string;
  "--marker-height": string;
  "--marker-box-fill": string;
  "--marker-box-hover-fill": string;
  "--marker-border-color": string;
  "--marker-border-width": string;
  "--marker-border-radius": string;
  "--marker-dot-size": string;
  "--marker-dot-color": string;
};

const BODY_MARKER_CSS_VARIABLES = {
  "--marker-box-fill": BODY_MARKER_STYLE.box.fill,
  "--marker-box-hover-fill": BODY_MARKER_STYLE.box.hoverFill,
  "--marker-border-color": BODY_MARKER_STYLE.box.borderColor,
  "--marker-border-width": `${BODY_MARKER_STYLE.box.borderWidth}px`,
  "--marker-border-radius": `${BODY_MARKER_STYLE.box.borderRadius}px`,
  "--marker-dot-size": `${BODY_MARKER_STYLE.dot.size}px`,
  "--marker-dot-color": BODY_MARKER_STYLE.dot.color,
};

export function BodyMap({
  currentCase,
  condition,
  participantId,
  sessionId,
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
      participantId,
      caseId: currentCase.caseId,
      condition,
      sessionId,
      regionKey: hotspot.inquiryKey,
    }).catch((requestError) => {
      console.error('Reveal API failed', requestError)
    })
  }

  return (
    <div className="abdominal-map">
      <div className="body-svg-wrapper">
        <HumanBodySvg />

        {BODY_HOTSPOTS.map((hotspot, index) => (
          <button
            key={hotspot.id}
            type="button"
            className="body-region-marker"
            style={{
              left: `${hotspot.x}%`,
              top: `${hotspot.y}%`,
              ...BODY_MARKER_CSS_VARIABLES,
              "--marker-width": `${hotspot.width ?? BODY_MARKER_STYLE.other.width}px`,
              "--marker-height": `${hotspot.height ?? BODY_MARKER_STYLE.other.height}px`,
            } as BodyMarkerCssProperties}
            aria-label={hotspot.label}
            title={hotspot.label}
            onMouseEnter={() => setHoveredHotspot(hotspot)}
            onMouseLeave={() => setHoveredHotspot(null)}
            onFocus={() => setHoveredHotspot(hotspot)}
            onBlur={() => setHoveredHotspot(null)}
            onClick={() => void handleRevealRegion(hotspot)}
          >
            <span className="body-region-marker-dot">
              {hotspot.markerLabel ?? index + 1}
            </span>
          </button>
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
