import { generateGeminiResponse } from "../services/geminiService";
import type {
  AbdominalPainDecisionTree,
  AbdominalPainDecisionTreeLeaf,
  DisclosedSymptomMemory,
  LeafFeatureMatch,
  LeafMatchingAgentResult,
  LeafScore
} from "../types/experiment";

const POSTERIOR_TEMPERATURE = 0.2;

function negativeStrengthForFeature(featureKey: string, weight: number, hardExclusionFeatures: Set<string>): number {
  if (hardExclusionFeatures.has(featureKey)) {
    return 1;
  }

  return weight >= 90 ? 0.5 : 0.25;
}

const symptomFeatureMap: Record<string, string[]> = {
  generic_abdominal_pain: ["generic_abdominal_pain"],
  upper_abdominal_pain: ["upper_abdominal_pain"],
  epigastric_pain: ["epigastric_pain"],
  burning_or_indigestion: ["burning_or_indigestion"],
  right_lower_abdominal_pain: ["rlq_pain", "right_lower_quadrant_pain"],
  left_lower_abdominal_pain: ["llq_pain", "left_lower_quadrant_pain"],
  flank_or_groin_pain: ["flank_or_groin_pain"],
  painful_bulge: ["painful_bulge"],
  pain_migration: ["migration", "pain_migration"],
  movement_worsens_pain: ["movement_or_rebound", "movement_pain_or_rebound_tenderness"],
  nausea: ["nausea", "vomiting_or_nausea", "nausea_vomiting"],
  vomiting: ["vomiting", "vomiting_or_nausea", "nausea_vomiting", "vomiting_or_diarrhea"],
  diarrhea: ["diarrhea", "altered_bowel", "altered_bowel_habits", "vomiting_or_diarrhea"],
  watery_diarrhea: ["watery_diarrhea", "diarrhea", "altered_bowel"],
  stomach_cramps: ["diffuse_cramps", "crampy_pain"],
  blood_in_stool: ["blood_in_stool"],
  fever: ["fever"],
  high_fever: ["high_fever", "fever"],
  hydration_preserved: ["hydration_preserved"],
  dehydration: ["dehydration"],
  urinary_symptoms: ["urinary_symptoms"],
  pregnancy_possible: ["pregnancy_possible"],
  dizziness_syncope: ["dizziness_syncope", "ill_appearance", "very_unwell_appearance"],
  abdominal_swelling_or_no_stool: ["constipation_or_no_stool", "severe_or_worsening"],
  severe_or_worsening: ["severe_or_worsening", "worsening_course", "severe_persistent_pain", "sudden_severe_pain"],
  medication_risk: ["medication_risk"],
  right_lower_quadrant_pain: ["right_lower_quadrant_pain"],
  right_upper_quadrant_pain: ["right_upper_quadrant_pain"],
  left_lower_quadrant_pain: ["left_lower_quadrant_pain"],
  epigastric_abdominal_pain: ["epigastric_pain"],
  radiation_to_back: ["radiation_to_back"],
  shoulder_or_back_radiation: ["shoulder_or_back_radiation"],
  postprandial_pain: ["postprandial_pain"],
  prolonged_episode: ["prolonged_episode"],
  pain_out_of_proportion: ["pain_out_of_proportion"],
  vascular_risk_factors: ["vascular_risk_factors"],
  diffuse_abdominal_pain: ["diffuse_abdominal_pain"],
  worsening_tenderness: ["worsening_tenderness"],
  older_age_or_prior_history: ["older_age_or_prior_history"],
  alcohol_or_gallstone_risk_factors: ["alcohol_or_gallstone_risk_factors"]
};

const absentSymptomFeatureMap: Record<string, string[]> = {
  blood_in_stool: ["no_blood_in_stool"],
  high_fever: [],
  fever: [],
  hydration_preserved: ["dehydration"],
  dehydration: ["hydration_preserved"],
  right_lower_abdominal_pain: ["right_lower_quadrant_pain"],
  left_lower_abdominal_pain: ["left_lower_quadrant_pain"],
  upper_abdominal_pain: ["right_upper_quadrant_pain", "epigastric_pain"],
  epigastric_pain: ["epigastric_pain"],
  pain_migration: ["pain_migration"],
  movement_worsens_pain: ["movement_pain_or_rebound_tenderness"],
  nausea: ["nausea", "nausea_vomiting"],
  vomiting: ["vomiting", "nausea_vomiting", "vomiting_or_diarrhea"],
  urinary_symptoms: ["primary_urinary_symptoms"],
  pregnancy_possible: ["pregnancy"],
  dizziness_syncope: ["ill_appearance", "very_unwell_appearance"]
};

