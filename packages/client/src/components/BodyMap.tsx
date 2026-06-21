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
  disabled?: boolean;
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
  disabled = false,
  onReveal,
}: BodyMapProps) {
  const [selectedHotspot, setSelectedHotspot] = useState<BodyHotspot | null>(
    null,
  );

  async function handleRegionClick(hotspot: BodyHotspot) {
    const detail = currentCase.regions[hotspot.inquiryKey] ?? BODY_REGION_FINDINGS[hotspot.inquiryKey]
    const revealed = revealedClues.some((item) => item.id === hotspot.inquiryKey)

    if (!detail) return

    setSelectedHotspot(hotspot)

    if (revealed) return

    if (disabled) return

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

        {BODY_HOTSPOTS.map((hotspot, index) => {
          const revealed = revealedClues.some(
            (item) => item.id === hotspot.inquiryKey,
          );
          const markerDisabled = disabled && !revealed;

          return (
            <button
              key={hotspot.id}
              type="button"
              className={`body-region-marker${revealed ? " revealed" : ""}`}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                ...BODY_MARKER_CSS_VARIABLES,
                "--marker-width": `${hotspot.width ?? BODY_MARKER_STYLE.other.width}px`,
                "--marker-height": `${hotspot.height ?? BODY_MARKER_STYLE.other.height}px`,
              } as BodyMarkerCssProperties}
              aria-label={hotspot.label}
              disabled={markerDisabled}
              title={
                revealed
                  ? hotspot.label
                  : disabled
                    ? "Chat with the AI before revealing another body-map point"
                    : hotspot.label
              }
              onClick={() => void handleRegionClick(hotspot)}
            >
              <span className="body-region-marker-dot">
                {hotspot.markerLabel ?? index + 1}
              </span>
            </button>
          );
        })}

        {selectedHotspot ? (
          <div
            className="body-hotspot-tooltip"
            style={{
              left: `${selectedHotspot.x}%`,
              top: `${selectedHotspot.y}%`,
            }}
          >
            <button
              type="button"
              className="body-hotspot-tooltip-close"
              aria-label="Close body-map detail"
              onClick={() => setSelectedHotspot(null)}
            >
              ×
            </button>
            <strong>{selectedHotspot.label}</strong>
            <span>
              {currentCase.regions[selectedHotspot.inquiryKey] ??
                BODY_REGION_FINDINGS[selectedHotspot.inquiryKey]}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
