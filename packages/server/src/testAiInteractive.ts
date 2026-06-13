import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runSelfTriageTurn } from "./agents/selfTriagePipeline";
import { createEmptyParticipantMemory } from "./stores/memoryStore";
import type { ParticipantMemory } from "./types/experiment";

const caseId = "case_appendicitis_pattern";

function createInitialMemory(): ParticipantMemory {
  return createEmptyParticipantMemory({
    participantId: "ai-interactive-test-participant",
    caseId,
    condition: "chat",
    sessionId: "ai-interactive-test-session"
  });
}

async function runOneTurn({
  message,
  memory
}: {
  message: string;
  memory: ParticipantMemory;
}): Promise<ParticipantMemory> {
  const result = await runSelfTriageTurn({
    message,
    memory,
    caseId
  });

  console.log("\n--- extractionResult ---");
  console.log(result.extractionResult);
  console.log("--- matchingResult top leaves ---");
  console.log(result.matchingResult.topLeaves);
  console.log("--- decisionResult ---");
  console.log(result.decisionResult);
  console.log("--- AI response ---");
  console.log(result.response);

  return result.updatedMemory;
}

async function askForMessage(
  readline: ReturnType<typeof createInterface>
): Promise<string | null> {
  try {
    return await readline.question("\nparticipant> ");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ERR_USE_AFTER_CLOSE"
    ) {
      return null;
    }

    throw error;
  }
}

async function main(): Promise<void> {
  let memory = createInitialMemory();
  const readline = createInterface({ input, output });

  console.log("Interactive abdominal-pain self-triage pipeline test");
  console.log(`Using caseId: ${caseId}`);
  console.log('Type a participant message, "reset" to clear memory, or "exit" to quit.');

  try {
    while (true) {
      const rawMessage = await askForMessage(readline);

      if (rawMessage === null) {
        break;
      }

      const message = rawMessage.trim();

      if (message.length === 0) {
        continue;
      }

      if (message.toLowerCase() === "exit") {
        break;
      }

      if (message.toLowerCase() === "reset") {
        memory = createInitialMemory();
        console.log("Memory reset.");
        console.log(JSON.stringify(memory, null, 2));
        continue;
      }

      memory = await runOneTurn({ message, memory });
    }
  } finally {
    readline.close();
  }
}

main().catch((error: unknown) => {
  console.error("Interactive AI pipeline test failed:");
  console.error(error);
  process.exitCode = 1;
});