function getLeafNodes(decisionTree: AbdominalPainDecisionTree): AbdominalPainDecisionTreeLeaf[] {
  return decisionTree.leaf_nodes ?? decisionTree.leafNodes ?? [];
}

function getFeatureAliases(decisionTree: AbdominalPainDecisionTree): Record<string, string[]> {
  return decisionTree.feature_aliases ?? decisionTree.featureAliases ?? {};
}

function getNodeId(leaf: AbdominalPainDecisionTreeLeaf): string {
  return leaf.node_id ?? leaf.nodeId ?? "unknown_leaf";
}

function getDiagnosisGroup(leaf: AbdominalPainDecisionTreeLeaf): string {
  return leaf.diagnosis_group ?? leaf.diagnosisGroup ?? getNodeId(leaf);
}

function getTriageLevel(leaf: AbdominalPainDecisionTreeLeaf): string {
  return leaf.triage_level ?? leaf.triageLevel ?? "Unknown";
}

function getWeightedFeatures(leaf: AbdominalPainDecisionTreeLeaf): Record<string, number> {
  if (leaf.weighted_features) {
    return leaf.weighted_features;
  }

  if (leaf.weightedFeatures) {
    return leaf.weightedFeatures;
  }

  return Object.fromEntries((leaf.keyFeatures ?? []).map((feature) => [feature, 1]));
}

function getStrongPositivePattern(leaf: AbdominalPainDecisionTreeLeaf): Record<string, string[]> {
  return leaf.strong_positive_pattern ?? leaf.strongPositivePattern ?? {};
}

function getFeatureDetails(leaf: AbdominalPainDecisionTreeLeaf): Record<string, string[]> {
  return leaf.feature_details ?? leaf.featureDetails ?? {};
}

function getHardExclusionFeatures(leaf: AbdominalPainDecisionTreeLeaf): string[] {
  return leaf.hard_exclusion_features ?? leaf.hardExclusionFeatures ?? [];
}

function getSuggestedQuestions(leaf: AbdominalPainDecisionTreeLeaf): string[] {
  return leaf.if_not_stop_ask ?? leaf.suggestedFollowUpQuestions ?? [];
}

function getAllDecisionTreeFeatureKeys(decisionTree: AbdominalPainDecisionTree): Set<string> {
  return new Set(
    getLeafNodes(decisionTree).flatMap((leaf) => Object.keys(getWeightedFeatures(leaf)))
  );
}

function stripJsonFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseAgentJson(text: string): unknown {
  const stripped = stripJsonFence(text);

  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    const repaired = stripped
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/,\s*([}\]])/g, "$1");

    return JSON.parse(repaired) as unknown;
  }
}

function clampScore(value: unknown): number {
  return Math.max(0, Math.min(1, typeof value === "number" && Number.isFinite(value) ? value : 0));
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function hasAnyMatchedFeature(leafScores: LeafScore[]): boolean {
  return leafScores.some((leaf) =>
    leaf.matchedFeatures.some(
      (feature) =>
        feature.status === "present" ||
        feature.status === "uncertain" ||
        feature.status === "absent"
    )
  );
}

function zeroOutLeafScores(leafScores: LeafScore[]): LeafScore[] {
  return leafScores.map((leaf) => ({
    ...leaf,
    score: 0,
    rawScore: 0,
    posteriorProbability: 0,
    positiveEvidence: 0,
    negativeEvidence: 0,
    specificityScore: 0,
    matchedFeatures: [],
    negativeOrContradictingFeatures: [],
    reasoningSummary: "No disclosed symptom clearly matched this decision-tree leaf."
  }));
}

function evidenceIsFromParticipant(evidenceText: string, participantEvidenceText: string): boolean {
  return participantEvidenceText.toLowerCase().includes(evidenceText.toLowerCase());
}

function sanitizeFeatureMatch(
  value: unknown,
  allowedFeatureKeys: Set<string>,
  participantEvidenceText: string
): LeafFeatureMatch | null {
  const raw = value as Partial<LeafFeatureMatch>;

  if (typeof raw.featureKey !== "string" || !allowedFeatureKeys.has(raw.featureKey)) {
    return null;
  }

  const status =
    raw.status === "present" ||
    raw.status === "absent" ||
    raw.status === "uncertain" ||
    raw.status === "not_mentioned"
      ? raw.status
      : "not_mentioned";
  const evidenceText = Array.isArray(raw.evidenceText)
    ? raw.evidenceText
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => evidenceIsFromParticipant(item, participantEvidenceText))
    : [];

  if ((raw.matched || status !== "not_mentioned") && evidenceText.length === 0) {
    return null;
  }

  return {
    featureKey: raw.featureKey,
    matched: Boolean(raw.matched),
    status,
    matchConfidence: clampScore(raw.matchConfidence),
    detailCompletion: clampScore(raw.detailCompletion),
    matchedDetails: Array.isArray(raw.matchedDetails)
      ? raw.matchedDetails.filter((item): item is string => typeof item === "string")
      : [],
    missingDetails: Array.isArray(raw.missingDetails)
      ? raw.missingDetails.filter((item): item is string => typeof item === "string")
      : [],
    evidenceText,
    explanation: typeof raw.explanation === "string" ? raw.explanation : ""
  };
}

