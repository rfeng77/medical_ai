export type Condition = "chat" | "reasoning";

export type TriageOption =
  | "Self-care"
  | "Routine GP"
  | "Urgent Primary Care"
  | "A&E"
  | "Ambulance";

export type ClinicalField =
  | "pain_location"
  | "pain_quality"
  | "pain_migration"
  | "movement_pain"
  | "duration"
  | "fever"
  | "vomiting"
  | "nausea"
  | "diarrhea"
  | "bowel_movement"
  | "bleeding"
  | "hydration"
  | "urination"
  | "pregnancy"
  | "dizziness"
  | "medication"
  | "medical_history"
  | "red_flags"
  | "other_symptoms";

export type FieldValue = string | boolean | number | null;

export type DisclosedFields = Partial<Record<ClinicalField, FieldValue>>;

export type FieldEvidence = Partial<Record<ClinicalField, string[]>>;

export type NormalizedDecisionFeature = string;

export type ExtractedSymptom = {
  symptomId: string;
  label: string;
  value: string | boolean | number | null;
  status: "present" | "absent" | "uncertain" | "not_mentioned";
  bodyLocation?: string | null;
  severity?: string | null;
  duration?: string | null;
  evidenceText: string;
  normalizedAliases: string[];
};

export type SymptomExtractionAgentResult = {
  isSymptomDisclosure: boolean;
  nonSymptomInputType: "greeting" | "question" | "other" | null;
  extractedSymptoms: ExtractedSymptom[];
  correctedMessage?: string;
  extractionNotes?: string;
};

export type DisclosedSymptomMemory = {
  symptoms: ExtractedSymptom[];
  symptomMap: Record<string, ExtractedSymptom>;
};

export type LeafFeatureMatch = {
  featureKey: string;
  matched: boolean;
  status: "present" | "absent" | "uncertain" | "not_mentioned";
  matchConfidence: number;
  evidenceText: string[];
  explanation: string;
};

export type LeafScore = {
  nodeId: string;
  diagnosisGroup: string;
  triageLevel: string;
  score: number;
  specificityScore: number;
  matchedFeatures: LeafFeatureMatch[];
  missingKeyFeatures: string[];
  negativeOrContradictingFeatures: string[];
  reasoningSummary: string;
};

export type LeafMatchingAgentResult = {
  leafScores: LeafScore[];
  topLeaves: LeafScore[];
  allCandidateConditions: string[];
  globalReasoningSummary: string;
};

export type DecisionControllerResult = {
  shouldStop: boolean;
  decision:
    | "continue_information_seeking"
    | "single_likely_leaf"
    | "multiple_possible_leaves"
    | "urgent_recommendation";
  selectedTriageLevel: string | null;
  likelyLeaves: LeafScore[];
  candidateLeaves: LeafScore[];
  reasoningFeatures: string[];
  missingInformationToAsk: string[];
  suggestedQuestionFocus: string[];
  patientFacingInstruction: string;
  uncertaintyStatement: string;
};

export type AbdominalPainDecisionTreeLeaf = {
  node_id?: string;
  nodeId?: string;
  diagnosis_group?: string;
  diagnosisGroup?: string;
  triage_level?: string;
  triageLevel?: string;
  source_diagnoses?: string[];
  sourceDiagnoses?: string[];
  weighted_features?: Record<string, number>;
  weightedFeatures?: Record<string, number>;
  keyFeatures?: string[];
  highSpecificityFeatures?: string[];
  safetyRedFlags?: string[];
  strong_positive_pattern?: Record<string, string[]>;
  strongPositivePattern?: Record<string, string[]>;
  stop_when?: string;
  recommendationText?: string;
  if_not_stop_ask?: string[];
  suggestedFollowUpQuestions?: string[];
};

export type AbdominalPainDecisionTree = {
  feature_aliases?: Record<string, string[]>;
  featureAliases?: Record<string, string[]>;
  leaf_nodes?: AbdominalPainDecisionTreeLeaf[];
  leafNodes?: AbdominalPainDecisionTreeLeaf[];
  global_stopping_rule?: unknown;
  overlap_and_disambiguation_rules?: Array<{
    ask?: string;
    why?: string;
    when_features_present?: string[];
    when_features_missing_any?: string[];
  }>;
};

export type ParticipantMemory = {
  participantId: string;
  caseId: string;
  condition: Condition;
  sessionId?: string;
  disclosedSymptoms: DisclosedSymptomMemory;
  aiVisibleFields: DisclosedFields;
  fieldEvidence: FieldEvidence;
  chatHistory: Array<{
    role: "participant" | "assistant";
    text: string;
    timestamp: string;
  }>;
  turnCount: number;
  latestCoverageRatio: number;
  latestUncertaintyLevel: "high" | "moderate" | "lower";
  latestMissingInformationCategories: string[];
  latestShouldSuggestMoreSearch: boolean;
  decisionTreeVisibleFeatures?: NormalizedDecisionFeature[];
  latestMatchingResult?: LeafMatchingAgentResult;
  latestDecisionResult?: DecisionControllerResult;
};

