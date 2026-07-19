type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelResult = {
  text: string;
  model: string;
  provider: string;
};

type ModelGenerationOptions = {
  maxTokens?: number;
  nonThinking?: boolean;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?:
    | {
        message?: string;
      }
    | string;
};

type OllamaResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

type OpenAIModelsResponse = {
  data?: Array<{
    id?: string;
  }>;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function inferProvider(url: string): "ollama" | "openai-compatible" {
  const configured = process.env.TRIZZY_MODEL_PROVIDER?.toLowerCase();
  if (configured === "ollama") return "ollama";
  if (configured === "openai-compatible") return "openai-compatible";
  return url.includes("11434") || url.endsWith("/api/chat") ? "ollama" : "openai-compatible";
}

function clampTokenBudget(value: number): number {
  return Math.min(1800, Math.max(64, Math.round(value)));
}

function applyNonThinkingSwitch(messages: ModelMessage[]): ModelMessage[] {
  const updated = messages.map((message) => ({ ...message }));

  for (let index = updated.length - 1; index >= 0; index -= 1) {
    if (updated[index].role !== "user") continue;
    if (!updated[index].content.includes("/no_think")) {
      updated[index].content = `${updated[index].content.trim()}\n\n/no_think`;
    }
    break;
  }

  return updated;
}

function removeReasoningBlocks(rawText: string): string {
  let text = rawText.trim();

  text = text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
  text = text.replace(/^\s*<\/think>\s*/i, "").trim();

  const unmatchedThink = text.search(/<think>/i);
  if (unmatchedThink >= 0) {
    text = text.slice(0, unmatchedThink).trim();
  }

  return text;
}

function getOpenAIBaseUrl(url: string): string {
  if (url.endsWith("/v1/chat/completions")) {
    return url.slice(0, -"/chat/completions".length);
  }
  if (url.endsWith("/v1")) return url;
  return `${url}/v1`;
}

function getOpenAIError(data: OpenAICompatibleResponse, fallback: string): string {
  if (typeof data.error === "string") return data.error;
  return data.error?.message || fallback;
}

export async function generateWithModel(
  messages: ModelMessage[],
  temperature: number,
  signal?: AbortSignal,
  options: ModelGenerationOptions = {},
): Promise<ModelResult> {
  const rawUrl = process.env.TRIZZY_MODEL_API_URL || "http://127.0.0.1:11434/api/chat";
  const url = normalizeBaseUrl(rawUrl);
  const provider = inferProvider(url);
  const model =
    process.env.TRIZZY_MODEL_NAME || (provider === "ollama" ? "qwen3:1.7b" : "trizzy-writer");
  const maxTokens = clampTokenBudget(options.maxTokens ?? 768);
  const requestMessages = options.nonThinking === false ? messages : applyNonThinkingSwitch(messages);

  if (provider === "ollama") {
    const endpoint = url.endsWith("/api/chat") ? url : `${url}/api/chat`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: requestMessages,
        stream: false,
        think: false,
        keep_alive: "20m",
        options: {
          temperature,
          top_p: 0.8,
          top_k: 20,
          repeat_penalty: 1.08,
          num_ctx: 4096,
          num_predict: maxTokens,
        },
      }),
      cache: "no-store",
      signal,
    });

    const data = (await response.json().catch(() => ({}))) as OllamaResponse;
    if (!response.ok) {
      throw new Error(data.error || `Ollama returned HTTP ${response.status}.`);
    }

    const text = removeReasoningBlocks(data.message?.content || "");
    if (!text) {
      throw new Error("The local model returned reasoning without a finished lyric response.");
    }
    return { text, model, provider };
  }

  const baseUrl = getOpenAIBaseUrl(url);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.TRIZZY_MODEL_API_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: requestMessages,
      temperature,
      top_p: 0.8,
      top_k: 20,
      max_tokens: maxTokens,
      stream: false,
      chat_template_kwargs: {
        enable_thinking: false,
      },
    }),
    cache: "no-store",
    signal,
  });

  const data = (await response.json().catch(() => ({}))) as OpenAICompatibleResponse;
  if (!response.ok) {
    throw new Error(getOpenAIError(data, `Model endpoint returned HTTP ${response.status}.`));
  }

  const text = removeReasoningBlocks(data.choices?.[0]?.message?.content || "");
  if (!text) {
    throw new Error("The configured model endpoint returned reasoning without finished lyrics.");
  }
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
  const model =
    process.env.TRIZZY_MODEL_NAME || (provider === "ollama" ? "qwen3:1.7b" : "trizzy-writer");

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

  try {
    const baseUrl = getOpenAIBaseUrl(url);
    const headers: Record<string, string> = {};
    const token = process.env.TRIZZY_MODEL_API_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/models`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: `Model endpoint returned HTTP ${response.status}.`,
        model,
        provider,
      };
    }

    const data = (await response.json().catch(() => ({}))) as OpenAIModelsResponse;
    const availableModels = data.data?.map((item) => item.id).filter(Boolean) || [];
    const found = availableModels.length === 0 || availableModels.includes(model);

    return found
      ? { ok: true, detail: `${model} is ready through the CPU model server.`, model, provider }
      : {
          ok: false,
          detail: `${model} is not listed by the configured model server.`,
          model,
          provider,
        };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown connection error.";
    return { ok: false, detail: `Cannot reach model endpoint: ${detail}`, model, provider };
  }
}
