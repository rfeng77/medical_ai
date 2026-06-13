import { Router } from "express";
import type { Request, Response } from "express";
import { getOrCreateMemory } from "../stores/memoryStore";
import type { ClinicalField, DecisionRequest } from "../types/experiment";

export const decisionRouter = Router();

const fieldLabels: Record<ClinicalField, string> = {
  pain_location: "pain location",
  pain_quality: "pain quality",
  pain_migration: "pain movement over time",
  movement_pain: "movement-related pain",
  duration: "duration",
  fever: "fever-like symptoms",
  vomiting: "nausea or vomiting",
  nausea: "nausea",
  diarrhea: "diarrhea",
  bowel_movement: "bowel movement changes",
  bleeding: "bleeding or stool color",
  hydration: "hydration",
  urination: "urination",
  pregnancy: "pregnancy relevance",
  dizziness: "dizziness or fainting",
  medication: "medication use",
  medical_history: "medical history",
  red_flags: "severe or rapidly worsening symptoms",
  other_symptoms: "other disclosed symptoms"
};

function joinWithAnd(items: string[]): string {
  if (items.length === 0) {
    return "no disclosed fields";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

decisionRouter.post("/", (req: Request<unknown, unknown, DecisionRequest>, res: Response) => {
  try {
    const { participantId, caseId, condition, sessionId, selectedDecision, reasoning } = req.body;

    if (!participantId || !caseId || !condition || !sessionId || !selectedDecision || !reasoning) {
      res.status(400).json({
        error: "participantId, caseId, condition, sessionId, selectedDecision, and reasoning are required."
      });
      return;
    }

    const memory = getOrCreateMemory({ participantId, caseId, condition, sessionId });
    const disclosedFields = Object.keys(memory.aiVisibleFields).map(
      (field) => fieldLabels[field as ClinicalField] ?? field
    );
    const response = {
      summary: `You selected ${selectedDecision}. This decision was made with ${
        memory.latestUncertaintyLevel
      } uncertainty based on the information you disclosed: ${joinWithAnd(
        disclosedFields
      )}. Your reasoning was: ${reasoning}`,
      groundTruthHidden: true
    };

    console.log("triage_decision", {
      participantId,
      caseId,
      condition,
      sessionId,
      selectedDecision,
      reasoning,
      disclosedFields: memory.aiVisibleFields,
      latestDecisionResult: memory.latestDecisionResult,
      groundTruthHidden: true
    });

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process decision.";
    res.status(500).json({ error: message });
  }
});
