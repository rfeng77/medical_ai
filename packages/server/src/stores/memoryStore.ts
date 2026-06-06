import type { Condition, ParticipantMemory } from "../types/experiment";

const memoryByParticipantCase = new Map<string, ParticipantMemory>();

export function getMemoryKey(participantId: string, caseId: string): string {
  return `${participantId}:${caseId}`;
}

export function getMemory(participantId: string, caseId: string): ParticipantMemory | undefined {
  return memoryByParticipantCase.get(getMemoryKey(participantId, caseId));
}

export function saveMemory(memory: ParticipantMemory): ParticipantMemory {
  memoryByParticipantCase.set(getMemoryKey(memory.participantId, memory.caseId), memory);
  return memory;
}

export function createMemory(
  participantId: string,
  caseId: string,
  condition: Condition
): ParticipantMemory {
  const memory: ParticipantMemory = {
    participantId,
    caseId,
    condition,
    aiVisibleFields: {},
    fieldEvidence: {},
    chatHistory: [],
    turnCount: 0,
    latestCoverageRatio: 0,
    latestUncertaintyLevel: "high",
    latestMissingInformationCategories: [],
    latestShouldSuggestMoreSearch: true
  };

  return saveMemory(memory);
}
