import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type {
  DecisionControllerResult,
  ExtractedSymptom,
  LeafFeatureMatch,
  LeafMatchingAgentResult,
  LeafScore,
  ParticipantMemory
} from "../types/experiment";

const defaultMetricsPath = resolve(process.cwd(), "logs", "self_triage_turn_metrics.jsonl");
const defaultConversationOutputDir = resolve(process.cwd(), "logs", "self_triage_conversation_outputs");

function roundMetric(value: number | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(4));
}

function serializeFeatureMatch(feature: LeafFeatureMatch) {
  return {
    featureKey: feature.featureKey,
    matched: feature.matched,
    status: feature.status,
    matchConfidence: roundMetric(feature.matchConfidence),
    detailCompletion: roundMetric(feature.detailCompletion),
    matchedDetails: feature.matchedDetails ?? [],
    missingDetails: feature.missingDetails ?? [],
    evidenceText: feature.evidenceText,
    explanation: feature.explanation
  };
}

function serializeLeafScore(leaf: LeafScore) {
  return {
    nodeId: leaf.nodeId,
    diagnosisGroup: leaf.diagnosisGroup,
    triageLevel: leaf.triageLevel,
    score: roundMetric(leaf.score),
    rawScore: roundMetric(leaf.rawScore),
    posteriorProbability: roundMetric(leaf.posteriorProbability ?? leaf.score),
    positiveEvidence: roundMetric(leaf.positiveEvidence),
    negativeEvidence: roundMetric(leaf.negativeEvidence),
    totalPossibleImportance: roundMetric(leaf.totalPossibleImportance),
    specificityScore: roundMetric(leaf.specificityScore),
    excluded: Boolean(leaf.excluded),
    exclusionReason: leaf.exclusionReason ?? null,
    matchedFeatures: leaf.matchedFeatures
      .filter((feature) => feature.status !== "not_mentioned")
      .map(serializeFeatureMatch),
    missingKeyFeatures: leaf.missingKeyFeatures,
    negativeOrContradictingFeatures: leaf.negativeOrContradictingFeatures,
    reasoningSummary: leaf.reasoningSummary
  };
}

function serializeSymptom(symptom: ExtractedSymptom) {
  return {
    symptomId: symptom.symptomId,
    label: symptom.label,
    status: symptom.status,
    value: symptom.value,
    bodyLocation: symptom.bodyLocation ?? null,
    severity: symptom.severity ?? null,
    duration: symptom.duration ?? null,
    evidenceText: symptom.evidenceText,
    normalizedAliases: symptom.normalizedAliases
  };
}

function topMargin(leaves: LeafScore[]): number | null {
  const [first, second] = leaves;

  if (!first || !second) {
    return null;
  }

  const firstPosterior = first.posteriorProbability ?? first.score;
  const secondPosterior = second.posteriorProbability ?? second.score;

  return roundMetric(firstPosterior - secondPosterior);
}

