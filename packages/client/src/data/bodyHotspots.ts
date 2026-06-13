export type BodyHotspot = {
  id: string;
  label: string;
  group: "torso" | "head" | "hand" | "foot";
  inquiryCategory: "body_region_click";
  inquiryKey: string;
  x: number;
  y: number;
  markerLabel?: string;
  width?: number;
  height?: number;
};

export type BodyRegionInquiry = Pick<
  BodyHotspot,
  "inquiryCategory" | "inquiryKey" | "label"
>;

export const BODY_MARKER_STYLE = {
  torso: {
    centerX: 49,
    startY: 32,
    width: 22,
    height: 32,
    gapX: 4,
    gapY: 6,
  },
  other: {
    width: 24,
    height: 28,
  },
  dot: {
    size: 15,
    color: "#233f85",
  },
  box: {
    fill: "rgba(37, 73, 145, 0.18)",
    hoverFill: "rgba(37, 73, 145, 0.28)",
    borderColor: "#1f3f8f",
    borderWidth: 2,
    borderRadius: 8,
  },
} as const;

export const BODY_REGION_FINDINGS: Record<string, string> = {
  left_upper_abdomen: "The pain is in the left upper abdomen.",
  upper_abdomen: "The pain is in the upper abdomen.",
  right_upper_abdomen: "The pain is in the right upper abdomen.",
  left_middle_abdomen: "The pain is in the left middle abdomen.",
  middle_abdomen: "The pain is in the middle abdomen.",
  right_middle_abdomen: "The pain is in the right middle abdomen.",
  left_lower_abdomen: "The pain is in the left lower abdomen.",
  lower_abdomen: "The pain is in the lower abdomen.",
  right_lower_abdomen: "The pain is in the right lower abdomen.",
  head: "The symptom is related to the head.",
  left_hand: "The symptom is related to the left hand.",
  right_hand: "The symptom is related to the right hand.",
  left_foot: "The symptom is related to the left foot.",
  right_foot: "The symptom is related to the right foot.",
};

const TORSO_HOTSPOTS = [
  {
    id: "left-chest",
    label: "Left chest",
    inquiryKey: "left_upper_abdomen",
  },
  {
    id: "right-chest",
    label: "Right chest",
    inquiryKey: "right_upper_abdomen",
  },
  {
    id: "left-middle-abdomen",
    label: "Left middle abdomen",
    inquiryKey: "left_middle_abdomen",
  },
  {
    id: "right-middle-abdomen",
    label: "Right middle abdomen",
    inquiryKey: "right_middle_abdomen",
  },
  {
    id: "left-lower-abdomen",
    label: "Left lower abdomen",
    inquiryKey: "left_lower_abdomen",
  },
  {
    id: "right-lower-abdomen",
    label: "Right lower abdomen",
    inquiryKey: "right_lower_abdomen",
  },
] as const;

const TORSO_ROW_Y = [28, 36, 44] as const;

const createTorsoHotspots = (): BodyHotspot[] =>
  TORSO_HOTSPOTS.map((hotspot, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const xOffset =
      column === 0 ? -BODY_MARKER_STYLE.torso.gapX : BODY_MARKER_STYLE.torso.gapX;

    return {
      ...hotspot,
      group: "torso",
      inquiryCategory: "body_region_click",
      x: BODY_MARKER_STYLE.torso.centerX + xOffset,
      y: TORSO_ROW_Y[row] ?? TORSO_ROW_Y[0],
      markerLabel: String(index + 1),
      width: BODY_MARKER_STYLE.torso.width,
      height: BODY_MARKER_STYLE.torso.height,
    };
  });

const OTHER_HOTSPOTS: BodyHotspot[] = [
  {
    id: "head",
    label: "Head",
    group: "head",
    inquiryCategory: "body_region_click",
    inquiryKey: "head",
    x: 49,
    y: 10,
    markerLabel: "7",
    width: BODY_MARKER_STYLE.other.width,
    height: BODY_MARKER_STYLE.other.height,
  },
  {
    id: "left-hand",
    label: "Left hand",
    group: "hand",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_hand",
    x: 33,
    y: 50,
    markerLabel: "8",
    width: BODY_MARKER_STYLE.other.width,
    height: BODY_MARKER_STYLE.other.height,
  },
  {
    id: "right-hand",
    label: "Right hand",
    group: "hand",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_hand",
    x: 65,
    y: 50,
    markerLabel: "9",
    width: BODY_MARKER_STYLE.other.width,
    height: BODY_MARKER_STYLE.other.height,
  },
  {
    id: "left-foot",
    label: "Left foot",
    group: "foot",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_foot",
    x: 45,
    y: 90,
    markerLabel: "10",
    width: BODY_MARKER_STYLE.other.width,
    height: BODY_MARKER_STYLE.other.height,
  },
  {
    id: "right-foot",
    label: "Right foot",
    group: "foot",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_foot",
    x: 53,
    y: 90,
    markerLabel: "11",
    width: BODY_MARKER_STYLE.other.width,
    height: BODY_MARKER_STYLE.other.height,
  },
];

export const BODY_HOTSPOTS: BodyHotspot[] = [
  ...createTorsoHotspots(),
  ...OTHER_HOTSPOTS,
];
