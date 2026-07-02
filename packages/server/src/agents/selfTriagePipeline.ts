import decisionTreeData from "../data/abdominalPainDecisionTree.json";
import { createEmptyParticipantMemory } from "../stores/memoryStore";
import { saveAndPrintTurnMetrics } from "../stores/turnMetricsStore";
import type {
  AbdominalPainDecisionTree,
  ClinicalField,
  DisclosedSymptomMemory,
  DisclosedFields,
  ExtractedSymptom,
  FieldEvidence,
  LeafMatchingAgentResult,
  ParticipantMemory,
  SymptomExtractionAgentResult
} from "../types/experiment";
import { decideNextStep } from "./decisionControllerAgent";
import { matchSymptomsToLeavesWithAgent } from "./leafMatchingAgent";
import { generatePatientFacingResponse } from "./patientFacingDialogueAgent";
import { extractSymptomsWithAgent } from "./symptomExtractionAgent";

const decisionTree = decisionTreeData as unknown as AbdominalPainDecisionTree;

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function mergeSymptomEvidence(previous: ExtractedSymptom, next: ExtractedSymptom): string {
  return uniqueStrings([previous.evidenceText, next.evidenceText]).join(" | ");
}

function normalizeSymptom(symptom: ExtractedSymptom): ExtractedSymptom {
  return {
    ...symptom,
    symptomId: symptom.symptomId.trim().toLowerCase().replace(/\s+/g, "_"),
    label: symptom.label.trim(),
    evidenceText: symptom.evidenceText.trim(),
    normalizedAliases: uniqueStrings(symptom.normalizedAliases ?? [])
  };
}

function updateSymptomMemory({
  memory,
  extractionResult
}: {
  memory: ParticipantMemory;
  extractionResult: SymptomExtractionAgentResult;
}): ParticipantMemory {
  const symptomMap: Record<string, ExtractedSymptom> = {
    ...(memory.disclosedSymptoms?.symptomMap ?? {})
  };

  for (const rawSymptom of extractionResult.extractedSymptoms) {
    const symptom = normalizeSymptom(rawSymptom);

    if (!symptom.symptomId || symptom.status === "not_mentioned") {
      continue;
    }

    const previous = symptomMap[symptom.symptomId];

    if (!previous) {
      symptomMap[symptom.symptomId] = symptom;
      continue;
    }

    symptomMap[symptom.symptomId] = {
      ...previous,
      ...symptom,
      evidenceText: mergeSymptomEvidence(previous, symptom),
      normalizedAliases: uniqueStrings([
        ...previous.normalizedAliases,
        ...symptom.normalizedAliases
      ]),
      bodyLocation: symptom.bodyLocation ?? previous.bodyLocation ?? null,
      severity: symptom.severity ?? previous.severity ?? null,
      duration: symptom.duration ?? previous.duration ?? null
    };
  }

  const disclosedSymptoms: DisclosedSymptomMemory = {
    symptomMap,
    symptoms: Object.values(symptomMap)
  };

  return {
    ...memory,
    disclosedSymptoms
  };
}

const symptomToClinicalField: Record<string, ClinicalField> = {
  generic_abdominal_pain: "pain_location",
  upper_abdominal_pain: "pain_location",
  epigastric_pain: "pain_location",
  burning_or_indigestion: "pain_quality",
  right_lower_abdominal_pain: "pain_location",
  left_lower_abdominal_pain: "pain_location",
  right_upper_quadrant_pain: "pain_location",
  diffuse_abdominal_pain: "pain_location",
  flank_or_groin_pain: "pain_location",
  painful_bulge: "other_symptoms",
  pain_migration: "pain_migration",
  radiation_to_back: "pain_migration",
  shoulder_or_back_radiation: "pain_migration",
  movement_worsens_pain: "movement_pain",
  postprandial_pain: "duration",
  prolonged_episode: "duration",
  pain_out_of_proportion: "pain_quality",
  sudden_severe_pain: "pain_quality",
  vascular_risk_factors: "medical_history",
  ill_appearance: "red_flags",
  altered_bowel_habits: "bowel_movement",
  worsening_tenderness: "pain_quality",
  older_age_or_prior_history: "medical_history",
  alcohol_or_gallstone_risk_factors: "medical_history",
  nausea: "nausea",
  vomiting: "vomiting",
  diarrhea: "diarrhea",
  watery_diarrhea: "diarrhea",
  stomach_cramps: "pain_quality",
  fever: "fever",
  high_fever: "fever",
  blood_in_stool: "bleeding",
  hydration_preserved: "hydration",
  dehydration: "hydration",
  urinary_symptoms: "urination",
  pregnancy_possible: "pregnancy",
  dizziness_syncope: "dizziness",
  abdominal_swelling_or_no_stool: "bowel_movement",
  severe_or_worsening: "red_flags",
  medication_risk: "medication"
};

