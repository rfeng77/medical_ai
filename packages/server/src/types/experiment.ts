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

export type ParticipantMemory = {
  participantId: string;
  caseId: string;
  condition: Condition;
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
};

export type RevealRequest = {
  participantId: string;
  caseId: string;
  condition: Condition;
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
  message: string;
};

export type ChatResponse = {
  response: string;
  extractedFields: DisclosedFields;
  aiVisibleFields: DisclosedFields;
  monitorResult: DisclosureCoverageMonitorResult;
  dialoguePlan: DialoguePlan;
  safetyPassed: boolean;
  safetyNotes: string[];
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
    | "support_decision_with_uncertainty";
  temperature: number;
  shouldSuggestMoreSearch: boolean;
  searchSuggestionStrength: "none" | "gentle" | "moderate";
  knownInformationSummary: string;
  uncertaintyMessage: string;
  optionalInformationCategories: string[];
  constraints: {
    allowDiagnosis: boolean;
    allowTriageRecommendation: boolean;
    doNotMentionUndisclosedSymptoms: boolean;
    doNotRevealGroundTruth: boolean;
  };
  systemInstructionForDialogueAgent: string;
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
  selectedDecision: TriageOption;
  reasoning: string;
};

export type DecisionResponse = {
  summary: string;
  groundTruthHidden: true;
};
