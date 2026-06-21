import { spawnSync } from "node:child_process";

type GenerateGeminiResponseInput = {
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
  maxOutputTokens?: number;
  responseMimeType?: "application/json" | "text/plain";
};

type AzureChatCompletionResponse = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type AzureChatCompletionStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
    };
  }>;
};

const retryableStatusCodes = new Set([429, 500, 502, 503, 504]);
const AZURE_OPENAI_REQUEST_TIMEOUT_MS = 60_000;

export class GeminiServiceError extends Error {
  errorType: string;
  statusCode?: number;

  constructor(errorType: string, statusCode?: number) {
    super("Azure OpenAI response generation failed.");
    this.name = "GeminiServiceError";
    this.errorType = errorType;
    this.statusCode = statusCode;
  }
}

function logProviderError({
  errorType,
  statusCode,
  errorBody,
  endpointLoaded,
  apiKeyLoaded,
  deployment
}: {
  errorType: string;
  statusCode?: number;
  errorBody?: unknown;
  endpointLoaded: boolean;
  apiKeyLoaded: boolean;
  deployment?: string;
}): void {
  console.warn("Azure OpenAI request failed", {
    endpointLoaded,
    apiKeyLoaded,
    deployment,
    errorType,
    statusCode,
    errorBody
  });
}

function getErrorTypeForStatus(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) return "invalid_api_key";
  if (statusCode === 404) return "invalid_endpoint_or_deployment";
  if (statusCode === 429) return "rate_limit_or_quota";
  if (statusCode >= 500) return "provider_server_error";
  return "provider_http_error";
}

function shouldRetryStatus(statusCode: number): boolean {
  return retryableStatusCodes.has(statusCode);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseMaybeJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function postWithCurl({
  endpoint,
  apiKey,
  requestBody
}: {
  endpoint: string;
  apiKey: string;
  requestBody: unknown;
}): { statusCode: number; bodyText: string } {
  const result = spawnSync(
    "curl",
    [
      "-sS",
      "-w",
      "\nHTTP_STATUS:%{http_code}",
      "-H",
      "Content-Type: application/json",
      "-H",
      "api-key: " + apiKey,
      "-d",
      JSON.stringify(requestBody),
      endpoint
    ],
    { encoding: "utf8" }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || "curl request failed");
  }

  const stdout = result.stdout || "";
  const marker = "\nHTTP_STATUS:";
  const markerIndex = stdout.lastIndexOf(marker);

  if (markerIndex === -1) {
    throw new Error("curl response did not include HTTP status");
  }

  return {
    bodyText: stdout.slice(0, markerIndex),
    statusCode: Number(stdout.slice(markerIndex + marker.length).trim())
  };
}

function azureEndpointFromEnv(): string | null {
  const explicitEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  if (explicitEndpoint) return explicitEndpoint;

  const resourceEndpoint = process.env.AZURE_OPENAI_RESOURCE_ENDPOINT?.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview";
  if (!resourceEndpoint || !deployment) return null;

  return resourceEndpoint + "/openai/deployments/" + deployment + "/chat/completions?api-version=" + apiVersion;
}

export async function generateGeminiResponse({
  systemInstruction,
  userPrompt,
  temperature,
  maxOutputTokens = 500,
  responseMimeType
}: GenerateGeminiResponseInput): Promise<string> {
  const endpoint = azureEndpointFromEnv();
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const endpointLoaded = Boolean(endpoint);
  const apiKeyLoaded = Boolean(apiKey);

  if (!endpoint || !apiKey) {
    const errorType = !endpoint ? "missing_endpoint" : "missing_api_key";
    logProviderError({ endpointLoaded, apiKeyLoaded, deployment, errorType });
    throw new GeminiServiceError(errorType);
  }

  const requestBody = {
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    temperature,
    max_tokens: maxOutputTokens,
    ...(responseMimeType === "application/json" ? { response_format: { type: "json_object" } } : {})
  };

  try {
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AZURE_OPENAI_REQUEST_TIMEOUT_MS);
      let statusCode = 0;
      let bodyText = "";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }).finally(() => clearTimeout(timeout));
        statusCode = response.status;
        bodyText = await response.text();
      } catch {
        clearTimeout(timeout);
        const curlResponse = postWithCurl({ endpoint, apiKey, requestBody });
        statusCode = curlResponse.statusCode;
        bodyText = curlResponse.bodyText;
      }

      if (statusCode >= 200 && statusCode < 300) {
        const data = parseMaybeJson(bodyText) as AzureChatCompletionResponse;
        const text = data.choices?.[0]?.message?.content?.trim();
        if (process.env.LOG_LLM_USAGE === "true" && data.usage) {
          console.info("azure_openai_usage", data.usage);
        }

        if (!text) {
          const errorType = "empty_provider_response";
          logProviderError({ endpointLoaded, apiKeyLoaded, deployment, errorType });
          throw new GeminiServiceError(errorType);
        }
        return text;
      }

      const errorType = getErrorTypeForStatus(statusCode);
      const errorBody = parseMaybeJson(bodyText);
      logProviderError({ endpointLoaded, apiKeyLoaded, deployment, errorType, statusCode, errorBody });
      if (attempt < 2 && shouldRetryStatus(statusCode)) {
        await wait(attempt === 0 ? 800 : 1600);
        continue;
      }
      throw new GeminiServiceError(errorType, statusCode);
    }
    throw new GeminiServiceError("provider_retry_exhausted");
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    const errorType = "network_error";
    logProviderError({ endpointLoaded, apiKeyLoaded, deployment, errorType });
    throw new GeminiServiceError(errorType);
  }
}

export async function generateGeminiResponseStream({
  systemInstruction,
  userPrompt,
  temperature,
  maxOutputTokens = 500,
  onChunk
}: GenerateGeminiResponseInput & {
  onChunk: (chunk: string) => void;
}): Promise<string> {
  const endpoint = azureEndpointFromEnv();
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const endpointLoaded = Boolean(endpoint);
  const apiKeyLoaded = Boolean(apiKey);

  if (!endpoint || !apiKey) {
    const errorType = !endpoint ? "missing_endpoint" : "missing_api_key";
    logProviderError({ endpointLoaded, apiKeyLoaded, deployment, errorType });
    throw new GeminiServiceError(errorType);
  }

  const requestBody = {
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt }
    ],
    temperature,
    max_tokens: maxOutputTokens,
    stream: true
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      const errorType = getErrorTypeForStatus(response.status);
      logProviderError({
        endpointLoaded,
        apiKeyLoaded,
        deployment,
        errorType,
        statusCode: response.status,
        errorBody: parseMaybeJson(bodyText)
      });
      throw new GeminiServiceError(errorType, response.status);
    }

    if (!response.body) {
      throw new GeminiServiceError("empty_provider_response");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") continue;

        const parsed = parseMaybeJson(payload) as AzureChatCompletionStreamChunk;
        const chunk = parsed.choices?.[0]?.delta?.content ?? "";
        if (!chunk) continue;

        fullText += chunk;
        onChunk(chunk);
      }
    }

    const text = fullText.trim();
    if (!text) {
      throw new GeminiServiceError("empty_provider_response");
    }

    return text;
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    const errorType = "network_error";
    logProviderError({ endpointLoaded, apiKeyLoaded, deployment, errorType });
    throw new GeminiServiceError(errorType);
  }
}