function fieldValueFromSymptom(symptom: SymptomExtractionAgentResult["extractedSymptoms"][number]): string | boolean | number | null {
  if (symptom.status === "absent") {
    return false;
  }

  if (symptom.value !== null) {
    return symptom.value;
  }

  return symptom.label;
}

function updateLegacyVisibleFields(memory: ParticipantMemory): {
  aiVisibleFields: DisclosedFields;
  fieldEvidence: FieldEvidence;
} {
  const aiVisibleFields: DisclosedFields = {};
  const fieldEvidence: FieldEvidence = {};

  for (const symptom of memory.disclosedSymptoms.symptoms) {
    const field = symptomToClinicalField[symptom.symptomId] ?? "other_symptoms";
    if (field === "other_symptoms" && typeof aiVisibleFields.other_symptoms === "string") {
      aiVisibleFields.other_symptoms = `${aiVisibleFields.other_symptoms}; ${symptom.label}`;
    } else {
      aiVisibleFields[field] = fieldValueFromSymptom(symptom);
    }
    fieldEvidence[field] = [...(fieldEvidence[field] ?? []), symptom.evidenceText];
  }

  return {
    aiVisibleFields,
    fieldEvidence
  };
}

function uncertaintyLevelForDecision(
  decisionResult: ReturnType<typeof decideNextStep>
): ParticipantMemory["latestUncertaintyLevel"] {
  if (!decisionResult.shouldStop) {
    return "high";
  }

  if (decisionResult.decision === "multiple_possible_leaves") {
    return "moderate";
  }

  return "lower";
}

function ensureCaseScopedMemory(memory: ParticipantMemory, caseId: string): ParticipantMemory {
  if (memory.caseId === caseId) {
    return memory;
  }

  return createEmptyParticipantMemory({
    participantId: memory.participantId,
    caseId,
    condition: memory.condition,
    sessionId: memory.sessionId ?? `${memory.participantId}-${caseId}`
  });
}

export async function runSelfTriageTurn({
  message,
  memory,
  caseId,
  onResponseToken
}: {
  message: string;
  memory: ParticipantMemory;
  caseId: string;
  onResponseToken?: (chunk: string) => void;
}): Promise<{
  updatedMemory: ParticipantMemory;
  extractionResult: SymptomExtractionAgentResult;
  matchingResult: LeafMatchingAgentResult;
  decisionResult: ReturnType<typeof decideNextStep>;
  response: string;
}> {
  const caseScopedMemory = ensureCaseScopedMemory(memory, caseId);
  const extractionResult = await extractSymptomsWithAgent({
    message,
    memory: caseScopedMemory
  });
  const symptomUpdatedMemory = updateSymptomMemory({
    memory: caseScopedMemory,
    extractionResult
  });
  const legacyFields = updateLegacyVisibleFields(symptomUpdatedMemory);
  const matchingResult = await matchSymptomsToLeavesWithAgent({
    disclosedSymptoms: symptomUpdatedMemory.disclosedSymptoms,
    participantEvidenceText: [
      ...symptomUpdatedMemory.chatHistory
        .filter((entry) => entry.role === "participant")
        .map((entry) => entry.text),
      message
    ].join("\n"),
    decisionTree,
    caseId
  });
  const decisionResult = decideNextStep({
    matchingResult,
    decisionTree
  });
  const response = await generatePatientFacingResponse({
    message,
    memory: symptomUpdatedMemory,
    extractionResult,
    matchingResult,
    decisionResult,
    onToken: onResponseToken
  });
  await saveAndPrintTurnMetrics({
    message,
    memory: symptomUpdatedMemory,
    matchingResult,
    decisionResult,
    response
  });

  const timestamp = new Date().toISOString();
  const updatedMemory: ParticipantMemory = {
    ...symptomUpdatedMemory,
    ...legacyFields,
    chatHistory: [
      ...symptomUpdatedMemory.chatHistory,
      {
        role: "participant",
        text: message,
        timestamp
      },
      {
        role: "assistant",
        text: response,
        timestamp: new Date().toISOString()
      }
    ],
    turnCount: symptomUpdatedMemory.turnCount + 1,
    latestCoverageRatio: decisionResult.shouldStop ? 1 : 0,
    latestUncertaintyLevel: uncertaintyLevelForDecision(decisionResult),
    latestMissingInformationCategories: decisionResult.suggestedQuestionFocus,
    latestShouldSuggestMoreSearch:
      !decisionResult.shouldStop || decisionResult.decision === "multiple_possible_leaves",
    decisionTreeVisibleFeatures: matchingResult.topLeaves.flatMap((leaf) =>
      leaf.matchedFeatures.filter((feature) => feature.matched).map((feature) => feature.featureKey)
    ),
    latestMatchingResult: matchingResult,
    latestDecisionResult: decisionResult
  };

  return {
    updatedMemory,
    extractionResult,
    matchingResult,
    decisionResult,
    response
  };
}
