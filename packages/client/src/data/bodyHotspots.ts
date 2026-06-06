export type BodyHotspot = {
  id: string;
  label: string;
  inquiryCategory: "body_region_click";
  inquiryKey:
    | "left_upper_abdomen"
    | "right_upper_abdomen"
    | "left_middle_abdomen"
    | "right_middle_abdomen"
    | "left_lower_abdomen"
    | "right_lower_abdomen"
    | "head"
    | "left_hand"
    | "right_hand"
    | "left_foot"
    | "right_foot";
  x: number;
  y: number;
};

export type BodyRegionInquiry = Pick<
  BodyHotspot,
  "inquiryCategory" | "inquiryKey" | "label"
>;

export const BODY_REGION_FINDINGS: Record<BodyHotspot["inquiryKey"], string> = {
  left_upper_abdomen: "The pain is in the left upper abdomen.",
  right_upper_abdomen: "The pain is in the right upper abdomen.",
  left_middle_abdomen: "The pain is in the left middle abdomen.",
  right_middle_abdomen: "The pain is in the right middle abdomen.",
  left_lower_abdomen: "The pain is in the left lower abdomen.",
  right_lower_abdomen: "The pain is in the right lower abdomen.",

  head: "The symptom is related to the head.",
  left_hand: "The symptom is related to the left hand.",
  right_hand: "The symptom is related to the right hand.",
  left_foot: "The symptom is related to the left foot.",
  right_foot: "The symptom is related to the right foot.",
};

export const BODY_HOTSPOTS: BodyHotspot[] = [
  {
    id: "left-upper-abdomen",
    label: "Left upper abdomen",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_upper_abdomen",
    x: 45,
    y: 30,
  },
  {
    id: "right-upper-abdomen",
    label: "Right upper abdomen",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_upper_abdomen",
    x: 54,
    y: 30,
  },
  {
    id: "left-middle-abdomen",
    label: "Left middle abdomen",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_middle_abdomen",
    x: 45,
    y: 39,
  },
  {
    id: "right-middle-abdomen",
    label: "Right middle abdomen",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_middle_abdomen",
    x: 54,
    y: 39,
  },
  {
    id: "left-lower-abdomen",
    label: "Left lower abdomen",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_lower_abdomen",
    x: 45,
    y: 48,
  },
  {
    id: "right-lower-abdomen",
    label: "Right lower abdomen",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_lower_abdomen",
    x: 54,
    y: 48,
  },
  {
    id: "head",
    label: "Head",
    inquiryCategory: "body_region_click",
    inquiryKey: "head",
    x: 49,
    y: 15,
  },
  {
    id: "left-hand",
    label: "Left hand",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_hand",
    x: 33,
    y: 50,
  },
  {
    id: "right-hand",
    label: "Right hand",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_hand",
    x: 65,
    y: 50,
  },
  {
    id: "left-foot",
    label: "Left foot",
    inquiryCategory: "body_region_click",
    inquiryKey: "left_foot",
    x: 45,
    y: 87,
  },
  {
    id: "right-foot",
    label: "Right foot",
    inquiryCategory: "body_region_click",
    inquiryKey: "right_foot",
    x: 53,
    y: 87,
  },
];