function buildTurnMetrics({
  message,
  memory,
  matchingResult,
  decisionResult,
  response
}: {
  message: string;
  memory: ParticipantMemory;
  matchingResult: LeafMatchingAgentResult;
  decisionResult: DecisionControllerResult;
  response: string;
}) {
  return {
    timestamp: new Date().toISOString(),
    participantId: memory.participantId,
    caseId: memory.caseId,
    condition: memory.condition,
    sessionId: memory.sessionId ?? null,
    turnIndex: memory.turnCount + 1,
    participantMessage: message,
    assistantResponse: response,
    extractedSymptoms: memory.disclosedSymptoms.symptoms.map(serializeSymptom),
    scoringSummary: {
      temperature: roundMetric(matchingResult.scoringSummary?.temperature),
      entropy: roundMetric(matchingResult.scoringSummary?.entropy),
      normalizedEntropy: roundMetric(matchingResult.scoringSummary?.normalizedEntropy),
      decisionEntropy: roundMetric(decisionResult.followUpLogic?.entropy),
      decisionNormalizedEntropy: roundMetric(decisionResult.followUpLogic?.normalizedEntropy),
      topPosteriorMargin: topMargin(matchingResult.topLeaves)
    },
    decision: {
      shouldStop: decisionResult.shouldStop,
      decision: decisionResult.decision,
      selectedTriageLevel: decisionResult.selectedTriageLevel,
      likelyLeaves: decisionResult.likelyLeaves.map((leaf) => leaf.nodeId),
      candidateLeaves: decisionResult.candidateLeaves.map((leaf) => leaf.nodeId),
      missingInformationToAsk: decisionResult.missingInformationToAsk,
      suggestedQuestionFocus: decisionResult.suggestedQuestionFocus,
      reasoningFeatures: decisionResult.reasoningFeatures,
      uncertaintyStatement: decisionResult.uncertaintyStatement,
      patientFacingInstruction: decisionResult.patientFacingInstruction,
      followUpLogic: decisionResult.followUpLogic
        ? {
            ruleUsed: decisionResult.followUpLogic.ruleUsed,
            entropy: roundMetric(decisionResult.followUpLogic.entropy),
            normalizedEntropy: roundMetric(decisionResult.followUpLogic.normalizedEntropy),
            candidateFeatures: decisionResult.followUpLogic.candidateFeatures.map((feature) => ({
              ...feature,
              questionValue: roundMetric(feature.questionValue),
              posteriorProbability: roundMetric(feature.posteriorProbability),
              importanceScore: roundMetric(feature.importanceScore),
              uniquenessScore: roundMetric(feature.uniquenessScore),
              missingCompleteness: roundMetric(feature.missingCompleteness)
            }))
          }
        : null
    },
    topLeaves: matchingResult.topLeaves.map(serializeLeafScore),
    allLeafScores: matchingResult.leafScores.map(serializeLeafScore)
  };
}

