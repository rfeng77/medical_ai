import { generateGeminiResponse, generateGeminiResponseStream } from "../services/geminiService";
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
    medication_risk: "relevant medication use",
    right_lower_quadrant_pain: "whether pain is strongest in the lower right abdomen",
    pain_migration: "whether the pain moved or radiates",
    movement_pain_or_rebound_tenderness: "whether movement, walking, coughing, or bumps worsen the pain",
    worsening_course: "whether symptoms are worsening",
    right_upper_quadrant_pain: "whether pain is strongest in the upper right abdomen",
    postprandial_pain: "whether pain happens after eating",
    shoulder_or_back_radiation: "whether pain spreads to the shoulder or back",
    prolonged_episode: "how long the episode has lasted",
    pain_out_of_proportion: "whether the pain feels unusually severe",
    sudden_severe_pain: "whether the pain started suddenly and severely",
    vascular_risk_factors: "blood clot or vascular risk factors",
    diffuse_abdominal_pain: "whether pain is diffuse across the abdomen",
    ill_appearance: "whether they feel or look very unwell",
    vomiting_or_diarrhea: "vomiting or diarrhea",
    left_lower_quadrant_pain: "whether pain is strongest in the lower left abdomen",
    altered_bowel_habits: "bowel habit changes",
    worsening_tenderness: "whether tenderness is worsening",
    older_age_or_prior_history: "prior similar episodes or relevant history",
    radiation_to_back: "whether pain spreads to the back",
    severe_persistent_pain: "whether pain is severe and persistent",
    very_unwell_appearance: "whether they feel very unwell",
    alcohol_or_gallstone_risk_factors: "alcohol or gallstone risk factors"
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
    epigastric_pain: "pain_location",
    right_lower_quadrant_pain: "pain_location",
    right_upper_quadrant_pain: "pain_location",
    left_lower_quadrant_pain: "pain_location",
    diffuse_abdominal_pain: "pain_location",
    pain_migration: "pain_migration",
    radiation_to_back: "pain_migration",
    shoulder_or_back_radiation: "pain_migration",
    movement_pain_or_rebound_tenderness: "movement_pain",
    worsening_course: "duration",
    prolonged_episode: "duration"
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
  matchingResult: _matchingResult
}: {
  decisionResult: DecisionControllerResult;
  matchingResult: LeafMatchingAgentResult;
}): string[] {
  return uniqueStrings(decisionResult.suggestedQuestionFocus).slice(0, 2);
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
  decisionResult,
  onToken
}: {
  message: string;
  memory: ParticipantMemory;
  extractionResult: SymptomExtractionAgentResult;
  matchingResult: LeafMatchingAgentResult;
  decisionResult: DecisionControllerResult;
  onToken?: (chunk: string) => void;
}): Promise<string> {
  const fallback = (): string => fallbackResponse({ memory, decisionResult, matchingResult });
  const selectedFollowUpCues = followUpCues({ decisionResult, matchingResult });

  const systemInstruction = `
You are a kind patient-facing assistant in a self-triage research study.
Use only the participant-disclosed symptoms provided in the prompt.
Do not claim diagnostic certainty.
You may say "this could be consistent with" or "one possibility is".

If the decision result says to continue information seeking, make it clear that more information is still needed.
Ask follow-up questions only from the suggested question focus provided by the decision controller.
Do not add extra symptom areas unless they appear in the suggested question focus.
Pick only the most helpful 1 to 2 things to ask about.
If the decision result says to continue information seeking but includes a selectedTriageLevel, treat it only as a safety concern signal. You may briefly say the pattern could be concerning, but do not give a final triage recommendation or final disease conclusion.
Use the conversation to help the participant reduce uncertainty, not just to collect fields. Decide case-by-case which of these moves would actually help; do not use all of them every turn and do not sound formulaic:
- If the participant seems confused, anxious, or asks why you need more information, briefly explain what is still uncertain in plain language.
- If a follow-up question may feel random, briefly explain why that question helps narrow the possibilities.
- If the participant gives vague wording such as "I feel bad", "it hurts", "I feel weird", or "I am not sure", prioritize a clarifying question that helps them describe timing, location, severity, quality, or associated symptoms.
- If the current evidence clearly points toward a broad category, you may name that broad working hypothesis, such as "an airway-related problem" or "a blood/lymph-node related pattern", but only as a possibility and only when it helps the participant answer the next question.
- If the participant has already provided clear information and the next question is straightforward, keep the response simple and just ask the next high-yield question.
- Never change the strategy, scoring, candidate set, or stopping decision. The decision controller decides what information is needed; your role is to make that process understandable and easy to answer.
If the participant says something off-topic, playful, administrative, or otherwise unrelated to symptoms, respond kindly and briefly. Gently redirect them to share information that helps judge the medical situation, for example symptoms, timing, location, severity, fever, vomiting, bowel changes, bleeding, urinary symptoms, pregnancy possibility, or worsening. Do not scold them.

If the decision result gives a triage recommendation, explain it clearly and kindly.
If decisionResult.shouldStop is true, do not ask follow-up questions even if suggestedQuestionFocus is present. Give the conclusion/recommendation and uncertainty statement only.
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
      }))
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
        "When asking for more information, ask only about selectedFollowUpCues. Do not add extra symptom areas. Explain uncertainty, hypothesis, or why the question helps only when it would make the answer easier or the interaction clearer.",
      selectedFollowUpCues
    }
  };

  try {
    const response = onToken
      ? await generateGeminiResponseStream({
          systemInstruction,
          userPrompt: JSON.stringify(patientSafePrompt, null, 2),
          temperature: 0.4,
          maxOutputTokens: 500,
          onChunk: onToken
        })
      : await generateGeminiResponse({
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
