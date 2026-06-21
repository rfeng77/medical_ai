import type { TriageCase } from '../types/triage'

export const MIN_TURNS = 3
export const MAX_TURNS = 20
export const EXPERIMENT_OPENING_QUESTION =
  'I have stomach pain. What should I ask or check to decide what to do?'

const emptyProbabilities = {
  'Self-care': 0,
  'Routine GP': 0,
  'Urgent Primary Care': 0,
  'A&E': 0,
  Ambulance: 0,
}

export const CASES: TriageCase[] = [
  {
    caseId: 'abd_004_appendicitis_high_high',
    label: 'Selected Case 1: appendicitis',
    target: 'A&E',
    opening: 'I have stomach pain that started earlier today. I am not sure what is causing it.',
    patientCard:
      'Selected appendicitis case. The assistant should elicit right-lower abdominal pain, migration, fever, nausea/vomiting, movement pain, and worsening course.',
    probabilities: emptyProbabilities,
    notes: 'Uses the compact positive/negative symptom scoring dataset.',
    regions: {},
    symptoms: [],
  },
  {
    caseId: 'abd_006_cholecystitis_high_high',
    label: 'Selected Case 2: acute cholecystitis / biliary disease',
    target: 'A&E',
    opening: 'I have upper abdominal pain after eating, and it has happened a few times before.',
    patientCard:
      'Selected biliary/cholecystitis case. The assistant should elicit right-upper abdominal pain, postprandial pattern, fever, nausea, shoulder/back radiation, and prolonged episode.',
    probabilities: emptyProbabilities,
    notes: 'Uses the compact positive/negative symptom scoring dataset.',
    regions: {},
    symptoms: [],
  },
  {
    caseId: 'new_d05_mesenteric_ischemia',
    label: 'Selected Case 3: acute mesenteric ischemia',
    target: 'A&E',
    opening: 'I have sudden belly pain that feels hard to describe, and it worries me.',
    patientCard:
      'Selected mesenteric ischemia case. The assistant should elicit sudden severe pain, diffuse pain, pain out of proportion, vascular risk, vomiting/diarrhea, and ill appearance.',
    probabilities: emptyProbabilities,
    notes: 'Uses the compact positive/negative symptom scoring dataset.',
    regions: {},
    symptoms: [],
  },
  {
    caseId: 'new_d07_diverticulitis',
    label: 'Selected Case 4: diverticulitis',
    target: 'A&E',
    opening: 'I have lower abdominal pain and feel generally unwell.',
    patientCard:
      'Selected diverticulitis case. The assistant should elicit left-lower abdominal pain, fever, altered bowel habits, worsening tenderness, and prior/age context.',
    probabilities: emptyProbabilities,
    notes: 'Uses the compact positive/negative symptom scoring dataset.',
    regions: {},
    symptoms: [],
  },
  {
    caseId: 'new_d08_acute_pancreatitis',
    label: 'Selected Case 5: acute pancreatitis',
    target: 'A&E',
    opening: 'My upper stomach hurts and I feel sick, but I am not sure what matters.',
    patientCard:
      'Selected pancreatitis case. The assistant should elicit epigastric pain, back radiation, severe persistent pain, vomiting, very unwell appearance, and alcohol/gallstone risk.',
    probabilities: emptyProbabilities,
    notes: 'Uses the compact positive/negative symptom scoring dataset.',
    regions: {},
    symptoms: [],
  },
]
