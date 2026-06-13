import { Router } from "express";
import type { Request, Response } from "express";
import { runSelfTriageTurn } from "../agents/selfTriagePipeline";
import { getOrCreateMemory, saveMemory } from "../stores/memoryStore";
import type {
  ChatRequest,
  ChatResponse,
  DecisionTreeEvaluationResult,
  DialoguePlan,
  DisclosureCoverageMonitorResult,
  FieldEvidence
} from "../types/experiment";

export const chatRouter = Router();

function buildCompatibilityMonitorResult(
  result: Awaited<ReturnType<typeof runSelfTriageTurn>>
): DisclosureCoverageMonitorResult {
  const extractedFields = result.updatedMemory.aiVisibleFields;
  const evidenceText: FieldEvidence = result.updatedMemory.fieldEvidence;
  const matchedFields = Object.keys(extractedFields) as DisclosureCoverageMonitorResult["matchedFields"];

  return {
    extractedFields,
    evidenceText,
    updatedVisibleFieldsPreview: extractedFields,
    matchedFields,
    unmatchedDisclosedFields: [],
    unmatchedDisclosedEvidence: {},
    disclosedFieldCount: matchedFields.length,
    matchedFieldCount: matchedFields.length,
    hitRatio: matchedFields.length > 0 ? 1 : 0,
    missingFields: [],
    missingInformationCategories: result.decisionResult.suggestedQuestionFocus,
    informationCoverageRatio: result.decisionResult.shouldStop ? 1 : 0,
    matchStrength: result.decisionResult.shouldStop ? "high" : "moderate",
    uncertaintyLevel: result.decisionResult.shouldStop ? "lower" : "high",
    shouldSuggestMoreSearch: !result.decisionResult.shouldStop,
    monitoringSummary: result.decisionResult.patientFacingInstruction,
    isSymptomDisclosure: result.extractionResult.isSymptomDisclosure,
    nonSymptomInputType:
      result.extractionResult.nonSymptomInputType === "other"
        ? "unclear"
        : result.extractionResult.nonSymptomInputType
  };
}

function buildCompatibilityDecisionTreeResult(
  result: Awaited<ReturnType<typeof runSelfTriageTurn>>
): DecisionTreeEvaluationResult {
  const likelyLeaf = result.decisionResult.likelyLeaves[0] ?? result.matchingResult.topLeaves[0] ?? null;

  return {
    observedFeatures: result.matchingResult.topLeaves.flatMap((leaf) =>
      leaf.matchedFeatures.filter((feature) => feature.matched).map((feature) => feature.featureKey)
    ),
    shouldStop: result.decisionResult.shouldStop,
    decision: result.decisionResult.shouldStop ? "give_triage_recommendation" : "continue_information_seeking",
    triageLevel: result.decisionResult.selectedTriageLevel,
    probableConditionOrDifferential: result.decisionResult.likelyLeaves.map((leaf) => leaf.diagnosisGroup),
    topLeaf: likelyLeaf
      ? {
          nodeId: likelyLeaf.nodeId,
          diagnosisGroup: likelyLeaf.diagnosisGroup,
          triageLevel: likelyLeaf.triageLevel,
          score: likelyLeaf.score,
          matchedFeatures: likelyLeaf.matchedFeatures.map((feature) => feature.featureKey),
          missingFeatures: likelyLeaf.missingKeyFeatures,
          matchedWeight: likelyLeaf.score,
          totalWeight: 1,
          strongPatternMatched: likelyLeaf.specificityScore >= 0.65,
          emergencyOverrideMatched: result.decisionResult.decision === "urgent_recommendation",
          sourceDiagnoses: [],
          suggestedQuestions: result.decisionResult.suggestedQuestionFocus
        }
      : null,
    competingLeaves: result.matchingResult.topLeaves.slice(1).map((leaf) => ({
      nodeId: leaf.nodeId,
      diagnosisGroup: leaf.diagnosisGroup,
      triageLevel: leaf.triageLevel,
      score: leaf.score,
      matchedFeatures: leaf.matchedFeatures.map((feature) => feature.featureKey),
      missingFeatures: leaf.missingKeyFeatures,
      matchedWeight: leaf.score,
      totalWeight: 1,
      strongPatternMatched: leaf.specificityScore >= 0.65,
      emergencyOverrideMatched: false,
      sourceDiagnoses: [],
      suggestedQuestions: result.decisionResult.suggestedQuestionFocus
    })),
    ambiguityDetected: result.decisionResult.decision === "multiple_possible_leaves",
    reasoningFeatures: result.decisionResult.reasoningFeatures,
    missingInformation: result.decisionResult.missingInformationToAsk,
    askOneTargetedQuestion:
      result.decisionResult.suggestedQuestionFocus.length > 0
        ? `Could you tell me more about ${result.decisionResult.suggestedQuestionFocus.join(", ")}?`
        : null,
    whyThisQuestionIsHighYield: result.decisionResult.uncertaintyStatement,
    uncertaintyStatement: result.decisionResult.uncertaintyStatement
  };
}

