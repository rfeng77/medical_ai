import { Router } from "express";
import type { Request, Response } from "express";
import { monitorDisclosureAndCoverage } from "../agents/DisclosureAndCoverageMonitorAgent";
import { createDialoguePlan } from "../agents/ConversationPromptPlannerAgent";
import { generateConstrainedDialogue } from "../agents/ConstrainedDialogueAgent";
import { checkResponseSafety } from "../agents/SafetyGuardAgent";
import {
  addAssistantMessage,
  getOrCreateMemory,
  updateMemoryWithMonitorResult
} from "../agents/MemoryManagerAgent";
import { logExperimentEvent } from "../agents/LoggingAgent";
import type { ChatRequest, ChatResponse } from "../types/experiment";

export const chatRouter = Router();

chatRouter.post("/", async (req: Request<unknown, unknown, ChatRequest>, res: Response) => {
  try {
    const { participantId, caseId, condition, message } = req.body;

    if (!participantId || !caseId || !condition || !message) {
      res.status(400).json({ error: "participantId, caseId, condition, and message are required." });
      return;
    }

    const memory = getOrCreateMemory(participantId, caseId, condition);
    const monitorResult = await monitorDisclosureAndCoverage({
      message,
      memory,
      caseId,

    });
    logExperimentEvent({
      participantId,
      caseId,
      condition,
      eventType: "disclosure_coverage_monitor",
      payload: monitorResult
    });

    const updatedMemory = updateMemoryWithMonitorResult(memory, message, monitorResult);
    const dialoguePlan = createDialoguePlan({
      memory: updatedMemory,
      monitorResult
    });

    logExperimentEvent({
      participantId,
      caseId,
      condition,
      eventType: "conversation_prompt_plan",
      payload: dialoguePlan
    });

    const candidateResponse = await generateConstrainedDialogue({
      message,
      memory: updatedMemory,
      monitorResult,
      dialoguePlan
    });
    const safety = checkResponseSafety({
      candidateResponse,
      memory: updatedMemory,
      allowDiagnosis: dialoguePlan.constraints.allowDiagnosis,
      allowTriageRecommendation: dialoguePlan.constraints.allowTriageRecommendation,
      uncertaintyLevel: monitorResult.uncertaintyLevel
    });

    logExperimentEvent({
      participantId,
      caseId,
      condition,
      eventType: "safety_check",
      payload: {
        passed: safety.passed,
        notes: safety.notes
      }
    });

    addAssistantMessage(updatedMemory, safety.finalResponse);

    logExperimentEvent({
      participantId,
      caseId,
      condition,
      eventType: "ai_response",
      payload: {
        response: safety.finalResponse,
        safetyPassed: safety.passed
      }
    });

    const response: ChatResponse = {
      response: safety.finalResponse,
      extractedFields: monitorResult.extractedFields,
      aiVisibleFields: updatedMemory.aiVisibleFields,
      monitorResult,
      dialoguePlan,
      safetyPassed: safety.passed,
      safetyNotes: safety.notes
    };

    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process chat message.";
    res.status(500).json({ error: message });
  }
});