function sanitizeLeafScore(
  value: unknown,
  allowedFeatureKeys: Set<string>,
  leafByNodeId: Map<string, AbdominalPainDecisionTreeLeaf>,
  participantEvidenceText: string
): LeafScore | null {
  const raw = value as Partial<LeafScore>;

  if (typeof raw.nodeId !== "string") {
    return null;
  }

  const leaf = leafByNodeId.get(raw.nodeId);

  if (!leaf) {
    return null;
  }

  return {
    nodeId: raw.nodeId,
    diagnosisGroup: typeof raw.diagnosisGroup === "string" ? raw.diagnosisGroup : getDiagnosisGroup(leaf),
    triageLevel: typeof raw.triageLevel === "string" ? raw.triageLevel : getTriageLevel(leaf),
    score: clampScore(raw.score),
    rawScore: finiteNumber(raw.rawScore),
    posteriorProbability: clampScore(raw.posteriorProbability),
    positiveEvidence: typeof raw.positiveEvidence === "number" ? raw.positiveEvidence : 0,
    negativeEvidence: typeof raw.negativeEvidence === "number" ? raw.negativeEvidence : 0,
    totalPossibleImportance: typeof raw.totalPossibleImportance === "number" ? raw.totalPossibleImportance : 0,
    specificityScore: clampScore(raw.specificityScore),
    matchedFeatures: Array.isArray(raw.matchedFeatures)
      ? raw.matchedFeatures
          .map((item) => sanitizeFeatureMatch(item, allowedFeatureKeys, participantEvidenceText))
          .filter((item): item is LeafFeatureMatch => item !== null)
      : [],
    missingKeyFeatures: Array.isArray(raw.missingKeyFeatures)
      ? raw.missingKeyFeatures.filter((item): item is string => typeof item === "string")
      : [],
    negativeOrContradictingFeatures: Array.isArray(raw.negativeOrContradictingFeatures)
      ? raw.negativeOrContradictingFeatures.filter((item): item is string => typeof item === "string")
      : [],
    reasoningSummary: typeof raw.reasoningSummary === "string" ? raw.reasoningSummary : ""
  };
}

function isPositiveFeatureMatch(feature: LeafFeatureMatch): boolean {
  return feature.matched && (feature.status === "present" || feature.status === "uncertain");
}

function featureCompleteness(feature: LeafFeatureMatch, requiredDetails: string[] = []): number {
  if (!feature.matched || feature.status === "absent" || feature.status === "not_mentioned") {
    return 0;
  }

  if (requiredDetails.length === 0 && feature.status === "present") {
    return 1;
  }

  const symptomMentionCredit = 0.5;
  const detailCredit = 0.5 * clampScore(feature.detailCompletion);

  return Math.min(1, symptomMentionCredit + detailCredit);
}

function applyPosteriorProbabilities(leafScores: LeafScore[]): LeafScore[] {
  const activeLeaves = leafScores.filter((leaf) => !leaf.excluded);
  const denominator = activeLeaves.reduce(
    (sum, leaf) => sum + Math.exp((leaf.rawScore ?? leaf.score) / POSTERIOR_TEMPERATURE),
    0
  );

  return leafScores.map((leaf) => {
    if (leaf.excluded || denominator === 0) {
      return { ...leaf, posteriorProbability: 0 };
    }

    const posteriorProbability =
      Math.exp((leaf.rawScore ?? leaf.score) / POSTERIOR_TEMPERATURE) / denominator;

    return {
      ...leaf,
      posteriorProbability
    };
  });
}

