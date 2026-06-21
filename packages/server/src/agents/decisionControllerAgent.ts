import type {
  AbdominalPainDecisionTree,
  DecisionControllerResult,
  LeafMatchingAgentResult,
  LeafScore
} from "../types/experiment";

const MATCH_THRESHOLD = 0.65;
const SPECIFICITY_THRESHOLD = 0;
const MULTIPLE_LEAF_MARGIN = 0.15;
const DOMINANT_LEAF_MARGIN = 0.5;
const EMERGENCY_SCORE_THRESHOLD = 0.55;
const EMERGENCY_SPECIFICITY_THRESHOLD = 0;
const HIGH_ENTROPY_THRESHOLD = 0.65;
const MIN_POSITIVE_EVIDENCE_FOR_DISEASE_SPECIFIC_REASONING = 1;
const MIN_POSITIVE_EVIDENCE_FOR_STOP = 100;

const triageRank: Record<string, number> = {
  "Self-care": 1,
  "Routine GP": 2,
  "Urgent Primary Care": 3,
  "A&E": 4,
  "Ambulence": 5
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
  severe_or_worsening: "symptom severity or worsening",
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

function getLeafNodes(decisionTree: AbdominalPainDecisionTree) {
  return decisionTree.leaf_nodes ?? decisionTree.leafNodes ?? [];
}

function getNodeId(leaf: ReturnType<typeof getLeafNodes>[number]): string {
  return leaf.node_id ?? leaf.nodeId ?? "unknown_leaf";
}

function getWeightedFeatures(leaf: ReturnType<typeof getLeafNodes>[number]): Record<string, number> {
  return leaf.weighted_features ?? leaf.weightedFeatures ?? {};
}

function getFeatureIndependence(decisionTree: AbdominalPainDecisionTree): Record<string, number> {
  return decisionTree.feature_independence ?? decisionTree.featureIndependence ?? {};
}

function getFeatureUniqueness(leaf: ReturnType<typeof getLeafNodes>[number]): Record<string, number> {
  return leaf.uniqueness_scores ?? leaf.uniquenessScores ?? {};
}

function posteriorScore(leaf: LeafScore): number {
  return leaf.posteriorProbability ?? leaf.score;
}

function positiveEvidence(leaf: LeafScore): number {
  return leaf.positiveEvidence ?? 0;
}

function hasPositiveDiseaseEvidence(leaf: LeafScore): boolean {
  return positiveEvidence(leaf) >= MIN_POSITIVE_EVIDENCE_FOR_DISEASE_SPECIFIC_REASONING;
}

function hasEnoughPositiveEvidenceToStop(leaf: LeafScore): boolean {
  return positiveEvidence(leaf) >= MIN_POSITIVE_EVIDENCE_FOR_STOP;
}

function hasEnoughLeafScoreToStop(leaf: LeafScore): boolean {
  return leaf.score >= MATCH_THRESHOLD;
}

function posteriorEntropy(leaves: LeafScore[]): { entropy: number; normalizedEntropy: number } {
  const posteriors = leaves
    .filter((leaf) => !leaf.excluded)
    .map((leaf) => posteriorScore(leaf))
    .filter((posterior) => posterior > 0);
  const entropy = posteriors.reduce((sum, posterior) => sum - posterior * Math.log(posterior), 0);
  const normalizedEntropy = posteriors.length > 1 ? entropy / Math.log(posteriors.length) : 0;

  return { entropy, normalizedEntropy };
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

function disclosedFeatureGroups(leaves: LeafScore[]): Set<string> {
  return new Set(
    leaves.flatMap((leaf) =>
      leaf.matchedFeatures
        .filter((feature) => feature.status !== "not_mentioned")
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

function missingFeatureCandidates({
  leaves,
  allDisclosedLeaves,
  decisionTree
}: {
  leaves: LeafScore[];
  allDisclosedLeaves: LeafScore[];
  decisionTree: AbdominalPainDecisionTree;
}) {
  if (leaves.length === 0) {
    return [];
  }

  const disclosedGroups = disclosedFeatureGroups(allDisclosedLeaves);
  const leafByNodeId = new Map(getLeafNodes(decisionTree).map((leaf) => [getNodeId(leaf), leaf]));
  const featureIndependence = getFeatureIndependence(decisionTree);
  const candidates = leaves.flatMap((leaf, leafIndex) => {
    const leafConfig = leafByNodeId.get(leaf.nodeId);
    const weightedFeatures = leafConfig ? getWeightedFeatures(leafConfig) : {};
    const uniquenessScores = leafConfig ? getFeatureUniqueness(leafConfig) : {};

    return Object.entries(weightedFeatures)
      .filter(([featureKey]) => !disclosedGroups.has(featureGroup(featureKey)))
      .filter(([featureKey]) => leaf.missingKeyFeatures.includes(featureKey))
      .map(([featureKey, weight]) => ({
        featureKey,
        weight,
        independence: featureIndependence[featureKey] ?? 0,
        uniqueness: uniquenessScores[featureKey] ?? (featureIndependence[featureKey] ?? 0) * 100,
        posterior: posteriorScore(leaf),
        disease: leaf.diagnosisGroup,
        questionValue:
          posteriorScore(leaf) *
          weight *
          ((uniquenessScores[featureKey] ?? (featureIndependence[featureKey] ?? 0) * 100) / 100),
        leafIndex
      }));
  });
  const bestByFeature = new Map<string, (typeof candidates)[number]>();

  for (const candidate of candidates) {
    const previous = bestByFeature.get(candidate.featureKey);

    if (
      !previous ||
      candidate.weight > previous.weight ||
      (candidate.weight === previous.weight && candidate.independence > previous.independence)
    ) {
      bestByFeature.set(candidate.featureKey, candidate);
    }
  }

  return [...bestByFeature.values()];
}

function topInformationGainFeatures({
  leaves,
  decisionTree,
  candidateDiseaseCount,
  onePerDisease
}: {
  leaves: LeafScore[];
  decisionTree: AbdominalPainDecisionTree;
  candidateDiseaseCount?: number;
  onePerDisease?: boolean;
}) {
  const activeLeaves = leaves.filter((leaf) => !leaf.excluded && posteriorScore(leaf) > 0);
  const candidateLeaves = typeof candidateDiseaseCount === "number"
    ? activeLeaves.slice(0, candidateDiseaseCount)
    : activeLeaves;
  const sortedCandidates = missingFeatureCandidates({
    leaves: candidateLeaves,
    allDisclosedLeaves: activeLeaves,
    decisionTree
  })
    .sort(
      (a, b) =>
        b.questionValue - a.questionValue ||
        b.uniqueness - a.uniqueness ||
        b.weight - a.weight ||
        a.leafIndex - b.leafIndex
    );
  const selectedCandidates = onePerDisease
    ? candidateLeaves
        .map((_, leafIndex) => sortedCandidates.find((candidate) => candidate.leafIndex === leafIndex))
        .filter((candidate): candidate is (typeof sortedCandidates)[number] => Boolean(candidate))
        .slice(0, 2)
    : sortedCandidates.slice(0, 2);

  return selectedCandidates.map((candidate) => ({
      featureKey: candidate.featureKey,
      disease: candidate.disease,
      questionValue: candidate.questionValue,
      posteriorProbability: candidate.posterior,
      importanceScore: candidate.weight,
      uniquenessScore: candidate.uniqueness,
      missingCompleteness: 1
    }));
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
    (leaf) =>
      hasEnoughLeafScoreToStop(leaf) &&
      posteriorScore(leaf) >= MATCH_THRESHOLD &&
      leaf.specificityScore >= SPECIFICITY_THRESHOLD &&
      hasEnoughPositiveEvidenceToStop(leaf)
  );
}

function closeLeaves(matchingResult: LeafMatchingAgentResult, topLeaf: LeafScore | undefined): LeafScore[] {
  if (!topLeaf) {
    return [];
  }

  return matchingResult.leafScores.filter(
    (leaf) =>
      leaf.nodeId !== topLeaf.nodeId &&
      hasEnoughLeafScoreToStop(leaf) &&
      posteriorScore(topLeaf) - posteriorScore(leaf) <= MULTIPLE_LEAF_MARGIN &&
      posteriorScore(leaf) >= MATCH_THRESHOLD - MULTIPLE_LEAF_MARGIN &&
      leaf.specificityScore >= SPECIFICITY_THRESHOLD - MULTIPLE_LEAF_MARGIN &&
      hasEnoughPositiveEvidenceToStop(leaf)
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
    (a, b) => posteriorScore(b) - posteriorScore(a) || b.score - a.score || b.specificityScore - a.specificityScore
  );
  const topLeaf = sortedLeaves[0];
  const entropy = posteriorEntropy(sortedLeaves);
  const emergencyRiskLeaves = sortedLeaves.filter(
    (leaf) =>
      isEmergencyTriage(leaf.triageLevel) &&
      leaf.score >= EMERGENCY_SCORE_THRESHOLD &&
      leaf.specificityScore >= EMERGENCY_SPECIFICITY_THRESHOLD &&
      hasEnoughPositiveEvidenceToStop(leaf)
  );
  const emergencyRiskLeaf = chooseHighestAcuityLeaf(emergencyRiskLeaves);

  const reachedThreshold = thresholdLeaves(matchingResult);
  const closeCandidateLeaves = closeLeaves(matchingResult, topLeaf);
  const secondLeaf = sortedLeaves[1];
  const hasDominantTopLeaf = topLeaf && secondLeaf
    ? posteriorScore(topLeaf) > 0 && posteriorScore(topLeaf) - posteriorScore(secondLeaf) >= DOMINANT_LEAF_MARGIN
    : false;

  if (reachedThreshold.length === 0) {
    const candidateLeaves = hasDominantTopLeaf && topLeaf ? [topLeaf] : sortedLeaves.slice(0, 3);
    const noMeaningfulMatch = !topLeaf || sortedLeaves.every((leaf) => !hasPositiveDiseaseEvidence(leaf));
    const highEntropy = entropy.normalizedEntropy >= HIGH_ENTROPY_THRESHOLD;
    const informationGainCandidates = noMeaningfulMatch
      ? []
      : topInformationGainFeatures({
          leaves: sortedLeaves,
          decisionTree,
          candidateDiseaseCount: highEntropy ? undefined : 2,
          onePerDisease: !highEntropy
        });
    const ambiguityDrivenMissingFeatures = informationGainCandidates.map((candidate) => candidate.featureKey);
    const missingInformationToAsk = noMeaningfulMatch
      ? []
      : ambiguityDrivenMissingFeatures.length > 0
        ? ambiguityDrivenMissingFeatures
        : missingInformationFromLeaves(candidateLeaves);
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
      selectedTriageLevel: emergencyRiskLeaf?.triageLevel ?? null,
      likelyLeaves: [],
      candidateLeaves: uniqueStrings([
        ...candidateLeaves.map((leaf) => leaf.nodeId),
        ...(emergencyRiskLeaf ? [emergencyRiskLeaf.nodeId] : [])
      ])
        .map((nodeId) => sortedLeaves.find((leaf) => leaf.nodeId === nodeId))
        .filter((leaf): leaf is LeafScore => Boolean(leaf)),
      reasoningFeatures: noMeaningfulMatch ? [] : reasoningFeaturesFromLeaves(candidateLeaves),
      missingInformationToAsk,
      suggestedQuestionFocus,
      patientFacingInstruction:
        emergencyRiskLeaf
          ? "Current information suggests possible urgent risk, but the disease match is not accurate enough to stop. Briefly acknowledge the safety concern, do not give a final diagnosis or final triage recommendation, and ask for more symptom details using the suggested focus areas."
          : "Current information is not enough to make a recommendation. Ask for more symptom details using the suggested focus areas.",
      uncertaintyStatement: emergencyRiskLeaf
        ? "There may be urgent risk, but more information is needed before identifying the most likely disease."
        : "More information is needed before giving a triage recommendation.",
      followUpLogic: {
        ruleUsed: noMeaningfulMatch
          ? "no_meaningful_match"
          : highEntropy
            ? "high_entropy_information_gain"
            : "low_entropy_confirm_top_disease",
        entropy: entropy.entropy,
        normalizedEntropy: entropy.normalizedEntropy,
        candidateFeatures: informationGainCandidates
      }
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
    const missingInformationToAsk = missingInformationFromLeaves(multipleLikelyLeaves);

    return {
      shouldStop: false,
      decision: "multiple_possible_leaves",
      selectedTriageLevel: safestLeaf?.triageLevel ?? null,
      likelyLeaves: multipleLikelyLeaves,
      candidateLeaves: sortedLeaves.slice(0, 3),
      reasoningFeatures: reasoningFeaturesFromLeaves(multipleLikelyLeaves),
      missingInformationToAsk,
      suggestedQuestionFocus: suggestedFocusFromMissing(missingInformationToAsk),
      patientFacingInstruction:
        "Explain that more than one condition is possible, including possible urgent risk if the selected triage level is urgent or emergency. Do not stop or give a final disease conclusion yet. Ask for information that would help distinguish them.",
      uncertaintyStatement: "More than one explanation remains possible from the disclosed symptoms, so more information is needed before a final disease-level conclusion.",
      followUpLogic: {
        ruleUsed: "high_entropy_information_gain",
        entropy: entropy.entropy,
        normalizedEntropy: entropy.normalizedEntropy,
        candidateFeatures: topInformationGainFeatures({
          leaves: sortedLeaves,
          decisionTree,
          candidateDiseaseCount: undefined,
          onePerDisease: false
        })
      }
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
    missingInformationToAsk: [],
    suggestedQuestionFocus: [],
    patientFacingInstruction:
      "Explain that the current pattern may be consistent with the selected condition, give the triage recommendation, and state that this is based only on disclosed symptoms.",
    uncertaintyStatement: "This is not a definite diagnosis and is based only on the symptoms disclosed so far.",
    followUpLogic: {
      ruleUsed: "low_entropy_confirm_top_disease",
      entropy: entropy.entropy,
      normalizedEntropy: entropy.normalizedEntropy,
      candidateFeatures: []
    }
  };
}
