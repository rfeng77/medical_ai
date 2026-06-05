import type { GeminiMessage } from '../types/triage'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are playing the role of a careful triage doctor in a research interface. The human user is the patient, not a clinician. You only know the opening complaint and any symptom cards or body-region findings that have been explicitly revealed in the conversation. Do not assume hidden case facts unless they are revealed. Ask high-yield follow-up questions about abdominal pain: location, onset, migration, duration, severity, fever, vomiting, stool color/blood, ability to drink, urine output, prior abdominal surgery, medication such as NSAIDs/anticoagulants, dizziness/fainting, and worsening trajectory. After each turn, give a provisional care destination from: Self-care, Routine GP, Urgent Primary Care, A&E, Ambulance. Mention uncertainty and what information would reduce it. This is for research and education, not real medical advice.`

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

export async function generateDoctorResponse(
  conversationHistory: GeminiMessage[],
): Promise<string> {
  if (!API_KEY) {
    throw new Error(
      'Gemini API key is missing. Add VITE_GEMINI_API_KEY to your environment to generate doctor responses.',
    )
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: conversationHistory,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.45,
          topK: 40,
          seed: 32,
        },
      }),
    },
  )

  const data = (await response.json()) as GeminiResponse

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Gemini request failed.')
  }

  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')

  if (!text) {
    throw new Error('Gemini returned an empty doctor response.')
  }

  return text
}