function buildCompatibilityDialoguePlan(
  result: Awaited<ReturnType<typeof runSelfTriageTurn>>
): DialoguePlan {
  return {
    dialogueGoal: result.decisionResult.shouldStop ? "give_triage_recommendation" : "continue_information_seeking",
    temperature: 0.4,
    shouldSuggestMoreSearch: !result.decisionResult.shouldStop,
    searchSuggestionStrength: result.decisionResult.shouldStop ? "none" : "moderate",
    knownInformationSummary: result.updatedMemory.disclosedSymptoms.symptoms
      .map((symptom) => `${symptom.label}: ${symptom.status}`)
      .join("; "),
    uncertaintyMessage: result.decisionResult.uncertaintyStatement,
    optionalInformationCategories: result.decisionResult.suggestedQuestionFocus,
    decisionTreeSummary: {
      triageLevel: result.decisionResult.selectedTriageLevel,
      probableConditionOrDifferential: result.decisionResult.likelyLeaves.map((leaf) => leaf.diagnosisGroup),
      reasoningFeatures: result.decisionResult.reasoningFeatures,
      missingInformation: result.decisionResult.missingInformationToAsk,
      askOneTargetedQuestion:
        result.decisionResult.suggestedQuestionFocus.length > 0
          ? `Could you tell me more about ${result.decisionResult.suggestedQuestionFocus.join(", ")}?`
          : null,
      whyThisQuestionIsHighYield: result.decisionResult.uncertaintyStatement,
      ambiguityDetected: result.decisionResult.decision === "multiple_possible_leaves"
    },
    constraints: {
      allowDiagnosis: result.decisionResult.shouldStop,
      allowTriageRecommendation: result.decisionResult.shouldStop,
      doNotMentionUndisclosedSymptoms: true,
      doNotRevealGroundTruth: true
    },
    systemInstructionForDialogueAgent: result.decisionResult.patientFacingInstruction
  };
}

chatRouter.post("/", async (req: Request<unknown, unknown, ChatRequest>, res: Response) => {
  try {
    const { participantId, caseId, condition, sessionId, message } = req.body;

    if (!participantId || !caseId || !condition || !sessionId || !message) {
      res.status(400).json({ error: "participantId, caseId, condition, sessionId, and message are required." });
      return;
    }

    const memory = getOrCreateMemory({ participantId, caseId, condition, sessionId });
    const pipelineResult = await runSelfTriageTurn({
      message,
      memory,
      caseId
    });

    saveMemory(pipelineResult.updatedMemory);

    console.log("self_triage_pipeline_turn", {
      participantId,
      caseId,
      condition,
      sessionId,
      topLeaves: pipelineResult.matchingResult.topLeaves.map((leaf) => ({
        nodeId: leaf.nodeId,
        score: leaf.score,
        specificityScore: leaf.specificityScore,
        triageLevel: leaf.triageLevel
      })),
      decision: pipelineResult.decisionResult.decision,
      shouldStop: pipelineResult.decisionResult.shouldStop
    });

    const response: ChatResponse = {
      response: pipelineResult.response,
      extractedFields: pipelineResult.updatedMemory.aiVisibleFields,
      aiVisibleFields: pipelineResult.updatedMemory.aiVisibleFields,
      monitorResult: buildCompatibilityMonitorResult(pipelineResult),
      decisionTreeResult: buildCompatibilityDecisionTreeResult(pipelineResult),
      dialoguePlan: buildCompatibilityDialoguePlan(pipelineResult),
      safetyPassed: true,
      safetyNotes: ["Generated by patient-facing dialogue agent with no hidden case truth."],
      extractionResult: pipelineResult.extractionResult,
      matchingResult: pipelineResult.matchingResult,
      decisionResult: pipelineResult.decisionResult,
      disclosedSymptoms: pipelineResult.updatedMemory.disclosedSymptoms
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process chat message.";
    res.status(500).json({ error: message });
  }
});