function entropyForPosterior(leafScores: LeafScore[]): { entropy: number; normalizedEntropy: number } {
  const activePosteriors = leafScores
    .filter((leaf) => !leaf.excluded)
    .map((leaf) => leaf.posteriorProbability ?? 0)
    .filter((posterior) => posterior > 0);
  const entropy = activePosteriors.reduce((sum, posterior) => sum - posterior * Math.log(posterior), 0);
  const normalizedEntropy =
    activePosteriors.length > 1 ? entropy / Math.log(activePosteriors.length) : 0;

  return { entropy, normalizedEntropy };
}

function recomputeLeafScoreFromMatches(
  leafScore: LeafScore,
  leaf: AbdominalPainDecisionTreeLeaf
): LeafScore {
  const weightedFeatures = getWeightedFeatures(leaf);
  const featureDetails = getFeatureDetails(leaf);
  const totalWeight = Object.values(weightedFeatures).reduce((sum, weight) => sum + weight, 0) || 1;
  const relevantMatchedFeatures = leafScore.matchedFeatures.filter(
    (feature) =>
      feature.featureKey in weightedFeatures &&
      feature.status !== "not_mentioned" &&
      feature.evidenceText.length > 0
  );
  const positiveMatches = relevantMatchedFeatures.filter(isPositiveFeatureMatch);
  const matchedFeatureKeys = new Set(positiveMatches.map((feature) => feature.featureKey));
  const positiveEvidence = positiveMatches.reduce((sum, feature) => {
    const weight = weightedFeatures[feature.featureKey] ?? 0;
    return sum + weight * featureCompleteness(feature, featureDetails[feature.featureKey] ?? []);
  }, 0);
  const hardExclusionFeatures = new Set(getHardExclusionFeatures(leaf));
  const hardContradictions = relevantMatchedFeatures
    .filter((feature) => feature.status === "absent" && hardExclusionFeatures.has(feature.featureKey))
    .map((feature) => feature.featureKey);
  const negativeEvidence = relevantMatchedFeatures
    .filter((feature) => feature.status === "absent")
    .reduce((sum, feature) => {
      const weight = weightedFeatures[feature.featureKey] ?? 0;
      return sum + weight * negativeStrengthForFeature(feature.featureKey, weight, hardExclusionFeatures);
    }, 0);
  const pattern = getStrongPositivePattern(leaf);
  const satisfiedAnyOfFeatures = new Set<string>();
  const alternativeFeatureGroups = [pattern.any_of, pattern.any_two_of].filter(
    (features): features is string[] => Array.isArray(features)
  );

  for (const anyOfFeatures of alternativeFeatureGroups) {
    if (anyOfFeatures.some((featureKey) => matchedFeatureKeys.has(featureKey))) {
      for (const featureKey of anyOfFeatures) {
        satisfiedAnyOfFeatures.add(featureKey);
      }
    }
  }

  const missingKeyFeatures = Object.keys(weightedFeatures).filter(
    (featureKey) => !matchedFeatureKeys.has(featureKey) && !satisfiedAnyOfFeatures.has(featureKey)
  );
  const negativeOrContradictingFeatures = uniqueStrings([
    ...leafScore.negativeOrContradictingFeatures,
    ...leafScore.matchedFeatures
      .filter((feature) => feature.status === "absent")
      .map((feature) => feature.featureKey)
  ]);
  const excluded = hardContradictions.length > 0;
  const rawScore = excluded ? 0 : Math.min(1, (positiveEvidence - negativeEvidence) / totalWeight);
  const score = Math.max(0, rawScore);
  const specificityScore = specificityForFeatures(positiveMatches, weightedFeatures);

  return {
    ...leafScore,
    score,
    rawScore,
    positiveEvidence,
    negativeEvidence,
    totalPossibleImportance: totalWeight,
    specificityScore,
    excluded,
    exclusionReason: excluded
      ? `Hard exclusion matched: ${hardContradictions.join(", ")}.`
      : leafScore.exclusionReason,
    matchedFeatures: relevantMatchedFeatures,
    missingKeyFeatures,
    negativeOrContradictingFeatures,
    reasoningSummary:
      positiveMatches.length > 0
        ? `Matched ${positiveMatches.map((feature) => feature.featureKey).join(", ")}. Positive evidence ${positiveEvidence.toFixed(1)}; negative evidence ${negativeEvidence.toFixed(1)}.`
        : leafScore.reasoningSummary
  };
}

