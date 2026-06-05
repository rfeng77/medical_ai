export type BodyHotspot = {
  id: string
  label: string
  inquiryCategory: 'body_region_click'
  inquiryKey:
    | 'upper_abdomen'
    | 'lower_abdomen'
    | 'right_lower_quadrant'
    | 'right_upper_quadrant'
    | 'left_lower_quadrant'
    | 'left_upper_quadrant'
    | 'left_flank'
    | 'right_flank'
    | 'diffuse_abdomen'
  x: number
  y: number
}

export type BodyRegionInquiry = Pick<
  BodyHotspot,
  'inquiryCategory' | 'inquiryKey' | 'label'
>

export const BODY_REGION_FINDINGS: Record<BodyHotspot['inquiryKey'], string> = {
  upper_abdomen: 'The pain is in the upper abdomen.',
  lower_abdomen: 'The pain is in the lower abdomen.',
  right_lower_quadrant: 'The pain is in the right lower quadrant.',
  right_upper_quadrant: 'The pain is in the right upper quadrant.',
  left_lower_quadrant: 'The pain is in the left lower quadrant.',
  left_upper_quadrant: 'The pain is in the left upper quadrant.',
  left_flank: 'The pain is in the left flank.',
  right_flank: 'The pain is in the right flank.',
  diffuse_abdomen: 'The pain is diffuse across the abdomen.',
}

export const BODY_HOTSPOTS: BodyHotspot[] = [
  {
    id: 'upper-abdomen',
    label: 'Upper abdomen',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'upper_abdomen',
    x: 49,
    y: 35,
  },
  {
    id: 'lower-abdomen',
    label: 'Lower abdomen',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'lower_abdomen',
    x: 49,
    y: 50,
  },
  {
    id: 'right-lower-quadrant',
    label: 'Right lower quadrant',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'right_lower_quadrant',
    x: 56,
    y: 50,
  },
  {
    id: 'right-upper-quadrant',
    label: 'Right upper quadrant',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'right_upper_quadrant',
    x: 56,
    y: 35,
  },
  {
    id: 'left-lower-quadrant',
    label: 'Left lower quadrant',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'left_lower_quadrant',
    x: 42,
    y: 50,
  },
  {
    id: 'left-upper-quadrant',
    label: 'Left upper quadrant',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'left_upper_quadrant',
    x: 42,
    y: 35,
  },
  {
    id: 'left-flank',
    label: 'Left flank',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'left_flank',
    x: 39,
    y: 43,
  },
  {
    id: 'right-flank',
    label: 'Right flank',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'right_flank',
    x: 59,
    y: 43,
  },
  {
    id: 'diffuse-abdomen',
    label: 'Diffuse abdomen',
    inquiryCategory: 'body_region_click',
    inquiryKey: 'diffuse_abdomen',
    x: 49,
    y: 43,
  },
]