function safeFileSegment(value: string | null | undefined): string {
  return (value || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "unknown";
}

function conversationOutputPath(metrics: ReturnType<typeof buildTurnMetrics>): string {
  const outputDir = process.env.SELF_TRIAGE_CONVERSATION_OUTPUT_DIR?.trim() || defaultConversationOutputDir;
  const filename = [
    safeFileSegment(metrics.participantId),
    safeFileSegment(metrics.caseId),
    safeFileSegment(metrics.sessionId)
  ].join("__");

  return resolve(outputDir, `${filename}.json`);
}

async function readExistingConversationOutput(path: string): Promise<unknown | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function buildConversationRound(metrics: ReturnType<typeof buildTurnMetrics>) {
  const rankedLeaves = metrics.topLeaves.map((leaf) => ({
    disease: leaf.diagnosisGroup,
    nodeId: leaf.nodeId,
    triage: leaf.triageLevel,
    score: leaf.score,
    posterior: leaf.posteriorProbability,
    positiveEvidence: leaf.positiveEvidence,
    negativeEvidence: leaf.negativeEvidence,
    specificityScore: leaf.specificityScore
  }));

  return {
    round: metrics.turnIndex,
    participant: metrics.participantMessage,
    assistant: metrics.assistantResponse,
    should_stop: metrics.decision.shouldStop,
    top_leaf: rankedLeaves[0] ?? null,
    second_leaf: rankedLeaves[1] ?? null,
    third_leaf: rankedLeaves[2] ?? null,
    ranked_leaves: rankedLeaves,
    other_indicators: {
      entropy: metrics.scoringSummary.entropy,
      normalized_entropy: metrics.scoringSummary.normalizedEntropy,
      decision_entropy: metrics.scoringSummary.decisionEntropy,
      decision_normalized_entropy: metrics.scoringSummary.decisionNormalizedEntropy,
      top_posterior_margin: metrics.scoringSummary.topPosteriorMargin,
      decision: metrics.decision.decision,
      selected_triage_level: metrics.decision.selectedTriageLevel,
      suggested_question_focus: metrics.decision.suggestedQuestionFocus,
      follow_up_rule: metrics.decision.followUpLogic?.ruleUsed ?? null,
      missing_information_to_ask: metrics.decision.missingInformationToAsk,
      reasoning_features: metrics.decision.reasoningFeatures
    }
  };
}

function isConversationOutput(value: unknown): value is {
  conversation?: Array<{ round?: unknown }>;
  stopped?: boolean;
  stop_round?: number | null;
  final_condition?: string | null;
  final_triage?: string | null;
} {
  return typeof value === "object" && value !== null;
}

async function saveConversationOutput(metrics: ReturnType<typeof buildTurnMetrics>): Promise<string> {
  const path = conversationOutputPath(metrics);
  const existing = await readExistingConversationOutput(path);
  const previousConversation = isConversationOutput(existing) && Array.isArray(existing.conversation)
    ? existing.conversation
    : [];
  const currentRound = buildConversationRound(metrics);
  const conversation = [
    ...previousConversation.filter((round) => round.round !== metrics.turnIndex),
    currentRound
  ].sort((left, right) => Number(left.round ?? 0) - Number(right.round ?? 0));
  const topLeaf = metrics.topLeaves[0] ?? null;
  const stopped = metrics.decision.shouldStop || Boolean(isConversationOutput(existing) && existing.stopped);
  const stopRound = metrics.decision.shouldStop
    ? metrics.turnIndex
    : isConversationOutput(existing)
      ? existing.stop_round ?? null
      : null;

  const output = {
    case_id: metrics.caseId,
    participant_id: metrics.participantId,
    session_id: metrics.sessionId,
    condition: metrics.condition,
    stopped,
    stop_round: stopRound,
    final_condition: metrics.decision.shouldStop
      ? topLeaf?.diagnosisGroup ?? null
      : isConversationOutput(existing)
        ? existing.final_condition ?? null
        : null,
    final_triage: metrics.decision.shouldStop
      ? metrics.decision.selectedTriageLevel ?? topLeaf?.triageLevel ?? null
      : isConversationOutput(existing)
        ? existing.final_triage ?? null
        : null,
    conversation
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return path;
}

export async function saveAndPrintTurnMetrics(input: {
  message: string;
  memory: ParticipantMemory;
  matchingResult: LeafMatchingAgentResult;
  decisionResult: DecisionControllerResult;
  response: string;
}): Promise<void> {
  const metrics = buildTurnMetrics(input);
  const metricsPath = process.env.SELF_TRIAGE_METRICS_PATH?.trim() || defaultMetricsPath;

  console.info("self_triage_turn_metrics", {
    metricsPath,
    participantId: metrics.participantId,
    caseId: metrics.caseId,
    condition: metrics.condition,
    sessionId: metrics.sessionId,
    turnIndex: metrics.turnIndex,
    shouldStop: metrics.decision.shouldStop,
    decision: metrics.decision.decision,
    selectedTriageLevel: metrics.decision.selectedTriageLevel,
    scoringSummary: metrics.scoringSummary,
    suggestedQuestionFocus: metrics.decision.suggestedQuestionFocus,
    topLeaves: metrics.topLeaves.map((leaf) => ({
      nodeId: leaf.nodeId,
      diagnosisGroup: leaf.diagnosisGroup,
      triageLevel: leaf.triageLevel,
      score: leaf.score,
      posteriorProbability: leaf.posteriorProbability,
      positiveEvidence: leaf.positiveEvidence,
      negativeEvidence: leaf.negativeEvidence,
      specificityScore: leaf.specificityScore
    }))
  });

  try {
    await mkdir(dirname(metricsPath), { recursive: true });
    await appendFile(metricsPath, `${JSON.stringify(metrics)}\n`, "utf8");
    const conversationPath = await saveConversationOutput(metrics);
    console.info("self_triage_conversation_output", {
      conversationPath,
      caseId: metrics.caseId,
      sessionId: metrics.sessionId,
      turnIndex: metrics.turnIndex,
      stopped: metrics.decision.shouldStop,
      finalCondition: metrics.decision.shouldStop ? metrics.topLeaves[0]?.diagnosisGroup ?? null : null,
      finalTriage: metrics.decision.shouldStop ? metrics.decision.selectedTriageLevel : null
    });
  } catch (error) {
    console.warn("Unable to save self-triage turn metrics", {
      metricsPath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
