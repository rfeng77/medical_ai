import { generateGeminiResponse } from "../services/geminiService";
import type {
  DecisionControllerResult,
  LeafMatchingAgentResult,
  ParticipantMemory,
  SymptomExtractionAgentResult
} from "../types/experiment";

function disclosedSymptomSummary(memory: ParticipantMemory): string {
  const symptoms = memory.disclosedSymptoms.symptoms.filter((symptom) => symptom.status !== "not_mentioned");

  if (symptoms.length === 0) {
    return "no specific symptoms disclosed yet";
  }

  return symptoms
    .map((symptom) => {
      const status = symptom.status === "absent" ? "denied" : symptom.status;
      return `${symptom.label} (${status})`;
    })
    .join(", ");
}

function recommendationForTriage(triageLevel: string | null): string {
  switch (triageLevel) {
    case "Ambulance":
      return "please seek emergency help now";
    case "A&E":
      return "urgent assessment in A&E is recommended";
    case "Urgent Primary Care":
      return "same-day urgent medical advice is recommended";
    case "Routine GP":
      return "a routine GP appointment would be reasonable";
    case "Self-care":
      return "self-care may be reasonable if symptoms stay mild and you can keep fluids down";
    default:
      return "more information is needed before a clear recommendation";
  }
}

function joinFocusAreas(items: string[]): string {
  const limitedItems = items.slice(0, 3);

  if (limitedItems.length === 0) {
    return "where the pain is, whether symptoms are worsening, or any fever, bleeding, vomiting, bowel, urinary, or hydration changes";
  }

  if (limitedItems.length === 1) {
    return limitedItems[0] ?? "";
  }

  return `${limitedItems.slice(0, -1).join(", ")} and ${limitedItems[limitedItems.length - 1]}`;
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function humanizeFeatureKey(featureKey: string): string {
  const labels: Record<string, string> = {
    generic_abdominal_pain: "pain details",
    rlq_pain: "whether pain is strongest in the lower right abdomen",
    llq_pain: "whether pain is strongest in the lower left abdomen",
    upper_abdominal_pain: "whether pain is mainly in the upper abdomen",
    epigastric_pain: "upper middle abdominal pain or burning",
    flank_or_groin_pain: "pain spreading to the back, flank, or groin",
    migration: "whether the pain has moved",
    movement_or_rebound: "whether walking, coughing, or movement worsens the pain",
    vomiting_or_nausea: "nausea or vomiting",
    nausea_vomiting: "nausea or vomiting",
    vomiting: "vomiting",
    nausea: "nausea",
    diarrhea: "diarrhea or bowel changes",
    watery_diarrhea: "watery diarrhea",
    diffuse_cramps: "cramping",
    fever: "fever",
    high_fever: "high fever",
    blood_in_stool: "blood or black color in stool",
    no_blood_in_stool: "whether there is blood or black color in stool",
    hydration_preserved: "whether fluids are staying down",
    dehydration: "signs of dehydration",
    urinary_symptoms: "urinary symptoms",
    pregnancy_possible: "pregnancy possibility",
    dizziness_syncope: "dizziness or fainting",
    constipation_or_no_stool: "abdominal swelling or ability to pass stool or gas",
    painful_bulge: "a painful abdominal or groin bulge",
    severe_or_worsening: "whether symptoms are severe or worsening",
    medication_risk: "relevant medication use"
  };

  return labels[featureKey] ?? featureKey.replaceAll("_", " ");
}

function featureGroup(featureKey: string): string {
  const groups: Record<string, string> = {
    diarrhea: "diarrhea",
    watery_diarrhea: "diarrhea",
    altered_bowel: "diarrhea",
    vomiting: "vomiting_or_nausea",
    nausea: "vomiting_or_nausea",
    vomiting_or_nausea: "vomiting_or_nausea",
    nausea_vomiting: "vomiting_or_nausea",
    blood_in_stool: "bleeding",
    no_blood_in_stool: "bleeding",
    dehydration: "hydration",
    hydration_preserved: "hydration",
    diffuse_cramps: "cramps",
    crampy_pain: "cramps",
    generic_abdominal_pain: "pain",
    rlq_pain: "pain_location",
    llq_pain: "pain_location",
    upper_abdominal_pain: "pain_location",
    epigastric_pain: "pain_location"
  };

  return groups[featureKey] ?? featureKey;
}

function disclosedFeatureGroups(matchingResult: LeafMatchingAgentResult): Set<string> {
  return new Set(
    matchingResult.topLeaves.flatMap((leaf) =>
      leaf.matchedFeatures
        .filter((feature) => feature.matched && feature.status !== "not_mentioned")
        .map((feature) => featureGroup(feature.featureKey))
    )
  );
}

function candidateSuggestionCuesFromTopLeaves(
  matchingResult: LeafMatchingAgentResult,
): string[] {
  const disclosedGroups = disclosedFeatureGroups(matchingResult);

  return uniqueStrings(
    matchingResult.topLeaves.flatMap((leaf) =>
      leaf.missingKeyFeatures
        .filter((feature) => !disclosedGroups.has(featureGroup(feature)))
        .map(humanizeFeatureKey),
    ),
  ).slice(0, 3);
}

function followUpCues({
  decisionResult,
  matchingResult
}: {
  decisionResult: DecisionControllerResult;
  matchingResult: LeafMatchingAgentResult;
}): string[] {
  return uniqueStrings([
    ...decisionResult.suggestedQuestionFocus,
    ...candidateSuggestionCuesFromTopLeaves(matchingResult)
  ]).slice(0, 3);
}

function fallbackResponse({
  memory,
  decisionResult,
  matchingResult
}: {
  memory: ParticipantMemory;
  decisionResult: DecisionControllerResult;
  matchingResult: LeafMatchingAgentResult;
}): string {
  const symptoms = disclosedSymptomSummary(memory);
  const focus = joinFocusAreas(followUpCues({ decisionResult, matchingResult }));
  const likelyCondition = decisionResult.likelyLeaves[0]?.diagnosisGroup;
  const recommendation = recommendationForTriage(decisionResult.selectedTriageLevel);

  if (decisionResult.decision === "continue_information_seeking") {
    if (symptoms === "no specific symptoms disclosed yet") {
      return "I need a little more detail before giving a recommendation. Could you tell me what symptoms you are having, where any pain is, and when it started?";
    }

    return `Thanks for sharing that. Based on what you have told me so far (${symptoms}), I need a little more detail before giving a recommendation. Could you tell me about ${focus}?`;
  }

  if (decisionResult.decision === "multiple_possible_leaves") {
    return `Based on what you have described (${symptoms}), more than one explanation is possible. ${recommendation.charAt(0).toUpperCase()}${recommendation.slice(1)} based on the safest relevant possibility. It would also help to know about ${focus}.`;
  }

  if (decisionResult.decision === "urgent_recommendation") {
    return `The pattern you described (${symptoms}) may be concerning. This is not a definite diagnosis, but ${recommendation}. Please seek care promptly, especially if symptoms are worsening.`;
  }

  return `Based on the symptoms you disclosed (${symptoms}), this could be consistent with ${likelyCondition ?? "one possible condition"}, but it is not certain. At this point, ${recommendation}.`;
}

function stripPlainText(text: string): string {
  return text
    .replace(/^```(?:text)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function generatePatientFacingResponse({
  message,
  memory,
  extractionResult,
  matchingResult,
  decisionResult
}: {
  message: string;
  memory: ParticipantMemory;
  extractionResult: SymptomExtractionAgentResult;
  matchingResult: LeafMatchingAgentResult;
  decisionResult: DecisionControllerResult;
}): Promise<string> {
  const fallback = (): string => fallbackResponse({ memory, decisionResult, matchingResult });
  const candidateSuggestionCues = candidateSuggestionCuesFromTopLeaves(matchingResult);
  const selectedFollowUpCues = followUpCues({ decisionResult, matchingResult });

  const systemInstruction = `
You are a kind patient-facing assistant in a self-triage research study.
Use only the participant-disclosed symptoms provided in the prompt.
Do not claim diagnostic certainty.
You may say "this could be consistent with" or "one possibility is".

If the decision result says to continue information seeking, explain that more information is needed.
You may choose a few useful follow-up cues based on the suggested question focus and the missing higher-value symptom features from the top possible conditions.
Do not list too many questions or symptom areas. Pick only the most helpful 1 to 3 things to ask about.
The follow-up does not have to be limited to body areas; it can ask about symptom qualities, timing, fever, vomiting, bowel changes, bleeding, hydration, urinary symptoms, pregnancy possibility, worsening, or other clinically useful missing details.

If the decision result gives a triage recommendation, explain it clearly and kindly.
If multiple conditions remain possible, say that more than one explanation is possible and ask for information that would help distinguish them.
Do not mention raw scores, thresholds, leaf nodes, backend logic, or internal matching.
Do not reveal hidden case truth.
Do not add symptoms the participant has not disclosed.
Keep the response concise and natural, 2 to 5 sentences.
`;

  const patientSafePrompt = {
    latestParticipantMessage: message,
    disclosedSymptoms: memory.disclosedSymptoms.symptoms.map((symptom) => ({
      label: symptom.label,
      status: symptom.status,
      value: symptom.value,
      bodyLocation: symptom.bodyLocation,
      severity: symptom.severity,
      duration: symptom.duration,
      evidenceText: symptom.evidenceText
    })),
    newExtractionSummary: extractionResult.extractedSymptoms.map((symptom) => ({
      label: symptom.label,
      status: symptom.status,
      evidenceText: symptom.evidenceText
    })),
    matchingSummary: {
      possibleConditions: matchingResult.topLeaves.map((leaf) => ({
        diagnosisGroup: leaf.diagnosisGroup,
        triageLevel: leaf.triageLevel,
        reasoningSummary: leaf.reasoningSummary,
        missingKeyFeatures: leaf.missingKeyFeatures
      })),
      candidateSuggestionCues
    },
    decisionResult: {
      shouldStop: decisionResult.shouldStop,
      decision: decisionResult.decision,
      selectedTriageLevel: decisionResult.selectedTriageLevel,
      likelyConditions: decisionResult.likelyLeaves.map((leaf) => leaf.diagnosisGroup),
      reasoningFeatures: decisionResult.reasoningFeatures,
      missingInformationToAsk: decisionResult.missingInformationToAsk,
      suggestedQuestionFocus: selectedFollowUpCues,
      patientFacingInstruction: decisionResult.patientFacingInstruction,
      uncertaintyStatement: decisionResult.uncertaintyStatement
    },
    responseGuidance: {
      followUpQuestionInstruction:
        "When asking for more information, choose only 1 to 3 useful cues. Prefer cues that help distinguish the top possible conditions. Do not mechanically list every missing item.",
      candidateSuggestionCues,
      selectedFollowUpCues
    }
  };

  try {
    const response = await generateGeminiResponse({
      systemInstruction,
      userPrompt: JSON.stringify(patientSafePrompt, null, 2),
      temperature: 0.4,
      maxOutputTokens: 500
    });

    return stripPlainText(response);
  } catch (error) {
    throw new Error(
      `Gemini patient-facing response generation failed. Agent-only mode does not allow fallback. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
