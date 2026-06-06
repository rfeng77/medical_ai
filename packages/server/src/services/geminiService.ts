type GenerateGeminiResponseInput = {
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const retryableStatusCodes = new Set([429, 503]);

export class GeminiServiceError extends Error {
  errorType: string;
  statusCode?: number;

  constructor(errorType: string, statusCode?: number) {
    super("Gemini response generation failed.");
    this.name = "GeminiServiceError";
    this.errorType = errorType;
    this.statusCode = statusCode;
  }
}

function logGeminiError({
  errorType,
  statusCode,
  errorBody,
  model,
  apiKeyLoaded
}: {
  errorType: string;
  statusCode?: number;
  errorBody?: unknown;
  model?: string;
  apiKeyLoaded: boolean;
}): void {
  console.warn("Gemini request failed", {
    apiKeyLoaded,
    model,
    errorType,
    statusCode,
    errorBody
  });
}

function getErrorTypeForStatus(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) {
    return "invalid_api_key";
  }

  if (statusCode === 429) {
    return "rate_limit_or_quota";
  }

  if (statusCode >= 500) {
    return "provider_server_error";
  }

  return "provider_http_error";
}

function shouldRetryStatus(statusCode: number): boolean {
  return retryableStatusCodes.has(statusCode);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function readGeminiErrorBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function generateGeminiResponse({
  systemInstruction,
  userPrompt,
  temperature
}: GenerateGeminiResponseInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const apiKeyLoaded = Boolean(apiKey);

  if (!apiKey) {
    const errorType = "missing_api_key";
    logGeminiError({
      apiKeyLoaded,
      model,
      errorType
    });
    throw new GeminiServiceError(errorType);
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: userPrompt
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },
      generationConfig: {
        temperature,
        maxOutputTokens: 500
      }
    };

    for (let attempt = 0; attempt <= 2; attempt += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = (await response.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!text) {
          const errorType = "empty_provider_response";
          logGeminiError({
            apiKeyLoaded,
            model,
            errorType
          });
          throw new GeminiServiceError(errorType);
        }

        return text;
      }

      const errorType = getErrorTypeForStatus(response.status);
      const errorBody = await readGeminiErrorBody(response);
      logGeminiError({
        apiKeyLoaded,
        model,
        errorType,
        statusCode: response.status,
        errorBody
      });

      if (attempt < 2 && shouldRetryStatus(response.status)) {
        await wait(attempt === 0 ? 800 : 1600);
        continue;
      }

      throw new GeminiServiceError(errorType, response.status);
    }

    throw new GeminiServiceError("provider_retry_exhausted");
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      throw error;
    }

    const errorType = "network_error";
    logGeminiError({
      apiKeyLoaded,
      model,
      errorType
    });
    throw new GeminiServiceError(errorType);
  }
}
