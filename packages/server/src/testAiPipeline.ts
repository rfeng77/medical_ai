import { runSelfTriageTurn } from "./agents/selfTriagePipeline";
import { createEmptyParticipantMemory } from "./stores/memoryStore";
import type { ParticipantMemory } from "./types/experiment";

const caseId = "case_appendicitis_pattern";

const scenarios = [
  {
    name: "watery diarrhea needs more information",
    messages: ["I have watery diarrhea."]
  },
  {
    name: "gastroenteritis-like sequence",
    messages: [
      "I have watery diarrhea.",
      "Also stomach cramps and vomiting.",
      "There is no blood in my stool and I do not have a high fever. I can still drink water."
    ]
  },
  {
    name: "appendicitis-like urgent pattern",
    messages: [
      "The pain started near my belly button and moved to the lower right side. Walking makes it worse and I feel nauseous."
    ]
  },
  {
    name: "ambiguous abdominal pain and vomiting",
    messages: ["I have abdominal pain and vomiting."]
  }
];

function createMemory(scenarioName: string): ParticipantMemory {
  return createEmptyParticipantMemory({
    participantId: `ai-pipeline-test-${scenarioName.replace(/\W+/g, "-")}`,
    caseId,
    condition: "chat",
    sessionId: `ai-pipeline-test-${scenarioName.replace(/\W+/g, "-")}`
  });
}

async function runScenario(scenario: (typeof scenarios)[number]): Promise<void> {
  let memory = createMemory(scenario.name);

  console.log("\n====================================================");
  console.log(`Scenario: ${scenario.name}`);

  for (const message of scenario.messages) {
    const result = await runSelfTriageTurn({
      message,
      memory,
      caseId
    });
    memory = result.updatedMemory;

    console.log("\nParticipant message:");
    console.log(message);
    console.log("--- extractionResult ---");
    console.log(result.extractionResult);
    console.log("--- matchingResult top leaves ---");
    console.log(result.matchingResult.topLeaves);
    console.log("--- decisionResult ---");
    console.log(result.decisionResult);
    console.log("--- AI response ---");
    console.log(result.response);
  }
}

async function main(): Promise<void> {
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
}

main().catch((error: unknown) => {
  console.error("AI pipeline test failed:");
  console.error(error);
  process.exitCode = 1;
});
