import type { ParticipantMemory } from "../types/experiment";

type SafetyInput = {
  candidateResponse: string;
  memory: ParticipantMemory;
  allowDiagnosis?: boolean;
  allowTriageRecommendation?: boolean;
  uncertaintyLevel?: string;
};

type SafetyResult = {
  passed: boolean;
  finalResponse: string;
  notes: string[];
};

const diagnosisTerms = [
  "appendicitis",
  "gastroenteritis",
  "gi bleed",
  "bowel obstruction",
  "ulcer",
  "diagnosis is"
];

const triageRecommendationTerms = [
  "self-care",
  "routine gp",
  "urgent primary care",
  "a&e",
  "ambulance",
  "call an ambulance",
  "go to emergency"
];

const otherSymptomTerms = [
  "other disclosed symptoms",
  "other symptoms",
  "headache",
  "head pain",
  "chest pain",
  "chest tightness",
  "shortness of breath",
  "trouble breathing",
  "breathless",
  "rash",
  "hives"
];

function includesBlockedTerm(text: string, terms: string[]): string | undefined {
  const normalized = text.toLowerCase();
  return terms.find((term) => normalized.includes(term));
}

export function checkResponseSafety({
  candidateResponse,
  memory,
  allowDiagnosis = false,
  allowTriageRecommendation = false,
  uncertaintyLevel
}: SafetyInput): SafetyResult {
  const notes: string[] = [];
  const normalized = candidateResponse.toLowerCase();

  if (!allowDiagnosis) {
    const blockedDiagnosisTerm = includesBlockedTerm(candidateResponse, diagnosisTerms);

    if (blockedDiagnosisTerm) {
      notes.push(`Blocked diagnosis term: ${blockedDiagnosisTerm}`);
    }
  }

  if (!allowTriageRecommendation) {
    const blockedTriageTerm = includesBlockedTerm(candidateResponse, triageRecommendationTerms);

    if (blockedTriageTerm) {
      notes.push(`Blocked triage recommendation term: ${blockedTriageTerm}`);
    }
  }

  if (/\bfever\b/.test(normalized) && memory.aiVisibleFields.fever === undefined) {
    notes.push("Response mentioned fever before fever was disclosed.");
  }

  if (/\bvomiting\b/.test(normalized) && memory.aiVisibleFields.vomiting === undefined) {
    notes.push("Response mentioned vomiting before vomiting was disclosed.");
  }

  if (/\b(bleeding|black stool|blood)\b/.test(normalized) && memory.aiVisibleFields.bleeding === undefined) {
    notes.push("Response mentioned bleeding before bleeding was disclosed.");
  }

  const mentionedOtherSymptom = otherSymptomTerms.find((term) => normalized.includes(term));

  if (mentionedOtherSymptom && memory.aiVisibleFields.other_symptoms === undefined) {
    notes.push(`Response mentioned other symptoms before they were disclosed: ${mentionedOtherSymptom}`);
  }

  if (/\b\d{1,3}%\b/.test(candidateResponse)) {
    notes.push("Response included an unsupported probability.");
  }

  if (notes.length === 0) {
    return {
      passed: true,
      finalResponse: candidateResponse,
      notes
    };
  }

  const uncertaintyPhrase = uncertaintyLevel ? `${uncertaintyLevel} uncertainty` : "uncertainty";

  return {
    passed: false,
    finalResponse: `I can only reason from the symptoms you have described in the chat so far. The current decision state has ${uncertaintyPhrase}. You may continue exploring more symptom categories or proceed to a decision with the information currently available.`,
    notes
  };
}