function mergeDisclosedFeatureMatches(
  leafScore: LeafScore,
  disclosedFeatureMatches: Map<string, LeafFeatureMatch>
): LeafScore {
  const existingFeatureKeys = new Set(leafScore.matchedFeatures.map((feature) => feature.featureKey));
  const mergedFeatures = [...leafScore.matchedFeatures];

  for (const [featureKey, featureMatch] of disclosedFeatureMatches) {
    if (!existingFeatureKeys.has(featureKey)) {
      mergedFeatures.push(featureMatch);
    }
  }

  return {
    ...leafScore,
    matchedFeatures: mergedFeatures
  };
}

function sanitizeMatchingResult(
  value: unknown,
  decisionTree: AbdominalPainDecisionTree,
  disclosedSymptoms: DisclosedSymptomMemory,
  participantEvidenceText: string
): LeafMatchingAgentResult {
  const raw = value as Partial<LeafMatchingAgentResult>;
  const leafByNodeId = new Map(getLeafNodes(decisionTree).map((leaf) => [getNodeId(leaf), leaf]));
  const knownNodeIds = new Set(leafByNodeId.keys());
  const allowedFeatureKeys = getAllDecisionTreeFeatureKeys(decisionTree);
  const leafScores = Array.isArray(raw.leafScores)
    ? raw.leafScores
        .map((item) => sanitizeLeafScore(item, allowedFeatureKeys, leafByNodeId, participantEvidenceText))
        .filter((item): item is LeafScore => item !== null)
        .filter((score) => knownNodeIds.has(score.nodeId))
    : [];

  const scoredNodeIds = new Set(leafScores.map((score) => score.nodeId));
  const completeLeafScores = [
    ...leafScores,
    ...[...knownNodeIds]
      .filter((nodeId) => !scoredNodeIds.has(nodeId))
      .map((nodeId): LeafScore => {
        const leaf = leafByNodeId.get(nodeId);

        return {
          nodeId,
          diagnosisGroup: leaf ? getDiagnosisGroup(leaf) : nodeId,
          triageLevel: leaf ? getTriageLevel(leaf) : "Unknown",
          score: 0,
          rawScore: 0,
          posteriorProbability: 0,
          positiveEvidence: 0,
          negativeEvidence: 0,
          totalPossibleImportance: leaf
            ? Object.values(getWeightedFeatures(leaf)).reduce((sum, weight) => sum + weight, 0)
            : 0,
          specificityScore: 0,
          matchedFeatures: [],
          missingKeyFeatures: leaf ? Object.keys(getWeightedFeatures(leaf)) : [],
          negativeOrContradictingFeatures: [],
          reasoningSummary: "The LLM matcher omitted this leaf; the server filled it with no matched evidence."
        };
      })
  ];

  const disclosedFeatureMatches = featuresFromSymptoms(disclosedSymptoms);
  const recomputedLeafScores = completeLeafScores.map((leafScore) => {
    const leaf = leafByNodeId.get(leafScore.nodeId);
    const mergedLeafScore = mergeDisclosedFeatureMatches(leafScore, disclosedFeatureMatches);
    return leaf ? recomputeLeafScoreFromMatches(mergedLeafScore, leaf) : mergedLeafScore;
  });
  const hasDisclosure = disclosedSymptoms.symptoms.some((symptom) => symptom.status !== "not_mentioned");
  const hasMatchedFeature = hasDisclosure && hasAnyMatchedFeature(recomputedLeafScores);
  const normalizedLeafScores = hasMatchedFeature
    ? applyPosteriorProbabilities(recomputedLeafScores)
    : zeroOutLeafScores(recomputedLeafScores);
  const scoringSummary = entropyForPosterior(normalizedLeafScores);

  const sortedLeaves = [...normalizedLeafScores].sort(
    (a, b) => b.score - a.score || b.specificityScore - a.specificityScore
  );

  return {
    leafScores: sortedLeaves,
    topLeaves: sortedLeaves.slice(0, 3),
    allCandidateConditions: hasMatchedFeature
      ? Array.isArray(raw.allCandidateConditions)
        ? raw.allCandidateConditions.filter((item): item is string => typeof item === "string")
        : sortedLeaves.filter((leaf) => leaf.score > 0).map((leaf) => leaf.diagnosisGroup)
      : [],
    globalReasoningSummary: hasMatchedFeature
      ? typeof raw.globalReasoningSummary === "string"
        ? raw.globalReasoningSummary
        : "Compared disclosed symptoms against every abdominal pain leaf."
      : "No participant-disclosed symptom clearly matched any decision-tree leaf.",
    scoringSummary: {
      temperature: POSTERIOR_TEMPERATURE,
      entropy: scoringSummary.entropy,
      normalizedEntropy: scoringSummary.normalizedEntropy
    }
  };
}

