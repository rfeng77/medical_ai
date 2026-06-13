import type {
  AbdominalPainDecisionTree,
  DecisionControllerResult,
  LeafMatchingAgentResult,
  LeafScore
} from "../types/experiment";

const MATCH_THRESHOLD = 0.8;
const SPECIFICITY_THRESHOLD = 0.65;
const MULTIPLE_LEAF_MARGIN = 0.1;
const DOMINANT_LEAF_MARGIN = 0.5;
const EMERGENCY_SCORE_THRESHOLD = 0.75;
const EMERGENCY_SPECIFICITY_THRESHOLD = 0.6;

const triageRank: Record<string, number> = {
  "Self-care": 1,
  "Routine GP": 2,
  "Urgent Primary Care": 3,
  "A&E": 4,
  Ambulance: 5
};

const featureFocusLabels: Record<string, string> = {
  generic_abdominal_pain: "pain details",
  rlq_pain: "pain location",
  llq_pain: "pain location",
  upper_abdominal_pain: "pain location",
  epigastric_pain: "pain location",
  flank_or_groin_pain: "pain radiation",
  migration: "pain movement",
  movement_or_rebound: "movement-related pain",
  vomiting_or_nausea: "vomiting or nausea",
  nausea_vomiting: "vomiting or nausea",
  vomiting: "vomiting",
  nausea: "nausea",
  diarrhea: "diarrhea",
  watery_diarrhea: "diarrhea",
  diffuse_cramps: "cramps",
  fever: "fever",
  high_fever: "high fever",
  blood_in_stool: "blood in stool",
  no_blood_in_stool: "blood in stool",
  hydration_preserved: "hydration",
  dehydration: "hydration",
  urinary_symptoms: "urinary symptoms",
  pregnancy_possible: "pregnancy possibility",
  dizziness_syncope: "dizziness or fainting",
  constipation_or_no_stool: "abdominal swelling or pass gas/stool",
  painful_bulge: "painful bulge",
  severe_or_worsening: "symptom severity or worsening"
};

function rankTriage(triageLevel: string): number {
  return triageRank[triageLevel] ?? 0;
}

function isEmergencyTriage(triageLevel: string): boolean {
  return rankTriage(triageLevel) >= (triageRank["A&E"] ?? 4);
}

