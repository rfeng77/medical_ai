import { Router } from "express";
import type { Request, Response } from "express";
import { revealBodyMapClue, RevealError } from "../agents/BodyMapRevealAgent";
import type { RevealRequest } from "../types/experiment";

export const revealRouter = Router();

revealRouter.post("/", (req: Request<unknown, unknown, RevealRequest>, res: Response) => {
  try {
    const response = revealBodyMapClue(req.body);
    res.json(response);
  } catch (error) {
    if (error instanceof RevealError) {
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
