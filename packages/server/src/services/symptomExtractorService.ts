import { generateGeminiResponse } from "./geminiService";

export type SymptomExtractionResult = {
  isSymptomDisclosure: boolean;
  otherSymptoms: string[];
  nonSymptomInputType: "greeting" | "question" | "unclear" | "irrelevant" | null;
  briefReason: string;
};

const fallbackResult: SymptomExtractionResult = {
  isSymptomDisclosure: false,
  otherSymptoms: [],
  nonSymptomInputType: "unclear",
  briefReason: "No symptom information was detected.",
};

function extractJson(text: string): SymptomExtractionResult {
  try {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<SymptomExtractionResult>;

    return {
      isSymptomDisclosure: Boolean(parsed.isSymptomDisclosure),
      otherSymptoms: Array.isArray(parsed.otherSymptoms)
        ? parsed.otherSymptoms
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      nonSymptomInputType:
        parsed.nonSymptomInputType === "greeting" ||
        parsed.nonSymptomInputType === "question" ||
        parsed.nonSymptomInputType === "unclear" ||
        parsed.nonSymptomInputType === "irrelevant"
          ? parsed.nonSymptomInputType
          : null,
      briefReason:
        typeof parsed.briefReason === "string"
          ? parsed.briefReason
          : "Parsed symptom extraction result.",
    };
  } catch {
    return fallbackResult;
  }
}

export async function extractOtherSymptomsWithAI(
  message: string,
): Promise<SymptomExtractionResult> {
  const systemInstruction = `
You are an information extraction agent for a controlled medical triage experiment.

Your task is only to identify whether the participant's message contains symptom information.

Do not diagnose.
Do not recommend care.
Do not infer hidden symptoms.
Do not use any case ground truth.
Do not decide triage.

Return strict JSON only.

Schema:
{
  "isSymptomDisclosure": boolean,
  "otherSymptoms": string[],
  "nonSymptomInputType": "greeting" | "question" | "unclear" | "irrelevant" | null,
  "briefReason": string
}

Rules:
- If the message describes something the participant physically feels, mark isSymptomDisclosure true.
- If the message describes pain, discomfort, nausea, dizziness, fever, stool change, breathing issue, bleeding, weakness, urinary issue, or any bodily symptom, extract it.
- If the message is only greeting, random text, a case id, or not about symptoms, mark isSymptomDisclosure false.
- Do not convert symptoms into diagnosis.
- Keep symptoms short and plain, such as "back pain", "headache", "chest pain".
- If a message contains both known abdominal symptoms and additional symptoms, only put the additional symptoms in otherSymptoms.
`;

  const userPrompt = `
Participant message:
${message}

Return JSON only.
`;

  try {
    const response = await generateGeminiResponse({
      systemInstruction,
      userPrompt,
      temperature: 0.1,
    });

    return extractJson(response);
  } catch {
    return fallbackResult;
  }
}