import type {
  ClinicalField,
  DialoguePlan,
  DisclosureCoverageMonitorResult,
  ParticipantMemory
} from "../types/experiment";

const fieldLabels: Record<ClinicalField, string> = {
  pain_location: "pain location",
  pain_quality: "pain quality",
  pain_migration: "pain movement over time",
  movement_pain: "movement-related pain",
  duration: "duration",
  fever: "fever-like symptoms",
  vomiting: "nausea or vomiting",
  nausea: "nausea",
  diarrhea: "diarrhea",
  bowel_movement: "bowel movement changes",
  bleeding: "bleeding or stool color",
  hydration: "hydration",
  urination: "urination",
  pregnancy: "pregnancy relevance",
  dizziness: "dizziness or fainting",
  medication: "medication use",
  medical_history: "medical history",
  red_flags: "severe or rapidly worsening symptoms",
  other_symptoms: "other disclosed symptoms"
};

function joinWithAnd(items: string[]): string {
  if (items.length === 0) {
    return "nothing has been explicitly disclosed yet";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function createDialoguePlan({
  memory,
  monitorResult
}: {
  memory: ParticipantMemory;
  monitorResult: DisclosureCoverageMonitorResult;
}): DialoguePlan {
  const knownFields = Object.keys(memory.aiVisibleFields) as ClinicalField[];
  const hasAiVisibleFields = knownFields.length > 0;
  const lowHitRatioInstruction =
    monitorResult.disclosedFieldCount > 0 && monitorResult.hitRatio < 0.5
      ? " Explain that the disclosed information only partially matches the current case fields."
      : "";
  const knownInformationSummary = `I can use the following chat-disclosed information: ${joinWithAnd(
    knownFields.map((field) => fieldLabels[field] ?? field)
  )}.`;
  const constraints = {
    allowDiagnosis: false,
    allowTriageRecommendation: false,
    doNotMentionUndisclosedSymptoms: true,
    doNotRevealGroundTruth: true
  };

  if (!hasAiVisibleFields) {
    return {
      dialogueGoal: "ask_for_disclosure",
      temperature: 0.4,
      shouldSuggestMoreSearch: true,
      searchSuggestionStrength: "gentle",
      knownInformationSummary,
      uncertaintyMessage:
        "I can only use information typed into the chat, so the current state has high uncertainty.",
      optionalInformationCategories: monitorResult.missingInformationCategories,
      constraints,
      systemInstructionForDialogueAgent:
        "Ask the participant to share any symptom information they want the AI to consider. Do not mention diagnosis, triage options, hidden case truth, hidden clue text, or symptoms not disclosed in chat."
    };
  }

  if (monitorResult.uncertaintyLevel === "high") {
    return {
      dialogueGoal: "summarize_with_high_uncertainty",
      temperature: 0.35,
      shouldSuggestMoreSearch: true,
      searchSuggestionStrength: "moderate",
      knownInformationSummary,
      uncertaintyMessage:
        "You can proceed now, but the current reasoning state has high uncertainty because coverage is limited.",
      optionalInformationCategories: monitorResult.missingInformationCategories,
      constraints,
      systemInstructionForDialogueAgent:
        `Summarize only chat-disclosed information. Emphasize high uncertainty and neutrally suggest broad categories that could reduce uncertainty.${lowHitRatioInstruction} Do not diagnose or recommend triage.`
    };
  }

  if (monitorResult.uncertaintyLevel === "moderate") {
    return {
      dialogueGoal: "summarize_with_moderate_uncertainty",
      temperature: 0.3,
      shouldSuggestMoreSearch: true,
      searchSuggestionStrength: "gentle",
      knownInformationSummary,
      uncertaintyMessage:
        "You have shared some useful information, but several categories remain unclear.",
      optionalInformationCategories: monitorResult.missingInformationCategories,
      constraints,
      systemInstructionForDialogueAgent:
        `Summarize only chat-disclosed information. Acknowledge moderate uncertainty and gently mention neutral optional information categories.${lowHitRatioInstruction} Do not diagnose or recommend triage.`
    };
  }

  return {
    dialogueGoal: "reason_with_available_information",
    temperature: 0.25,
    shouldSuggestMoreSearch: false,
    searchSuggestionStrength: "none",
    knownInformationSummary,
    uncertaintyMessage:
      "You have shared several key categories, so reasoning is better supported, though uncertainty remains.",
    optionalInformationCategories: monitorResult.missingInformationCategories,
    constraints,
  systemInstructionForDialogueAgent:
      `Reason only from chat-disclosed information. Keep uncertainty visible.${lowHitRatioInstruction} Do not reveal hidden case truth, diagnose, or recommend a triage option.`
  };
}
