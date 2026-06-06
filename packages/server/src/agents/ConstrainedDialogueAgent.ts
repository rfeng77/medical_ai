import type {
  ClinicalField,
  DialoguePlan,
  DisclosureCoverageMonitorResult,
  ParticipantMemory,
} from "../types/experiment";
import {
  GeminiServiceError,
  generateGeminiResponse,
} from "../services/geminiService";

const strictDialogueConstraints = `You are a reasoning support assistant in a controlled medical triage experiment.
You only know information that the participant explicitly typed in chat.
Do not use body-map findings unless the participant described them in chat.
Do not infer undisclosed symptoms.
Do not diagnose.
Do not recommend a triage option.
Do not mention hidden case truth.
Do not mention probabilities or risk percentages.
If information is limited, explain that uncertainty is high.
You may gently suggest that the participant can continue exploring more neutral information categories, but do not ask highly leading symptom-specific questions.
The participant may also proceed to a decision with the currently available information.

Important:
If isSymptomDisclosure is false, do not discuss uncertainty, missing medical categories, diagnosis, or triage. Instead, briefly say that no symptom information was detected and ask the participant to describe symptoms or body-map findings.
If other_symptoms are present, treat them as valid AI-visible disclosed symptom information, even if they do not match the current case fields.
Do not say "You have not disclosed any AI-visible symptom information" when other_symptoms exists.`;

export const deterministicDialogueFallback =
  "The AI response service is temporarily unavailable. You may continue exploring symptom information or proceed to a decision with the information currently available.";

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
  other_symptoms: "other disclosed symptoms",
};