function featuresFromSymptoms(disclosedSymptoms: DisclosedSymptomMemory): Map<string, LeafFeatureMatch> {
  const featureMatches = new Map<string, LeafFeatureMatch>();

  for (const symptom of disclosedSymptoms.symptoms) {
    const positiveFeatures =
      symptom.status === "present" || symptom.status === "uncertain"
        ? symptomFeatureMap[symptom.symptomId] ?? []
        : [];
    const absentPositiveFeatures =
      symptom.status === "absent" ? symptomFeatureMap[symptom.symptomId] ?? [] : [];
    const negativeFeatures = symptom.status === "absent" ? absentSymptomFeatureMap[symptom.symptomId] ?? [] : [];

    for (const featureKey of positiveFeatures) {
      const detailSignals = [
        symptom.bodyLocation ? "location" : "",
        symptom.severity ? "severity" : "",
        symptom.duration ? "duration" : ""
      ].filter(Boolean);
      featureMatches.set(featureKey, {
        featureKey,
        matched: true,
        status: symptom.status,
        matchConfidence: symptom.status === "present" ? 0.9 : 0.55,
        detailCompletion: Math.min(1, detailSignals.length / 3),
        matchedDetails: detailSignals,
        missingDetails: [],
        evidenceText: [symptom.evidenceText],
        explanation: `${symptom.label} maps to ${featureKey}.`
      });
    }

    for (const featureKey of absentPositiveFeatures) {
      featureMatches.set(featureKey, {
        featureKey,
        matched: false,
        status: "absent",
        matchConfidence: 0.9,
        detailCompletion: 0,
        matchedDetails: [],
        missingDetails: [],
        evidenceText: [symptom.evidenceText],
        explanation: `${symptom.label} was denied.`
      });
    }

    for (const featureKey of negativeFeatures) {
      featureMatches.set(featureKey, {
        featureKey,
        matched: true,
        status: "present",
        matchConfidence: 0.9,
        detailCompletion: 0,
        matchedDetails: [],
        missingDetails: [],
        evidenceText: [symptom.evidenceText],
        explanation: `${symptom.label} maps to ${featureKey}.`
      });
    }
  }

  return featureMatches;
}

function specificityForFeatures(matchedFeatures: LeafFeatureMatch[], weightedFeatures: Record<string, number>): number {
  const weightedFeatureValues = Object.values(weightedFeatures);
  const allFeatureAverageWeight =
    weightedFeatureValues.reduce((sum, weight) => sum + weight, 0) /
    (weightedFeatureValues.length || 1);
  const specificityLiftMultiplier = 1.003;
  const requiredAverageWeight = allFeatureAverageWeight * specificityLiftMultiplier;
  const matchedWeights = matchedFeatures
    .filter((feature) => feature.matched && (feature.status === "present" || feature.status === "uncertain"))
    .map((feature) => {
      return (weightedFeatures[feature.featureKey] ?? 0) * featureCompleteness(feature);
    })
    .filter((weight) => weight > 0);

  if (matchedWeights.length === 0 || requiredAverageWeight <= 0) {
    return 0;
  }

  const matchedAverageWeight =
    matchedWeights.reduce((sum, weight) => sum + weight, 0) / matchedWeights.length;

  return Math.min(1, matchedAverageWeight / requiredAverageWeight);
}

