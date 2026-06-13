import { Router } from "express";
import type { Request, Response } from "express";
import casesData from "../data/simulatedAbdominalPainCases.json";
import type { ClinicalField, RevealRequest, RevealResponse } from "../types/experiment";

export const revealRouter = Router();

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

class RevealRouteError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "RevealRouteError";
    this.statusCode = statusCode;
  }
}

function revealBodyMapClue({ caseId, regionKey }: RevealRequest): RevealResponse {
  const simulatedCase = (casesData.cases as unknown as SimulatedCase[]).find(
    (caseItem) => caseItem.caseId === caseId
  );

  if (!simulatedCase) {
    throw new RevealRouteError("Case not found.", 404);
  }

  const clue = simulatedCase.bodyMapClues[regionKey];

  if (!clue) {
    throw new RevealRouteError("No participant-facing clue exists for that body-map region.", 404);
  }

  return {
    shownToParticipant: true,
    sentToAI: false,
    caseId,
    regionKey,
    field: clue.field,
    participantFacingText: clue.participantFacingText
  };
}

revealRouter.post("/", (req: Request<unknown, unknown, RevealRequest>, res: Response) => {
  try {
    const response = revealBodyMapClue(req.body);
    res.json(response);
  } catch (error) {
    if (error instanceof RevealRouteError) {
      res.status(error.statusCode).json({
        error: error.message,
        sentToAI: false
      });
      return;
    }

    res.status(500).json({
      error: "Unable to reveal body-map clue.",
      sentToAI: false
    });
  }
});
