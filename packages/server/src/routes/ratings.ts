import { Router } from "express";
import type { Request, Response } from "express";
import { addEvent } from "../stores/eventLogStore";
import type { PostTurnRatingRequest } from "../types/experiment";

export const ratingsRouter = Router();

ratingsRouter.post(
  "/",
  (req: Request<unknown, unknown, PostTurnRatingRequest>, res: Response) => {
    try {
      const {
        participantId,
        caseId,
        condition,
        sessionId,
        turnIndex,
        messageId,
        doctorMessageId,
        perceivedUrgency,
        perceivedRisk,
        confidence,
        timestamp,
      } = req.body;

      const ratings = [perceivedUrgency, perceivedRisk, confidence];
      const invalidRating = ratings.some(
        (rating) =>
          typeof rating !== "number" ||
          !Number.isFinite(rating) ||
          rating < 0 ||
          rating > 100
      );

      if (
        !participantId ||
        !caseId ||
        !condition ||
        !sessionId ||
        typeof turnIndex !== "number" ||
        invalidRating
      ) {
        res.status(400).json({
          error:
            "participantId, caseId, condition, sessionId, turnIndex, perceivedUrgency, perceivedRisk, and confidence are required. Ratings must be 0-100."
        });
        return;
      }

      const event = addEvent({
        participantId,
        caseId,
        condition,
        eventType: "post_turn_rating",
        payload: {
          sessionId,
          turnIndex,
          messageId,
          doctorMessageId,
          perceivedUrgency,
          perceivedRisk,
          confidence,
          timestamp: timestamp ?? new Date().toISOString()
        }
      });

      res.json({ saved: true, event });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save post-turn ratings.";
      res.status(500).json({ error: message });
    }
  }
);