function fallbackMatchSymptomsToLeaves({
  disclosedSymptoms,
  decisionTree
}: {
  disclosedSymptoms: DisclosedSymptomMemory;
  decisionTree: AbdominalPainDecisionTree;
}): LeafMatchingAgentResult {
  const allFeatureMatches = featuresFromSymptoms(disclosedSymptoms);
  const leafScores = getLeafNodes(decisionTree).map((leaf): LeafScore => {
    const weightedFeatures = getWeightedFeatures(leaf);
    const totalWeight = Object.values(weightedFeatures).reduce((sum, weight) => sum + weight, 0) || 1;
    const matchedFeatures: LeafFeatureMatch[] = [];
    const missingKeyFeatures: string[] = [];
    const negativeOrContradictingFeatures: string[] = [];
    let matchedWeight = 0;

    for (const [featureKey, weight] of Object.entries(weightedFeatures)) {
      const match = allFeatureMatches.get(featureKey);

      if (!match) {
        missingKeyFeatures.push(featureKey);
        continue;
      }

      matchedFeatures.push(match);

      if (match.matched && match.status !== "absent") {
        matchedWeight += weight * featureCompleteness(match, getFeatureDetails(leaf)[featureKey] ?? []);
      } else if (match.status === "absent") {
        negativeOrContradictingFeatures.push(featureKey);
      }
    }

    const hardExclusionFeatures = new Set(getHardExclusionFeatures(leaf));
    const hardContradictions = matchedFeatures
      .filter((feature) => feature.status === "absent" && hardExclusionFeatures.has(feature.featureKey))
      .map((feature) => feature.featureKey);
    const negativeEvidence = matchedFeatures
      .filter((feature) => feature.status === "absent")
      .reduce((sum, feature) => {
        const weight = weightedFeatures[feature.featureKey] ?? 0;
        return sum + weight * negativeStrengthForFeature(feature.featureKey, weight, hardExclusionFeatures);
      }, 0);
    const excluded = hardContradictions.length > 0;
    const rawScore = excluded ? 0 : Math.min(1, (matchedWeight - negativeEvidence) / totalWeight);
    const score = Math.max(0, rawScore);
    const specificityScore = specificityForFeatures(matchedFeatures, weightedFeatures);

    return {
      nodeId: getNodeId(leaf),
      diagnosisGroup: getDiagnosisGroup(leaf),
      triageLevel: getTriageLevel(leaf),
      score,
      rawScore,
      positiveEvidence: matchedWeight,
      negativeEvidence,
      totalPossibleImportance: totalWeight,
      specificityScore,
      excluded,
      exclusionReason: excluded ? `Hard exclusion matched: ${hardContradictions.join(", ")}.` : undefined,
      matchedFeatures,
      missingKeyFeatures,
      negativeOrContradictingFeatures,
      reasoningSummary:
        matchedFeatures.length > 0
          ? `Matched ${matchedFeatures.map((feature) => feature.featureKey).join(", ")}.`
          : `No specific disclosed symptoms matched ${getDiagnosisGroup(leaf)}.`
    };
  });

  const hasMatchedFeature = hasAnyMatchedFeature(leafScores);
  const normalizedLeafScores = hasMatchedFeature
    ? applyPosteriorProbabilities(leafScores)
    : zeroOutLeafScores(leafScores);
  const scoringSummary = entropyForPosterior(normalizedLeafScores);

  const sortedLeaves = normalizedLeafScores.sort(
    (a, b) => b.score - a.score || b.specificityScore - a.specificityScore
  );

  return {
    leafScores: sortedLeaves,
    topLeaves: sortedLeaves.slice(0, 3),
    allCandidateConditions: hasMatchedFeature
      ? sortedLeaves.filter((leaf) => leaf.score > 0).map((leaf) => leaf.diagnosisGroup)
      : [],
    globalReasoningSummary: hasMatchedFeature
      ? "Fallback semantic matcher used because the LLM matcher was unavailable."
      : "No participant-disclosed symptom clearly matched any decision-tree leaf.",
    scoringSummary: {
      temperature: POSTERIOR_TEMPERATURE,
      entropy: scoringSummary.entropy,
      normalizedEntropy: scoringSummary.normalizedEntropy
    }
  };
}

function compactTreeForPrompt(decisionTree: AbdominalPainDecisionTree): unknown {
  return {
    featureAliases: getFeatureAliases(decisionTree),
    leafNodes: getLeafNodes(decisionTree).map((leaf) => ({
      nodeId: getNodeId(leaf),
      diagnosisGroup: getDiagnosisGroup(leaf),
      triageLevel: getTriageLevel(leaf),
      sourceDiagnoses: leaf.source_diagnoses ?? leaf.sourceDiagnoses ?? [],
      weightedFeatures: getWeightedFeatures(leaf),
      featureDetails: getFeatureDetails(leaf),
      hardExclusionFeatures: getHardExclusionFeatures(leaf),
      uniquenessScores: leaf.uniqueness_scores ?? leaf.uniquenessScores ?? {},
      highSpecificityFeatures: leaf.highSpecificityFeatures ?? [],
      safetyRedFlags: leaf.safetyRedFlags ?? [],
      strongPositivePattern: leaf.strong_positive_pattern ?? leaf.strongPositivePattern ?? {},
      suggestedFollowUpQuestions: getSuggestedQuestions(leaf),
      recommendationText: leaf.recommendationText ?? leaf.stop_when ?? ""
    }))
  };
}

