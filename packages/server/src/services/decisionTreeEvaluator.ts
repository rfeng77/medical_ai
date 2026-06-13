import decisionTreeData from "../data/abdominalPainDecisionTree.json";
import type {
  ClinicalField,
  DecisionTreeEvaluationResult,
  DecisionTreeLeafScore,
  DisclosureCoverageMonitorResult,
  FieldValue,
  NormalizedDecisionFeature,
  ParticipantMemory,
} from "../types/experiment";

type StrongPositivePattern = {
  all_of?: string[];
  any_of?: string[];
  any_two_of?: string[];
  must_not_have?: string[];
  must_not_have_unless_emergency?: string[];
};

type DecisionLeafConfig = {
  node_id: string;
  diagnosis_group: string;
  triage_level: string;
  source_diagnoses: string[];
  weighted_features: Record<string, number>;
  strong_positive_pattern?: StrongPositivePattern;
  stop_when: string;
  if_not_stop_ask: string[];
};

type DisambiguationRule = {
  when_features_present: string[];
  when_features_missing_any: string[];
  ask: string;
  why: string;
};

type DecisionTreeConfig = {
  feature_aliases: Record<string, string[]>;
  leaf_nodes: DecisionLeafConfig[];
  global_stopping_rule: {
    emergency_override: {
      stop_immediately_if_any_node_matches: string[];
    };
    score_threshold: {
      primary_threshold: number;
    };
    minimum_specificity: {
      minimum_high_weight_or_branch_defining_features: number;
      high_weight_threshold: number;
    };
    ambiguity: {
      within_top_score: number;
      top_score_below: number;
    };
  };
  overlap_and_disambiguation_rules: DisambiguationRule[];
};

const decisionTree = decisionTreeData as unknown as DecisionTreeConfig;

