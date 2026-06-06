import type {
  Condition,
  DisclosureCoverageMonitorResult,
  ParticipantMemory
} from "../types/experiment";
import { createMemory, getMemory, saveMemory } from "../stores/memoryStore";
import { logExperimentEvent } from "./LoggingAgent";

export function getOrCreateMemory(
  participantId: string,
  caseId: string,
  condition: Condition
): ParticipantMemory {
  return getMemory(participantId, caseId) ?? createMemory(participantId, caseId, condition);
}

export function updateMemoryWithMonitorResult(
  memory: ParticipantMemory,
  message: string,
  monitorResult: DisclosureCoverageMonitorResult
): ParticipantMemory {
  memory.chatHistory.push({
    role: "participant",
    text: message,
    timestamp: new Date().toISOString()
  });
  memory.turnCount += 1;

  for (const [field, value] of Object.entries(monitorResult.extractedFields)) {
    memory.aiVisibleFields[field as keyof typeof memory.aiVisibleFields] = value;
  }

  for (const [field, evidenceItems] of Object.entries(monitorResult.evidenceText)) {
    const typedField = field as keyof typeof memory.fieldEvidence;
    memory.fieldEvidence[typedField] = [...(memory.fieldEvidence[typedField] ?? []), ...evidenceItems];
  }

  memory.latestCoverageRatio = monitorResult.informationCoverageRatio;
  memory.latestUncertaintyLevel = monitorResult.uncertaintyLevel;
  memory.latestMissingInformationCategories = monitorResult.missingInformationCategories;
  memory.latestShouldSuggestMoreSearch = monitorResult.shouldSuggestMoreSearch;

  saveMemory(memory);

  logExperimentEvent({
    participantId: memory.participantId,
    caseId: memory.caseId,
    condition: memory.condition,
    eventType: "participant_message",
    payload: {
      message,
      turnCount: memory.turnCount
    }
  });

  logExperimentEvent({
    participantId: memory.participantId,
    caseId: memory.caseId,
    condition: memory.condition,
    eventType: "memory_update",
    payload: {
      aiVisibleFields: memory.aiVisibleFields,
      fieldEvidence: memory.fieldEvidence,
      turnCount: memory.turnCount,
      latestCoverageRatio: memory.latestCoverageRatio,
      latestUncertaintyLevel: memory.latestUncertaintyLevel,
      latestMissingInformationCategories: memory.latestMissingInformationCategories,
      latestShouldSuggestMoreSearch: memory.latestShouldSuggestMoreSearch
    }
  });

  return memory;
}

export function addAssistantMessage(memory: ParticipantMemory, response: string): ParticipantMemory {
  memory.chatHistory.push({
    role: "assistant",
    text: response,
    timestamp: new Date().toISOString()
  });

  saveMemory(memory);
  return memory;
}
