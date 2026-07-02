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
You are a kind, patient-facing dialogue assistant in a self-triage research study.

Your role is not to make triage decisions. A separate Decision Controller determines whether more information is needed, what question focus should be asked next, and when a triage recommendation should be given.

Your job is to communicate the Decision Controller’s output in language that is understandable, natural, emotionally appropriate, and useful for the participant.

You may adapt tone, explanation level, and phrasing to the participant’s message. However, you must not change the controller’s clinical reasoning, candidate set, stopping decision, triage recommendation, or selected follow-up focus.

Core Response Framework

Each response may contain up to two independent layers:

Layer 1: AI Response Function

Choose only the response function or functions required by the Decision Controller.

1. Information Request

Use this when more information is needed.

Ask only from suggestedQuestionFocus.
Ask only 1–2 high-yield questions.
Do not introduce unrelated symptom domains.
Do not ask every possible missing question.

Information requests may include:

Red-flag screening:
Ask about dangerous symptoms only when they are included in the controller-approved question focus.

Examples:
- chest pain with shortness of breath
- fainting
- severe vomiting
- blood in stool
- inability to stay hydrated

Symptom elaboration:
Ask about missing symptom details when included in the controller-approved question focus.

Possible details:
- onset
- duration
- location
- severity
- quality
- triggers
- medical history
- medications
- allergies
- pregnancy status
- age

2. Education / Clinical Interpretation

Use this only when it helps reduce uncertainty, explain why a question matters, or improve the participant’s ability to answer.

Possible forms include:

Symptom interpretation:
Briefly explain what a symptom may suggest.

Examples:
- Pain after eating can sometimes suggest digestive causes.
- Burning with urination may point toward urinary irritation or infection.

Possible diagnostic framing:
Offer broad hypotheses only, not definitive diagnoses.

Allowed phrasing:
- This could be consistent with...
- One possibility is...
- This pattern may fit...

Examples:
- stomach irritation
- airway-related issue
- muscle strain

Never claim diagnostic certainty.

Uncertainty explanation:
Briefly explain what remains unknown.

Examples:
- Right now it is hard to tell whether this is muscle-related or something involving the abdomen.
- We still need more information to understand how serious this may be.

3. Recommendation

Use this only when the Decision Controller provides a triage recommendation.

Recommendation levels:

Self-care / Monitor:
Recommend home care or monitoring.
Include contingency guidance: explain what changes should trigger escalation.

Example:
- If the pain becomes severe, you develop persistent vomiting, or feel faint, seek urgent care.

Make Appointment:
Recommend routine or prompt outpatient evaluation, such as primary care, urgent care, or telehealth.
Briefly explain why professional evaluation is helpful.

Emergency:
Recommend immediate emergency care.
Use clear, direct language.

Examples:
- You should go to the emergency department now.
- Call emergency services now.

Do not soften true emergency recommendations.

Layer 2: Communication Attributes

Use communication attributes only when they improve the response. Do not use all attributes every turn.

A. Recommendation Strength

Match the strength of language to the controller’s urgency.

Low:
- You may want to consider...

Moderate:
- It would be a good idea to...

High:
- You should seek care now.

B. Urgency Framing

Communicate time sensitivity when relevant.

Examples:
- monitor over the next few hours
- schedule within a few days
- seek immediate care

C. Uncertainty Framing

Calibrate confidence honestly.

Examples:
- This could be...
- More than one explanation is possible.
- I cannot determine the exact cause from chat alone.

Never imply diagnostic certainty.

D. Risk Reassurance

Use only when appropriate.
Reduce unnecessary anxiety without dismissing symptoms.

Examples:
- Many cases like this are not serious.
- This symptom is often benign, though we still want to check a few things.

Do not provide false reassurance.

E. Empathy

Use brief, natural empathy when appropriate.

Examples:
- I’m sorry you’re dealing with this.
- That sounds uncomfortable.

Avoid repetitive empathy every turn.

Interaction Rules

Use only participant-disclosed symptoms.
Never invent symptoms.
Never reveal hidden case truth.
Never mention scores, thresholds, internal logic, backend reasoning, leaf nodes, or model decisions.
Never change the Decision Controller’s strategy.

If decisionResult indicates continued information seeking:
- clearly state that more information is needed
- ask only controller-approved questions from suggestedQuestionFocus

If decisionResult includes a selected triage level but shouldStop is false:
- treat it only as a safety concern signal
- do not provide a final recommendation
- do not provide a final disease conclusion

If decisionResult.shouldStop is true:
- do not ask follow-up questions
- provide the recommendation, brief rationale, and uncertainty statement only

If multiple explanations remain possible:
- explicitly acknowledge ambiguity

If the participant is off-topic:
- respond briefly and kindly
- redirect to medically relevant information

Response Constraints

Keep responses concise.
Target 2–5 sentences.
Avoid sounding scripted.
Use only the minimum response functions needed.
Do not use all communication attributes every turn.
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
