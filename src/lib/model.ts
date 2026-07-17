type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelResult = {
  text: string;
  model: string;
  provider: string;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function inferProvider(url: string): "ollama" | "openai-compatible" {
  const configured = process.env.TRIZZY_MODEL_PROVIDER?.toLowerCase();
  if (configured === "ollama") return "ollama";
  if (configured === "openai-compatible") return "openai-compatible";
  return url.includes("11434") || url.endsWith("/api/chat") ? "ollama" : "openai-compatible";
}

export async function generateWithModel(
  messages: ModelMessage[],
  temperature: number,
  signal?: AbortSignal,
): Promise<ModelResult> {
  const rawUrl = process.env.TRIZZY_MODEL_API_URL || "http://127.0.0.1:11434/api/chat";
  const url = normalizeBaseUrl(rawUrl);
  const provider = inferProvider(url);
  const model = process.env.TRIZZY_MODEL_NAME || (provider === "ollama" ? "qwen3:1.7b" : "qwen3-1.7b");

  if (provider === "ollama") {
    const endpoint = url.endsWith("/api/chat") ? url : `${url}/api/chat`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        think: false,
        keep_alive: "20m",
        options: {
          temperature,
          top_p: 0.92,
          repeat_penalty: 1.08,
          num_ctx: 4096,
          num_predict: 1800,
        },
      }),
      cache: "no-store",
      signal,
    });

    const data = (await response.json().catch(() => ({}))) as OllamaResponse;
    if (!response.ok) {
      throw new Error(data.error || `Ollama returned HTTP ${response.status}.`);
    }

    const text = data.message?.content?.trim();
    if (!text) throw new Error("The local model returned an empty response.");
    return { text, model, provider };
  }

  const endpoint = url.endsWith("/v1/chat/completions") ? url : `${url}/v1/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.TRIZZY_MODEL_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: 0.92,
      max_tokens: 1800,
      stream: false,
    }),
    cache: "no-store",
    signal,
  });

  const data = (await response.json().catch(() => ({}))) as OpenAICompatibleResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `Model endpoint returned HTTP ${response.status}.`);
  }

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The configured model endpoint returned an empty response.");
  return { text, model, provider };
}

export async function checkModel(): Promise<{
  ok: boolean;
  detail: string;
  model: string;
  provider: string;
}> {
  const rawUrl = process.env.TRIZZY_MODEL_API_URL || "http://127.0.0.1:11434/api/chat";
  const url = normalizeBaseUrl(rawUrl);
  const provider = inferProvider(url);
  const model = process.env.TRIZZY_MODEL_NAME || (provider === "ollama" ? "qwen3:1.7b" : "qwen3-1.7b");

  if (provider === "ollama") {
    const base = url.endsWith("/api/chat") ? url.slice(0, -9) : url;
    try {
      const response = await fetch(`${base}/api/tags`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return { ok: false, detail: `Ollama returned HTTP ${response.status}.`, model, provider };
      }
      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
      const found = (data.models || []).some((item) => item.name === model || item.model === model);
      return found
        ? { ok: true, detail: `${model} is ready locally.`, model, provider }
        : { ok: false, detail: `Ollama is running, but ${model} is not installed.`, model, provider };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown connection error.";
      return { ok: false, detail: `Cannot reach local Ollama: ${detail}`, model, provider };
    }
  }

  return {
    ok: Boolean(process.env.TRIZZY_MODEL_API_URL),
    detail: process.env.TRIZZY_MODEL_API_URL
      ? `${model} endpoint is configured.`
      : "No hosted model endpoint is configured.",
    model,
    provider,
  };
}
