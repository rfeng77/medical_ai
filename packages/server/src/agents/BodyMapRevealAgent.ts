// Shows participant-facing body-map clues without adding them to AI-visible memory.
import casesData from "../data/simulatedAbdominalPainCases.json";
import type { ClinicalField, RevealRequest, RevealResponse } from "../types/experiment";
import { logExperimentEvent } from "./LoggingAgent";

type SimulatedCase = {
  caseId: string;
  bodyMapClues: Record<
    string,
    {
      field: ClinicalField;
      participantFacingText: string;
    }
  >;
};

export class RevealError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RevealError";
    this.statusCode = statusCode;
  }
}

export function revealBodyMapClue({
  participantId,
  caseId,
  condition,
  regionKey
}: RevealRequest): RevealResponse {
  const simulatedCase = (casesData.cases as unknown as SimulatedCase[]).find(
    (caseItem) => caseItem.caseId === caseId
  );

  if (!simulatedCase) {
    throw new RevealError("Case not found.", 404);
  }

  const clue = simulatedCase.bodyMapClues[regionKey];

  if (!clue) {
    throw new RevealError("No participant-facing clue exists for that body-map region.", 404);
  }

  const response: RevealResponse = {
    shownToParticipant: true,
    sentToAI: false,
    caseId,
    regionKey,
    field: clue.field,
    participantFacingText: clue.participantFacingText
  };

  logExperimentEvent({
    participantId,
    caseId,
    condition,
    eventType: "body_region_click",
    payload: {
      regionKey,
      field: clue.field,
      shownToParticipant: true,
      sentToAI: false
    }
  });

  return response;
}
