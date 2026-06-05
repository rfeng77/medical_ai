import { useState } from "react";
import bodyImage from "../assets/body.jpg";
import {
  BODY_HOTSPOTS,
  BODY_REGION_FINDINGS,
  type BodyHotspot,
} from "../data/bodyHotspots";

export function BodyMap() {
  const [hoveredHotspot, setHoveredHotspot] = useState<BodyHotspot | null>(
    null,
  );

  return (
    <div className="abdominal-map">
      <div className="body-image-wrapper">
        <img
          src={bodyImage}
          alt="Human body abdominal map"
          className="body-image"
        />

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
            onMouseEnter={() => setHoveredHotspot(hotspot)}
            onMouseLeave={() => setHoveredHotspot(null)}
            onFocus={() => setHoveredHotspot(hotspot)}
            onBlur={() => setHoveredHotspot(null)}
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
            <span>{BODY_REGION_FINDINGS[hoveredHotspot.inquiryKey]}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