function chooseHighestAcuityLeaf(leaves: LeafScore[]): LeafScore | null {
  return [...leaves].sort(
    (a, b) =>
      rankTriage(b.triageLevel) - rankTriage(a.triageLevel) ||
      b.score - a.score ||
      b.specificityScore - a.specificityScore
  )[0] ?? null;
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
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

function disclosedFeatureGroups(leaves: LeafScore[]): Set<string> {
  return new Set(
    leaves.flatMap((leaf) =>
      leaf.matchedFeatures
        .filter((feature) => feature.matched && feature.status !== "not_mentioned")
        .map((feature) => featureGroup(feature.featureKey))
    )
  );
}

function missingInformationFromLeaves(leaves: LeafScore[]): string[] {
  const disclosedGroups = disclosedFeatureGroups(leaves);

  return uniqueStrings(
    leaves.flatMap((leaf) =>
      leaf.missingKeyFeatures.filter((feature) => !disclosedGroups.has(featureGroup(feature)))
    )
  ).slice(0, 8);
}

function suggestedFocusFromMissing(missingFeatures: string[]): string[] {
  const fallbackFocus = [
    "pain location",
    "pain movement or radiation",
    "fever",
    "vomiting or nausea",
    "blood in stool or urine",
    "hydration",
    "urinary symptoms",
    "pregnancy possibility",
    "abdominal swelling or ability to pass gas/stool",
    "painful bulge"
  ];
  const derived = uniqueStrings(missingFeatures.map((feature) => featureFocusLabels[feature] ?? feature));

  return (derived.length > 0 ? derived : fallbackFocus).slice(0, 6);
}

function reasoningFeaturesFromLeaves(leaves: LeafScore[]): string[] {
  return uniqueStrings(
    leaves.flatMap((leaf) =>
      leaf.matchedFeatures
        .filter((feature) => feature.matched && feature.status !== "not_mentioned")
        .map((feature) => `${feature.featureKey}: ${feature.evidenceText.join("; ") || feature.status}`)
    )
  );
}

function thresholdLeaves(matchingResult: LeafMatchingAgentResult): LeafScore[] {
  return matchingResult.leafScores.filter(
    (leaf) => leaf.score >= MATCH_THRESHOLD && leaf.specificityScore >= SPECIFICITY_THRESHOLD
  );
}

function closeLeaves(matchingResult: LeafMatchingAgentResult, topLeaf: LeafScore | undefined): LeafScore[] {
  if (!topLeaf) {
    return [];
  }

  return matchingResult.leafScores.filter(
    (leaf) =>
      leaf.nodeId !== topLeaf.nodeId &&
      topLeaf.score - leaf.score <= MULTIPLE_LEAF_MARGIN &&
      leaf.score >= MATCH_THRESHOLD - MULTIPLE_LEAF_MARGIN &&
      leaf.specificityScore >= SPECIFICITY_THRESHOLD - MULTIPLE_LEAF_MARGIN
  );
}

export function decideNextStep({
  matchingResult,
  decisionTree
}: {
  matchingResult: LeafMatchingAgentResult;
  decisionTree: AbdominalPainDecisionTree;
}): DecisionControllerResult {
  const sortedLeaves = [...matchingResult.leafScores].sort(
    (a, b) => b.score - a.score || b.specificityScore - a.specificityScore
  );
  const topLeaf = sortedLeaves[0];
  const emergencyOverrideLeaves = sortedLeaves.filter(
    (leaf) =>
      isEmergencyTriage(leaf.triageLevel) &&
      leaf.score >= EMERGENCY_SCORE_THRESHOLD &&
      leaf.specificityScore >= EMERGENCY_SPECIFICITY_THRESHOLD
  );

  if (emergencyOverrideLeaves.length > 0) {
    const selectedLeaf = chooseHighestAcuityLeaf(emergencyOverrideLeaves);
    const likelyLeaves = selectedLeaf ? [selectedLeaf] : emergencyOverrideLeaves;

    return {
      shouldStop: true,
      decision: "urgent_recommendation",
      selectedTriageLevel: selectedLeaf?.triageLevel ?? null,
      likelyLeaves,
      candidateLeaves: sortedLeaves.slice(0, 3),
      reasoningFeatures: reasoningFeaturesFromLeaves(likelyLeaves),
      missingInformationToAsk: [],
      suggestedQuestionFocus: [],
      patientFacingInstruction:
        "Explain that the disclosed symptom pattern may be concerning and recommend urgent evaluation based only on what the participant reported.",
      uncertaintyStatement: "This is not a definite diagnosis, but the disclosed pattern may need urgent assessment."
    };
  }

  const reachedThreshold = thresholdLeaves(matchingResult);
  const closeCandidateLeaves = closeLeaves(matchingResult, topLeaf);
  const secondLeaf = sortedLeaves[1];
  const hasDominantTopLeaf = topLeaf && secondLeaf
    ? topLeaf.score > 0 && topLeaf.score - secondLeaf.score >= DOMINANT_LEAF_MARGIN
    : false;

  if (reachedThreshold.length === 0) {
    const candidateLeaves = hasDominantTopLeaf && topLeaf ? [topLeaf] : sortedLeaves.slice(0, 3);
    const noMeaningfulMatch = !topLeaf || topLeaf.score === 0;
    const missingInformationToAsk = noMeaningfulMatch ? [] : missingInformationFromLeaves(candidateLeaves);
    const suggestedQuestionFocus = noMeaningfulMatch
      ? [
          "what symptoms you are having",
          "where and when any pain started",
          "fever, vomiting, bowel changes, bleeding, hydration, urinary symptoms, or pregnancy possibility"
        ]
      : suggestedFocusFromMissing(missingInformationToAsk);

    return {
      shouldStop: false,
      decision: "continue_information_seeking",
      selectedTriageLevel: null,
      likelyLeaves: [],
      candidateLeaves,
      reasoningFeatures: noMeaningfulMatch ? [] : reasoningFeaturesFromLeaves(candidateLeaves),
      missingInformationToAsk,
      suggestedQuestionFocus,
      patientFacingInstruction:
        "Current information is not enough to make a recommendation. Ask for more symptom details using the suggested focus areas.",
      uncertaintyStatement: "More information is needed before giving a triage recommendation."
    };
  }

  const multipleLikelyLeaves = uniqueStrings([
    ...reachedThreshold,
    ...(hasDominantTopLeaf ? [] : closeCandidateLeaves)
  ].map((leaf) => leaf.nodeId))
    .map((nodeId) => sortedLeaves.find((leaf) => leaf.nodeId === nodeId))
    .filter((leaf): leaf is LeafScore => Boolean(leaf));

  if (multipleLikelyLeaves.length > 1) {
    const safestLeaf = chooseHighestAcuityLeaf(multipleLikelyLeaves);
    const hasUrgentOrEmergency = multipleLikelyLeaves.some((leaf) => rankTriage(leaf.triageLevel) >= 3);
    const missingInformationToAsk = missingInformationFromLeaves(multipleLikelyLeaves);

    return {
      shouldStop: hasUrgentOrEmergency,
      decision: "multiple_possible_leaves",
      selectedTriageLevel: safestLeaf?.triageLevel ?? null,
      likelyLeaves: multipleLikelyLeaves,
      candidateLeaves: sortedLeaves.slice(0, 3),
      reasoningFeatures: reasoningFeaturesFromLeaves(multipleLikelyLeaves),
      missingInformationToAsk,
      suggestedQuestionFocus: suggestedFocusFromMissing(missingInformationToAsk),
      patientFacingInstruction:
        "Explain that more than one condition is possible. Use the safest relevant triage level if one is selected and ask for information that would help distinguish them.",
      uncertaintyStatement: "More than one explanation remains possible from the disclosed symptoms."
    };
  }

  const likelyLeaf = reachedThreshold[0] ?? topLeaf;

  return {
    shouldStop: true,
    decision: "single_likely_leaf",
    selectedTriageLevel: likelyLeaf?.triageLevel ?? null,
    likelyLeaves: likelyLeaf ? [likelyLeaf] : [],
    candidateLeaves: sortedLeaves.slice(0, 3),
    reasoningFeatures: likelyLeaf ? reasoningFeaturesFromLeaves([likelyLeaf]) : [],
    missingInformationToAsk: likelyLeaf?.missingKeyFeatures ?? [],
    suggestedQuestionFocus: suggestedFocusFromMissing(likelyLeaf?.missingKeyFeatures ?? []),
    patientFacingInstruction:
      "Explain that the current pattern may be consistent with the selected condition, give the triage recommendation, and state that this is based only on disclosed symptoms.",
    uncertaintyStatement: "This is not a definite diagnosis and is based only on the symptoms disclosed so far."
  };
}
