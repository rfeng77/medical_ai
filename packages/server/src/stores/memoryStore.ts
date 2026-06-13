import type {
  Condition,
  ParticipantMemory
} from "../types/experiment";

const memoryBySession = new Map<string, ParticipantMemory>();

export function getMemoryKey(sessionId: string): string {
  return sessionId;
}

export function getMemory(sessionId: string): ParticipantMemory | undefined {
  return memoryBySession.get(getMemoryKey(sessionId));
}

export function saveMemory(memory: ParticipantMemory): ParticipantMemory {
  if (!memory.sessionId) {
    throw new Error("Cannot save participant memory without a sessionId.");
  }

  memoryBySession.set(getMemoryKey(memory.sessionId), memory);
  return memory;
}

export function createEmptyParticipantMemory({
  participantId,
  caseId,
  condition,
  sessionId,
}: {
  participantId: string;
  caseId: string;
  condition: string;
  sessionId: string;
}): ParticipantMemory {
  return {
    participantId,
    caseId,
    condition: condition as Condition,
    sessionId,
    disclosedSymptoms: {
      symptoms: [],
      symptomMap: {}
    },
    aiVisibleFields: {},
    fieldEvidence: {},
    decisionTreeVisibleFeatures: [],
    chatHistory: [],
    turnCount: 0,
    latestCoverageRatio: 0,
    latestUncertaintyLevel: "high",
    latestMissingInformationCategories: [],
    latestShouldSuggestMoreSearch: true
  };
}

export function createMemory(
  participantId: string,
  caseId: string,
  condition: Condition,
  sessionId: string
): ParticipantMemory {
  const memory = createEmptyParticipantMemory({
    participantId,
    caseId,
    condition,
    sessionId
  });
  return saveMemory(memory);
}

export function getOrCreateMemory({
  participantId,
  caseId,
  condition,
  sessionId
}: {
  participantId: string;
  caseId: string;
  condition: Condition;
  sessionId: string;
}): ParticipantMemory {
  const existingMemory = getMemory(sessionId);

  if (
    existingMemory &&
    existingMemory.participantId === participantId &&
    existingMemory.caseId === caseId &&
    existingMemory.condition === condition
  ) {
    return existingMemory;
  }

  return createMemory(participantId, caseId, condition, sessionId);
}