export async function matchSymptomsToLeavesWithAgent({
  disclosedSymptoms,
  participantEvidenceText,
  decisionTree,
  caseId
}: {
  disclosedSymptoms: DisclosedSymptomMemory;
  participantEvidenceText?: string;
  decisionTree: AbdominalPainDecisionTree;
  caseId: string;
}): Promise<LeafMatchingAgentResult> {
  const fallback = (): LeafMatchingAgentResult =>
    fallbackMatchSymptomsToLeaves({
      disclosedSymptoms,
      decisionTree
    });

  const systemInstruction = `
You are the Case/Leaf Matching Agent for a self-triage research study.
Compare only participant-disclosed information against every decision-tree leaf.
Use the decision-tree feature names, aliases, weighted features, and strong positive patterns as the authoritative feature definitions.
Use semantic matching: synonyms, locations, negations, partial phrases, and one participant phrase mapping to multiple decision-tree features are allowed.
The raw participant evidence is the primary source. The extracted symptoms are helper context only; if the raw evidence clearly matches a decision-tree feature that extraction missed, still match that feature.
Do not force a match. Only match a feature when the participant evidence explicitly supports it or uses a very direct synonym from the feature aliases.
For each positive feature, match both the symptom and the required details listed in featureDetails.
Use detailCompletion from 0 to 1:
- 0 means the symptom was mentioned but none of the required details were matched.
- 1 means all required details for that feature were matched.
- Use matchedDetails and missingDetails to name the details.
If a feature has no required details, use detailCompletion 1 when the symptom is clearly present.
If evidence is suggestive but not clear, use status "uncertain" with lower confidence. If the feature is not clearly supported, leave it out of matchedFeatures.
Do not infer unstated symptoms from a likely condition. For example, diarrhea does not imply dehydration, abdominal pain does not imply a focal location, and vomiting does not imply obstruction unless stool/gas blockage or swelling is also stated.
For negated findings, look for the corresponding positive feature in every leaf. If the participant denies a positive symptom (for example "no fever"), include that positive feature with status "absent" for leaves where it is a weighted feature.
Do not diagnose with certainty. Do not use hidden case truth.
If the participant is only chatting, gives no symptom information, or the disclosed content has no symptom feature that can be matched after semantic matching, return every leaf with an empty matchedFeatures array.
Return strict JSON only. Do not include scores; the server computes scores from matched features.
`;

  const userPrompt = `
Case id for logging/context only: ${caseId}

Raw participant evidence:
${participantEvidenceText?.trim() || "None"}

Disclosed symptoms:
${JSON.stringify(disclosedSymptoms.symptoms, null, 2)}

Decision tree:
${JSON.stringify(compactTreeForPrompt(decisionTree), null, 2)}

Return JSON:
{
  "leafScores": [
    {
      "nodeId": "leaf id",
      "matchedFeatures": [
        {
          "featureKey": "feature",
          "matched": true,
          "status": "present" | "absent" | "uncertain" | "not_mentioned",
          "matchConfidence": 0,
          "detailCompletion": 0,
          "matchedDetails": ["location"],
          "missingDetails": ["duration"],
          "evidenceText": ["participant evidence"],
          "explanation": "short reason"
        }
      ]
    }
  ]
}

Output every leaf exactly once. Keep JSON compact. Do not include scores; the server computes scores.
`;

  try {
    const response = await generateGeminiResponse({
      systemInstruction,
      userPrompt,
      temperature: 0.1,
      maxOutputTokens: 6000,
      responseMimeType: "application/json"
    });

    return sanitizeMatchingResult(
      parseAgentJson(response),
      decisionTree,
      disclosedSymptoms,
      participantEvidenceText ?? ""
    );
  } catch (error) {
    throw new Error(
      `Gemini leaf matching failed. Agent-only mode does not allow fallback. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