function joinWithOr(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function humanizeFieldValue(value: unknown): string {
  if (value === true) return "yes";
  if (value === false) return "no";
  if (value === null) return "unspecified";
  return String(value).replaceAll("_", " ");
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  return text
    .trim()
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}

function isIncompleteGeminiResponse(response: string): boolean {
  return countSentences(response) < 2 || countWords(response) < 25;
}

function hasAiVisibleFields(memory: ParticipantMemory): boolean {
  return Object.keys(memory.aiVisibleFields).length > 0;
}

export async function generateConstrainedDialogue({
  message,
  memory,
  monitorResult,
  dialoguePlan,
}: {
  message: string;
  memory: ParticipantMemory;
  monitorResult: DisclosureCoverageMonitorResult;
  dialoguePlan: DialoguePlan;
}): Promise<string> {
  // 非症状输入：直接走 deterministic，不要浪费 Gemini，也不要讲一堆 medical uncertainty。
  if (!monitorResult.isSymptomDisclosure && !hasAiVisibleFields(memory)) {
    return createNonSymptomResponse(monitorResult);
  }

  const systemInstruction = `${strictDialogueConstraints}

Additional dialogue plan:
${dialoguePlan.systemInstructionForDialogueAgent}`;

  const userPrompt = buildGeminiUserPrompt({
    message,
    memory,
    monitorResult,
    dialoguePlan,
  });

  try {
    const geminiResponse = await generateGeminiResponse({
      systemInstruction,
      userPrompt,
      temperature: dialoguePlan.temperature,
    });

    if (isIncompleteGeminiResponse(geminiResponse)) {
      return createDeterministicResponse({
        memory,
        monitorResult,
        dialoguePlan,
      });
    }

    return geminiResponse;
  } catch (error) {
    if (!(error instanceof GeminiServiceError)) {
      console.warn("Gemini request failed", {
        errorType: "unexpected_dialogue_generation_error",
      });
    }

    return deterministicDialogueFallback;
  }
}

function buildGeminiUserPrompt({
  message,
  memory,
  monitorResult,
  dialoguePlan,
}: {
  message: string;
  memory: ParticipantMemory;
  monitorResult: DisclosureCoverageMonitorResult;
  dialoguePlan: DialoguePlan;
}): string {
  return JSON.stringify(
    {
      participantLatestMessage: message,
      aiVisibleFields: memory.aiVisibleFields,
      fieldEvidence: memory.fieldEvidence,
      monitorResult: {
        isSymptomDisclosure: monitorResult.isSymptomDisclosure,
        nonSymptomInputType: monitorResult.nonSymptomInputType,
        uncertaintyLevel: monitorResult.uncertaintyLevel,
        informationCoverageRatio: monitorResult.informationCoverageRatio,
        hitRatio: monitorResult.hitRatio,
        disclosedFieldCount: monitorResult.disclosedFieldCount,
        matchedFieldCount: monitorResult.matchedFieldCount,
        matchedFields: monitorResult.matchedFields,
        unmatchedDisclosedFields: monitorResult.unmatchedDisclosedFields,
        unmatchedDisclosedEvidence: monitorResult.unmatchedDisclosedEvidence,
        missingInformationCategories: monitorResult.missingInformationCategories,
      },
      dialoguePlan: {
        dialogueGoal: dialoguePlan.dialogueGoal,
        shouldSuggestMoreSearch: dialoguePlan.shouldSuggestMoreSearch,
        searchSuggestionStrength: dialoguePlan.searchSuggestionStrength,
        knownInformationSummary: dialoguePlan.knownInformationSummary,
        uncertaintyMessage: dialoguePlan.uncertaintyMessage,
      },
      outputInstructions: [
        "If monitorResult.isSymptomDisclosure is false, write 1-2 sentences asking the participant to describe symptoms or body-map findings. Do not mention uncertainty or missing categories.",
        "If symptoms are disclosed, write exactly 3 to 5 complete sentences.",
        "Sentence 1 must summarize only participant-disclosed information from aiVisibleFields, including every aiVisibleFields key and value. Do not add symptoms or details that are not in aiVisibleFields.",
        "Sentence 2 must state the current uncertainty level from monitorResult.uncertaintyLevel.",
        "If monitorResult.unmatchedDisclosedFields is not empty, mention neutrally that those disclosed fields do not strongly contribute to the current case match.",
        "If monitorResult.hitRatio is below 0.5 and disclosedFieldCount is greater than 0, explain that the disclosed information only partially matches the current case.",
        "Gently mention neutral information categories from monitorResult.missingInformationCategories only if dialoguePlan.shouldSuggestMoreSearch is true.",
        "The final sentence must remind the participant they may continue exploring or proceed to a decision with the information currently available.",
        "Do not diagnose.",
        "Do not recommend any triage option.",
        "Do not mention symptoms as present unless they are present in aiVisibleFields.",
        "Do not mention body-map findings, hidden case truth, probabilities, or risk percentages.",
      ],
      responseRequirements: {
        sentenceCountMinimum: 3,
        sentenceCountMaximum: 5,
        firstSentenceMustIncludeAllAiVisibleFields: true,
        secondSentenceMustStateUncertaintyLevel: true,
        useOnlyAiVisibleInformation: true,
        doNotIncludeGroundTruth: true,
        doNotIncludeDiagnosis: true,
        doNotRecommendTriageOption: true,
        doNotMentionProbabilities: true,
      },
    },
    null,
    2,
  );
}

function createNonSymptomResponse(
  monitorResult: DisclosureCoverageMonitorResult,
): string {
  const inputType = monitorResult.nonSymptomInputType;

  if (inputType === "greeting") {
    return "Hi. I can help you reason from symptoms you describe in the chat, so please tell me what you are feeling or what you found from the body map.";
  }

  if (inputType === "question") {
    return "I can help once you describe symptom information from the chat or body map. Please share what you are feeling, where it is, or what changed.";
  }

  return "I did not detect symptom information in that message. Please describe what you are feeling or what you found from the body map.";
}

function createDeterministicResponse({
  memory,
  monitorResult,
  dialoguePlan,
}: {
  memory: ParticipantMemory;
  monitorResult: DisclosureCoverageMonitorResult;
  dialoguePlan: DialoguePlan;
}): string {
  if (!monitorResult.isSymptomDisclosure && !hasAiVisibleFields(memory)) {
    return createNonSymptomResponse(monitorResult);
  }

  const disclosedEntries = (
    Object.entries(memory.aiVisibleFields) as Array<[ClinicalField, unknown]>
  ).map(([field, value]) => {
    return `${fieldLabels[field] ?? field}: ${humanizeFieldValue(value)}`;
  });

  const disclosedSentence =
    disclosedEntries.length > 0
      ? `You have disclosed ${joinWithAnd(disclosedEntries)}.`
      : "I did not detect symptom information in that message.";

  const uncertaintySentence = `The current uncertainty level is ${monitorResult.uncertaintyLevel}.`;

  const unmatchedLabels = monitorResult.unmatchedDisclosedFields.map(
    (field) => fieldLabels[field] ?? field,
  );

  const unmatchedSentence =
    unmatchedLabels.length > 0
      ? `The disclosed ${joinWithAnd(
          unmatchedLabels,
        )} does not strongly contribute to the current case match.`
      : "";

  const partialMatchSentence =
    monitorResult.disclosedFieldCount > 0 && monitorResult.hitRatio < 0.5
      ? "The disclosed information only partially matches the current case fields."
      : "";

  const optionalCategories = monitorResult.missingInformationCategories;

  const searchSentence =
    dialoguePlan.shouldSuggestMoreSearch && optionalCategories.length > 0
      ? `Neutral information categories that may reduce uncertainty include ${joinWithOr(
          optionalCategories,
        )}.`
      : "";

  const decisionSentence =
    "You may continue exploring or proceed to a decision with the information currently available.";

  return [
    disclosedSentence,
    uncertaintySentence,
    unmatchedSentence || partialMatchSentence,
    searchSentence,
    decisionSentence,
  ]
    .filter((sentence) => sentence.length > 0)
    .join(" ");
}