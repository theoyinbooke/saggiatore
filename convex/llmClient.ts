// ---------------------------------------------------------------------------
// Shared LLM client — single callLLM() for all providers (OpenAI, OpenRouter, Groq)
// ---------------------------------------------------------------------------

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

export interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };
  };
}

export interface LLMResponse {
  content: string | null;
  tool_calls?: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }[];
}

export type LLMProvider = "openai" | "openrouter" | "groq";

interface ProviderConfig {
  endpoint: string;
  envKey: string;
  label: string;
  extraHeaders?: Record<string, string>;
}

const PROVIDER_CONFIG: Record<LLMProvider, ProviderConfig> = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    envKey: "OPENAI_API_KEY",
    label: "OpenAI",
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    extraHeaders: {
      "X-Title": "Saggiatore Immigration Agent Eval",
    },
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "GROQ_API_KEY",
    label: "Groq",
  },
};

export async function callLLM(
  provider: LLMProvider,
  messages: OpenAIMessage[],
  tools: OpenAIToolDef[] | undefined,
  model: string,
  maxTokens?: number
): Promise<LLMResponse> {
  const config = PROVIDER_CONFIG[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const apiKey = process.env[config.envKey];
  if (!apiKey) throw new Error(`${config.envKey} not configured`);

  const body: Record<string, unknown> = {
    model,
    messages,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  if (maxTokens) {
    body.max_tokens = maxTokens;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...config.extraHeaders,
  };

  const res = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${config.label} API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  if (!choice) throw new Error(`No response from ${config.label}`);

  return {
    content: choice.content ?? null,
    tool_calls: choice.tool_calls,
  };
}