export type RevealRequest = {
  participantId: string;
  caseId: string;
  condition: Condition;
  sessionId?: string;
  regionKey: string;
};

export type RevealResponse = {
  shownToParticipant: true;
  sentToAI: false;
  caseId: string;
  regionKey: string;
  field: ClinicalField;
  participantFacingText: string;
};

export type ChatRequest = {
  participantId: string;
  caseId: string;
  condition: Condition;
  sessionId: string;
  message: string;
};

export type ChatResponse = {
  response: string;
  extractedFields: DisclosedFields;
  aiVisibleFields: DisclosedFields;
  monitorResult: DisclosureCoverageMonitorResult;
  decisionTreeResult: DecisionTreeEvaluationResult;
  dialoguePlan: DialoguePlan;
  safetyPassed: boolean;
  safetyNotes: string[];
  extractionResult?: SymptomExtractionAgentResult;
  matchingResult?: LeafMatchingAgentResult;
  decisionResult?: DecisionControllerResult;
  disclosedSymptoms?: DisclosedSymptomMemory;
};

export type PostTurnRatingRequest = {
  participantId: string;
  caseId: string;
  condition: Condition;
  sessionId: string;
  turnIndex: number;
  messageId?: string;
  doctorMessageId?: string;
  perceivedUrgency: number;
  perceivedRisk: number;
  confidence: number;
  timestamp?: string;
};

export type DisclosureCoverageMonitorResult = {
  extractedFields: DisclosedFields;
  evidenceText: FieldEvidence;
  updatedVisibleFieldsPreview: DisclosedFields;

  matchedFields: ClinicalField[];
  unmatchedDisclosedFields: ClinicalField[];
  unmatchedDisclosedEvidence: FieldEvidence;

  disclosedFieldCount: number;
  matchedFieldCount: number;
  hitRatio: number;

  missingFields: ClinicalField[];
  missingInformationCategories: string[];

  informationCoverageRatio: number;
  matchStrength: "low" | "moderate" | "high";
  uncertaintyLevel: "high" | "moderate" | "lower";
  shouldSuggestMoreSearch: boolean;
  monitoringSummary: string;

  isSymptomDisclosure: boolean;
  nonSymptomInputType: "greeting" | "question" | "unclear" | "irrelevant" | null;
};

export type DialoguePlan = {
  dialogueGoal:
    | "ask_for_disclosure"
    | "summarize_with_high_uncertainty"
    | "summarize_with_moderate_uncertainty"
    | "reason_with_available_information"
    | "support_decision_with_uncertainty"
    | "continue_information_seeking"
    | "give_triage_recommendation";
  temperature: number;
  shouldSuggestMoreSearch: boolean;
  searchSuggestionStrength: "none" | "gentle" | "moderate";
  knownInformationSummary: string;
  uncertaintyMessage: string;
  optionalInformationCategories: string[];
  decisionTreeSummary?: {
    triageLevel: string | null;
    probableConditionOrDifferential: string[];
    reasoningFeatures: string[];
    missingInformation: string[];
    askOneTargetedQuestion: string | null;
    whyThisQuestionIsHighYield: string | null;
    ambiguityDetected: boolean;
  };
  constraints: {
    allowDiagnosis: boolean;
    allowTriageRecommendation: boolean;
    doNotMentionUndisclosedSymptoms: boolean;
    doNotRevealGroundTruth: boolean;
  };
  systemInstructionForDialogueAgent: string;
};

export type DecisionTreeLeafScore = {
  nodeId: string;
  diagnosisGroup: string;
  triageLevel: string;
  score: number;
  matchedFeatures: NormalizedDecisionFeature[];
  missingFeatures: NormalizedDecisionFeature[];
  matchedWeight: number;
  totalWeight: number;
  strongPatternMatched: boolean;
  emergencyOverrideMatched: boolean;
  sourceDiagnoses: string[];
  suggestedQuestions: string[];
};

export type DecisionTreeEvaluationResult = {
  observedFeatures: NormalizedDecisionFeature[];
  shouldStop: boolean;
  decision: "continue_information_seeking" | "give_triage_recommendation";
  triageLevel: string | null;
  probableConditionOrDifferential: string[];
  topLeaf: DecisionTreeLeafScore | null;
  competingLeaves: DecisionTreeLeafScore[];
  ambiguityDetected: boolean;
  reasoningFeatures: string[];
  missingInformation: string[];
  askOneTargetedQuestion: string | null;
  whyThisQuestionIsHighYield: string | null;
  uncertaintyStatement: string;
};

export type CoverageResult = {
  coverageScore: number;
  matchedFields: ClinicalField[];
  missingFields: ClinicalField[];
  missingHighValueCategories: string[];
  readyForDecision: boolean;
};

export type UncertaintyResult = {
  uncertaintyLevel: "high" | "moderate" | "lower";
  canProceedToDecision: boolean;
  message: string;
  optionalInformationCategories: string[];
};

export type DecisionRequest = {
  participantId: string;
  caseId: string;
  condition: Condition;
  sessionId: string;
  selectedDecision: TriageOption;
  reasoning: string;
};

export type DecisionResponse = {
  summary: string;
  groundTruthHidden: true;
};
