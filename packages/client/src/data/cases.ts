import type { TriageCase } from '../types/triage'

export const MIN_TURNS = 3
export const MAX_TURNS = 20
export const EXPERIMENT_OPENING_QUESTION =
  'I have stomach pain and feel nauseous. What should I ask or check to decide what to do?'

export const CASES: TriageCase[] = [
  {
    caseId: 'gastroenteritis',
    label: 'Case 1: Viral gastroenteritis pattern',
    target: 'Self-care',
    opening:
      'I have stomach pain and feel nauseous. I also feel tired and do not have much appetite.',
    patientCard:
      'You are a patient with diffuse crampy abdominal pain, watery diarrhea, mild nausea, and preserved ability to drink. Do not volunteer all details unless asked or clicked.',
    probabilities: {
      'Self-care': 70,
      'Routine GP': 15,
      'Urgent Primary Care': 10,
      'A&E': 4,
      Ambulance: 1,
    },
    notes:
      'Designed as a low-acuity case. High-value uncertainty reducers are hydration status, urine output, fever, blood/black stool, and whether pain localizes or worsens.',
    regions: {
      epigastric: 'Upper abdomen: mild cramping and nausea, not sharp or localized.',
      periumbilical:
        'Belly button area: crampy diffuse discomfort, not a fixed point of pain.',
      rlq: 'Right lower abdomen: no fixed right-lower pain and no pain worse with walking.',
      llq: 'Left lower abdomen: no focal left-lower tenderness.',
      general: 'Whole belly: intermittent cramps with watery diarrhea; abdomen is soft.',
    },
    symptoms: [
      [
        'duration',
        'Duration / trajectory',
        'Started 10 hours ago after a shared meal; symptoms are not rapidly worsening.',
      ],
      [
        'vomiting',
        'Vomiting',
        'Vomited once. Since then, can keep small sips of water down.',
      ],
      [
        'stool',
        'Stool / bleeding',
        'Watery diarrhea. No black stool and no visible blood.',
      ],
      ['fever', 'Fever / systemic', 'No high fever; feels tired but not confused or faint.'],
      ['hydration', 'Hydration', 'Mouth slightly dry, but urinating normally.'],
      [
        'meds',
        'Medication / history',
        'No anticoagulants, no NSAID overuse, no prior abdominal surgery.',
      ],
    ].map(([id, label, detail]) => ({ id, label, detail })),
  },
  {
    caseId: 'diverticulitis',
    label: 'Case 2: Stable left-lower abdominal pain',
    target: 'Routine GP',
    opening:
      'I have lower stomach pain and mild nausea. I am not sure if it is something I ate.',
    patientCard:
      'You are a stable patient with localized left-lower abdominal pain and mild fever. You can eat/drink and are not faint. Do not volunteer location unless asked or clicked.',
    probabilities: {
      'Self-care': 15,
      'Routine GP': 45,
      'Urgent Primary Care': 30,
      'A&E': 9,
      Ambulance: 1,
    },
    notes:
      'Designed as an intermediate case. The main information gap is that stable left-lower localized tenderness with no vomiting suggests a same-day or routine clinical assessment rather than immediate ambulance.',
    regions: {
      epigastric: 'Upper abdomen: not the main pain location.',
      periumbilical: 'Belly button area: mild discomfort only.',
      rlq: 'Right lower abdomen: not tender.',
      llq: 'Left lower abdomen: this is the main pain location; it is locally tender when pressed.',
      general: 'Whole belly: not rigid; pain is localized rather than generalized.',
    },
    symptoms: [
      [
        'duration',
        'Duration / trajectory',
        'Pain has been present for about 24 hours and is steady, not suddenly severe.',
      ],
      ['vomiting', 'Vomiting / appetite', 'No vomiting. Appetite is reduced but can drink fluids.'],
      [
        'stool',
        'Bowel habit',
        'Mild constipation and change in bowel habit; no black stool or large bleeding.',
      ],
      ['fever', 'Fever / systemic', 'Low-grade feverish feeling, no fainting or confusion.'],
      ['urinary', 'Urinary symptoms', 'No burning urination and no flank-to-groin colicky pain.'],
      ['history', 'History', 'No prior abdominal surgery. No known immunosuppression.'],
    ].map(([id, label, detail]) => ({ id, label, detail })),
  },
  {
    caseId: 'appendicitis',
    label: 'Case 3: Early appendicitis pattern',
    target: 'Urgent Primary Care',
    opening:
      'I have stomach pain and nausea. At first it felt vague, but now I am more worried.',
    patientCard:
      'You are a patient whose pain began near the belly button and later moved toward the right lower abdomen. You have low appetite and movement worsens pain. Reveal only when asked/clicked.',
    probabilities: {
      'Self-care': 5,
      'Routine GP': 10,
      'Urgent Primary Care': 35,
      'A&E': 45,
      Ambulance: 5,
    },
    notes:
      'Designed to shift from vague abdominal pain to urgent/A&E when migration, right-lower localization, anorexia, fever, and movement pain are elicited.',
    regions: {
      epigastric: 'Upper abdomen: not the main pain location.',
      periumbilical: 'Belly button area: the pain started here earlier today.',
      rlq: 'Right lower abdomen: pain has migrated here and is now more fixed; walking or coughing makes it worse.',
      llq: 'Left lower abdomen: not the main area.',
      general: 'Whole belly: not rigid, but the right lower side is clearly worse.',
    },
    symptoms: [
      [
        'duration',
        'Duration / trajectory',
        'Started 8 hours ago around the belly button and gradually moved to the right lower abdomen.',
      ],
      ['vomiting', 'Nausea / vomiting order', 'Nausea and loss of appetite. Pain came before any vomiting.'],
      ['fever', 'Fever / systemic', 'Feels mildly feverish; no collapse.'],
      ['movement', 'Movement pain', 'Walking, bumps in the car, or coughing make the right lower pain worse.'],
      ['stool', 'Stool', 'One loose stool, but diarrhea is not the main symptom. No black stool.'],
      ['history', 'History', 'No prior abdominal surgery and no known chronic bowel disease.'],
    ].map(([id, label, detail]) => ({ id, label, detail })),
  },
  {
    caseId: 'bowel_obstruction',
    label: 'Case 4: Small-bowel obstruction pattern',
    target: 'A&E',
    opening:
      'I have bad stomach cramps and keep feeling like I might throw up. My belly feels bloated.',
    patientCard:
      'You are a patient with intermittent crampy abdominal pain, distension, repeated vomiting, no flatus/stool, and prior abdominal surgery. Reveal only when asked/clicked.',
    probabilities: {
      'Self-care': 1,
      'Routine GP': 4,
      'Urgent Primary Care': 10,
      'A&E': 70,
      Ambulance: 15,
    },
    notes:
      'Designed as an A&E case. The major information-gap variables are colicky pain, distension, inability to pass stool/flatus, repeated vomiting, and prior abdominal surgery.',
    regions: {
      epigastric: 'Upper abdomen: nausea and pressure, but pain comes in waves across the abdomen.',
      periumbilical: 'Belly button area: central crampy pain that comes in waves.',
      rlq: 'Right lower abdomen: not specifically localized here.',
      llq: 'Left lower abdomen: not specifically localized here.',
      general: 'Whole belly: visibly bloated/distended; cramps come in waves.',
    },
    symptoms: [
      ['duration', 'Duration / trajectory', 'Pain and bloating have worsened over 18 hours. Cramps come in waves.'],
      ['vomiting', 'Vomiting', 'Repeated vomiting; nausea returns quickly after vomiting.'],
      ['stool', 'Stool / flatus', 'Has not passed stool or gas since symptoms began.'],
      ['surgery', 'Prior surgery', 'Had abdominal surgery several years ago.'],
      ['fever', 'Fever / systemic', 'No high fever yet, but feels weak and dehydrated.'],
      ['hydration', 'Hydration', 'Cannot keep much fluid down; urine is reduced.'],
    ].map(([id, label, detail]) => ({ id, label, detail })),
  },
  {
    caseId: 'gi_bleed',
    label: 'Case 5: Upper GI bleed / ulcer complication',
    target: 'Ambulance',
    opening:
      'I have upper stomach pain and feel dizzy. I thought it was just stomach upset, but I feel worse.',
    patientCard:
      'You are a patient with epigastric pain, dizziness, black sticky stool, possible coffee-ground vomit, and NSAID/anticoagulant exposure. Reveal only when asked/clicked.',
    probabilities: {
      'Self-care': 1,
      'Routine GP': 3,
      'Urgent Primary Care': 6,
      'A&E': 35,
      Ambulance: 55,
    },
    notes:
      'Designed as an ambulance-level red flag case. The key hidden variables are melena, hematemesis/coffee-ground emesis, dizziness/syncope, blood pressure/heart rate symptoms, and NSAID/anticoagulant use.',
    regions: {
      epigastric: 'Upper abdomen: burning/gnawing pain; worse than usual indigestion.',
      periumbilical: 'Belly button area: not the main pain location.',
      rlq: 'Right lower abdomen: not the main pain location.',
      llq: 'Left lower abdomen: not the main pain location.',
      general: 'Whole belly: no diarrhea pattern; patient feels dizzy and unwell.',
    },
    symptoms: [
      ['duration', 'Duration / trajectory', 'Upper abdominal pain began yesterday; dizziness worsened today.'],
      ['vomiting', 'Vomiting / blood', 'Vomited dark material that looked like coffee grounds.'],
      ['stool', 'Stool color', 'Stool is black, sticky, and unusually foul-smelling.'],
      ['dizzy', 'Dizziness / fainting', 'Feels lightheaded when standing and nearly fainted.'],
      ['meds', 'Medication exposure', 'Took ibuprofen frequently this week; also takes a blood thinner.'],
      ['vitals', 'Red flag state', 'Feels clammy with a racing heart. This should be treated as urgent.'],
    ].map(([id, label, detail]) => ({ id, label, detail })),
  },
]