const featureLabels: Record<string, string> = {
  generic_abdominal_pain: "abdominal pain",
  rlq_pain: "right-lower abdominal pain",
  llq_pain: "left-lower abdominal pain",
  upper_abdominal_pain: "upper abdominal pain",
  epigastric_pain: "upper middle or burning abdominal pain",
  flank_or_groin_pain: "flank or groin pain",
  painful_bulge: "a painful bulge",
  migration: "pain that moved location",
  movement_or_rebound: "pain worse with walking or movement",
  vomiting_or_nausea: "nausea or vomiting",
  nausea_vomiting: "nausea or vomiting",
  vomiting: "vomiting",
  nausea: "nausea",
  diarrhea: "diarrhea",
  watery_diarrhea: "watery diarrhea",
  diffuse_cramps: "abdominal cramps",
  crampy_pain: "crampy pain",
  fever: "fever or chills",
  high_fever: "high fever",
  blood_in_stool: "blood or black stool",
  no_blood_in_stool: "no blood in stool",
  hydration_preserved: "able to drink fluids",
  dehydration: "dehydration concern",
  dizziness_syncope: "dizziness or fainting",
  urinary_symptoms: "urinary symptoms",
  normal_urination: "normal urination",
  pregnancy_possible: "possible pregnancy",
  severe_or_worsening: "severe or worsening symptoms",
  constipation_or_no_stool: "constipation or no stool",
  altered_bowel: "bowel changes",
  burning_or_indigestion: "burning or indigestion-like pain",
  medication_risk: "medication that can increase risk",
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function addFeature(
  features: Set<NormalizedDecisionFeature>,
  feature: NormalizedDecisionFeature,
): void {
  features.add(feature);
}

function valueEquals(value: FieldValue | undefined, expected: string | boolean): boolean {
  return value === expected;
}

function addFeaturesFromClinicalField(
  features: Set<NormalizedDecisionFeature>,
  field: ClinicalField,
  value: FieldValue | undefined,
): void {
  if (field === "pain_location") {
    if (valueEquals(value, "right_lower_quadrant")) addFeature(features, "rlq_pain");
    if (valueEquals(value, "upper_abdomen")) {
      addFeature(features, "upper_abdominal_pain");
      addFeature(features, "epigastric_pain");
    }
    if (valueEquals(value, "left_lower_quadrant")) addFeature(features, "llq_pain");
    if (valueEquals(value, "diffuse_abdomen")) addFeature(features, "generic_abdominal_pain");
  }

  if (field === "pain_migration" && valueEquals(value, "reported_migration")) {
    addFeature(features, "migration");
  }

  if (field === "movement_pain" && value === true) {
    addFeature(features, "movement_or_rebound");
  }

  if (field === "pain_quality" && valueEquals(value, "crampy")) {
    addFeature(features, "diffuse_cramps");
    addFeature(features, "crampy_pain");
  }

  if (field === "fever" && value === true) {
    addFeature(features, "fever");
  }

  if (field === "vomiting" && value === true) {
    addFeature(features, "vomiting");
    addFeature(features, "vomiting_or_nausea");
    addFeature(features, "nausea_vomiting");
  }

  if (field === "nausea" && value === true) {
    addFeature(features, "nausea");
    addFeature(features, "vomiting_or_nausea");
    addFeature(features, "nausea_vomiting");
  }

  if (field === "diarrhea" && value === true) {
    addFeature(features, "diarrhea");
    addFeature(features, "watery_diarrhea");
    addFeature(features, "altered_bowel");
  }

  if (field === "bowel_movement") {
    addFeature(features, "altered_bowel");
  }

  if (field === "bleeding") {
    if (value === true) addFeature(features, "blood_in_stool");
    if (value === false) addFeature(features, "no_blood_in_stool");
  }

  if (field === "hydration") {
    if (valueEquals(value, "can_drink")) addFeature(features, "hydration_preserved");
    if (valueEquals(value, "mentioned")) addFeature(features, "dehydration");
  }

  if (field === "urination" && valueEquals(value, "normal")) {
    addFeature(features, "normal_urination");
  }

  if (field === "pregnancy" && value === true) {
    addFeature(features, "pregnancy_possible");
  }

  if (field === "dizziness" && value === true) {
    addFeature(features, "dizziness_syncope");
  }

  if (field === "medication" && value !== undefined) {
    addFeature(features, "medication_risk");
  }

  if (field === "red_flags" && value !== undefined) {
    addFeature(features, "severe_or_worsening");
  }
}

export function normalizeDecisionFeatures({
  message,
  memory,
  monitorResult,
}: {
  message: string;
  memory: ParticipantMemory;
  monitorResult: DisclosureCoverageMonitorResult;
}): NormalizedDecisionFeature[] {
  const features = new Set<NormalizedDecisionFeature>(
    memory.decisionTreeVisibleFeatures ?? [],
  );
  const normalizedMessage = normalizeText(message);

  for (const [feature, aliases] of Object.entries(decisionTree.feature_aliases)) {
    if (aliases.some((alias) => normalizedMessage.includes(normalizeText(alias)))) {
      addFeature(features, feature);
    }
  }

  if (/\b(no|without|denies|not)\s+(blood|bleeding|bloody)\b/i.test(message)) {
    addFeature(features, "no_blood_in_stool");
    features.delete("blood_in_stool");
  }

  if (/\b(stomach|belly|abdomen|abdominal|tummy)\b/i.test(message)) {
    addFeature(features, "generic_abdominal_pain");
  }

  const visibleFields = {
    ...memory.aiVisibleFields,
    ...monitorResult.updatedVisibleFieldsPreview,
  };

  for (const [field, value] of Object.entries(visibleFields) as Array<
    [ClinicalField, FieldValue | undefined]
  >) {
    addFeaturesFromClinicalField(features, field, value);
  }

  return [...features].sort();
}

function countPresent(features: string[], observedFeatures: Set<string>): number {
  return features.filter((feature) => observedFeatures.has(feature)).length;
}

export function matchesStrongPositivePattern({
  pattern,
  observedFeatures,
  allowEmergencyProhibitedFeatures = false,
}: {
  pattern: StrongPositivePattern | undefined;
  observedFeatures: Set<string>;
  allowEmergencyProhibitedFeatures?: boolean;
}): boolean {
  if (!pattern) return false;

  if (pattern.all_of?.some((feature) => !observedFeatures.has(feature))) {
    return false;
  }

  if (pattern.any_of && countPresent(pattern.any_of, observedFeatures) === 0) {
    return false;
  }

  if (pattern.any_two_of && countPresent(pattern.any_two_of, observedFeatures) < 2) {
    return false;
  }

  if (pattern.must_not_have?.some((feature) => observedFeatures.has(feature))) {
    return false;
  }

  if (
    !allowEmergencyProhibitedFeatures &&
    pattern.must_not_have_unless_emergency?.some((feature) => observedFeatures.has(feature))
  ) {
    return false;
  }

  return true;
}

export function scoreDecisionLeaf({
  leaf,
  observedFeatures,
  emergencyNodeIds,
}: {
  leaf: DecisionLeafConfig;
  observedFeatures: Set<string>;
  emergencyNodeIds: Set<string>;
}): DecisionTreeLeafScore {
  const weightedEntries = Object.entries(leaf.weighted_features);
  const totalWeight = weightedEntries.reduce((sum, [, weight]) => sum + weight, 0);
  const matchedEntries = weightedEntries.filter(([feature]) => observedFeatures.has(feature));
  const matchedWeight = matchedEntries.reduce((sum, [, weight]) => sum + weight, 0);
  const emergencyOverrideMatched = emergencyNodeIds.has(leaf.node_id);
  const strongPatternMatched = matchesStrongPositivePattern({
    pattern: leaf.strong_positive_pattern,
    observedFeatures,
    allowEmergencyProhibitedFeatures: emergencyOverrideMatched,
  });

  return {
    nodeId: leaf.node_id,
    diagnosisGroup: leaf.diagnosis_group,
    triageLevel: leaf.triage_level,
    score: totalWeight > 0 ? Number((matchedWeight / totalWeight).toFixed(2)) : 0,
    matchedFeatures: matchedEntries.map(([feature]) => feature),
    missingFeatures: weightedEntries
      .map(([feature]) => feature)
      .filter((feature) => !observedFeatures.has(feature)),
    matchedWeight,
    totalWeight,
    strongPatternMatched,
    emergencyOverrideMatched: emergencyOverrideMatched && strongPatternMatched,
    sourceDiagnoses: leaf.source_diagnoses,
    suggestedQuestions: leaf.if_not_stop_ask,
  };
}

function hasMinimumSpecificity(leaf: DecisionTreeLeafScore): boolean {
  const highWeightThreshold =
    decisionTree.global_stopping_rule.minimum_specificity.high_weight_threshold;
  const minimumHighWeight =
    decisionTree.global_stopping_rule.minimum_specificity
      .minimum_high_weight_or_branch_defining_features;
  const leafConfig = decisionTree.leaf_nodes.find((item) => item.node_id === leaf.nodeId);

  if (!leafConfig) return false;

  const highWeightMatched = leaf.matchedFeatures.filter(
    (feature) => (leafConfig.weighted_features[feature] ?? 0) >= highWeightThreshold,
  );

  return highWeightMatched.length >= minimumHighWeight;
}

function humanizeFeatures(features: string[]): string[] {
  return features.map((feature) => featureLabels[feature] ?? feature.replaceAll("_", " "));
}

export function selectTargetedQuestion({
  observedFeatures,
  topLeaf,
}: {
  observedFeatures: Set<string>;
  topLeaf: DecisionTreeLeafScore | null;
}): { question: string | null; why: string | null } {
  for (const rule of decisionTree.overlap_and_disambiguation_rules) {
    const hasPresentFeatures = rule.when_features_present.every((feature) =>
      observedFeatures.has(feature),
    );
    const hasMissingDiscriminator = rule.when_features_missing_any.some(
      (feature) => !observedFeatures.has(feature),
    );

    if (hasPresentFeatures && hasMissingDiscriminator) {
      return { question: rule.ask, why: rule.why };
    }
  }

  const fallbackQuestion = topLeaf?.suggestedQuestions[0] ?? null;

  return {
    question:
      fallbackQuestion ??
      "Can you describe where the pain is, how long it has been going on, and whether you have symptoms like vomiting, diarrhea, fever, urinary symptoms, or bleeding?",
    why:
      topLeaf === null
        ? "These details are the broadest high-yield discriminators for abdominal pain."
        : "This helps separate the leading possibilities based on the information shared so far.",
  };
}

function getCompetingLeaves(
  sortedScores: DecisionTreeLeafScore[],
  topLeaf: DecisionTreeLeafScore | null,
): DecisionTreeLeafScore[] {
  if (!topLeaf) return [];

  const ambiguityRule = decisionTree.global_stopping_rule.ambiguity;

  return sortedScores.filter(
    (leaf) =>
      leaf.nodeId !== topLeaf.nodeId &&
      leaf.score > 0 &&
      topLeaf.score - leaf.score <= ambiguityRule.within_top_score,
  );
}

function buildUncertaintyStatement({
  shouldStop,
  ambiguityDetected,
}: {
  shouldStop: boolean;
  ambiguityDetected: boolean;
}): string {
  if (shouldStop) {
    return "This recommendation is based only on the symptoms shared so far and is not a certain diagnosis.";
  }

  if (ambiguityDetected) {
    return "Several possibilities still overlap based on the information shared so far.";
  }

  return "More information is needed before giving a triage recommendation.";
}

export function evaluateDecisionTree({
  message,
  memory,
  monitorResult,
}: {
  message: string;
  memory: ParticipantMemory;
  monitorResult: DisclosureCoverageMonitorResult;
}): DecisionTreeEvaluationResult {
  const observedFeatures = normalizeDecisionFeatures({ message, memory, monitorResult });
  const observedFeatureSet = new Set(observedFeatures);
  const emergencyNodeIds = new Set(
    decisionTree.global_stopping_rule.emergency_override
      .stop_immediately_if_any_node_matches,
  );
  const leafScores = decisionTree.leaf_nodes
    .map((leaf) =>
      scoreDecisionLeaf({
        leaf,
        observedFeatures: observedFeatureSet,
        emergencyNodeIds,
      }),
    )
    .sort((a, b) => b.score - a.score || b.matchedWeight - a.matchedWeight);

  const emergencyLeaf = leafScores.find((leaf) => leaf.emergencyOverrideMatched) ?? null;

  if (emergencyLeaf) {
    return {
      observedFeatures,
      shouldStop: true,
      decision: "give_triage_recommendation",
      triageLevel: emergencyLeaf.triageLevel,
      probableConditionOrDifferential: emergencyLeaf.sourceDiagnoses,
      topLeaf: emergencyLeaf,
      competingLeaves: [],
      ambiguityDetected: false,
      reasoningFeatures: humanizeFeatures(emergencyLeaf.matchedFeatures),
      missingInformation: humanizeFeatures(emergencyLeaf.missingFeatures),
      askOneTargetedQuestion: null,
      whyThisQuestionIsHighYield: null,
      uncertaintyStatement: buildUncertaintyStatement({
        shouldStop: true,
        ambiguityDetected: false,
      }),
    };
  }

  const topScoredLeaf = leafScores[0] ?? null;
  const topLeaf =
    topScoredLeaf !== null && topScoredLeaf.score > 0 ? topScoredLeaf : null;
  const competingLeaves = getCompetingLeaves(leafScores, topLeaf);
  const ambiguityRule = decisionTree.global_stopping_rule.ambiguity;
  const ambiguityDetected =
    topLeaf !== null &&
    competingLeaves.length > 0 &&
    topLeaf.score < ambiguityRule.top_score_below;
  const threshold = decisionTree.global_stopping_rule.score_threshold.primary_threshold;
  const shouldStop =
    topLeaf !== null &&
    !ambiguityDetected &&
    topLeaf.score >= threshold &&
    (topLeaf.strongPatternMatched || hasMinimumSpecificity(topLeaf));
  const targetedQuestion = shouldStop
    ? { question: null, why: null }
    : selectTargetedQuestion({ observedFeatures: observedFeatureSet, topLeaf });
  const candidateLeaves = [topLeaf, ...competingLeaves].filter(
    (leaf): leaf is DecisionTreeLeafScore => leaf !== null,
  );

  return {
    observedFeatures,
    shouldStop,
    decision: shouldStop
      ? "give_triage_recommendation"
      : "continue_information_seeking",
    triageLevel: shouldStop ? topLeaf.triageLevel : null,
    probableConditionOrDifferential:
      candidateLeaves.length > 0
        ? [...new Set(candidateLeaves.flatMap((leaf) => leaf.sourceDiagnoses))].slice(0, 4)
        : [],
    topLeaf,
    competingLeaves,
    ambiguityDetected,
    reasoningFeatures: humanizeFeatures(topLeaf?.matchedFeatures ?? observedFeatures),
    missingInformation: humanizeFeatures(topLeaf?.missingFeatures ?? []),
    askOneTargetedQuestion: targetedQuestion.question,
    whyThisQuestionIsHighYield: targetedQuestion.why,
    uncertaintyStatement: buildUncertaintyStatement({ shouldStop, ambiguityDetected }),
  };
}
