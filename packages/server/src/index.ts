import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { revealRouter } from "./routes/reveal";
import casesRouter from "./routes/cases";
import { chatRouter } from "./routes/chat";
import { decisionRouter } from "./routes/decision";
import { getParticipantLogs } from "./agents/LoggingAgent";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/cases", casesRouter);
app.use("/api/reveal", revealRouter);
app.use("/api/chat", chatRouter);
app.use("/api/decision", decisionRouter);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "medical-triage-experiment-server" });
});

app.get("/api/logs/:participantId", (req, res) => {
  const rawParticipantId = req.params.participantId;
  const participantId = Array.isArray(rawParticipantId)
    ? rawParticipantId[0]
    : rawParticipantId;

  if (!participantId) {
    res.status(400).json({ error: "participantId is required." });
    return;
  }

  res.json({
    participantId,
    events: getParticipantLogs(participantId),
  });
});

export const server = app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

const keepAlive = setInterval(() => {
  // Bun can otherwise exit after Express registers the listener in this environment.
}, 60_000);

process.on("SIGINT", () => {
  clearInterval(keepAlive);
  server.close(() => process.exit(0));
});