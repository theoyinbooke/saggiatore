export interface ModelConfig {
  id: string;
  displayName: string;
  provider: "openai" | "openrouter" | "groq";
  apiModel: string;
  envKey: string;
  color: string;
  badgeVariant: "default" | "secondary";
}

// Legacy static model registry — kept as fallback
export const MODELS: Record<string, ModelConfig> = {
  "gpt-4o": {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    apiModel: "gpt-4o",
    envKey: "OPENAI_API_KEY",
    color: "hsl(171, 77%, 40%)",
    badgeVariant: "default",
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    displayName: "Claude Sonnet 4.5",
    provider: "openrouter",
    apiModel: "anthropic/claude-sonnet-4.5",
    envKey: "OPENROUTER_API_KEY",
    color: "hsl(24, 94%, 53%)",
    badgeVariant: "secondary",
  },
};

export const MODEL_IDS = ["gpt-4o", "claude-sonnet-4-5"] as const;

export type ModelId = (typeof MODEL_IDS)[number];

// 12-color palette for dynamic model assignment
export const COLOR_PALETTE = [
  "hsl(171, 77%, 40%)",
  "hsl(24, 94%, 53%)",
  "hsl(217, 91%, 60%)",
  "hsl(271, 81%, 56%)",
  "hsl(330, 81%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(199, 89%, 48%)",
  "hsl(292, 84%, 61%)",
  "hsl(48, 96%, 53%)",
  "hsl(0, 84%, 60%)",
  "hsl(187, 85%, 43%)",
] as const;

// Module-level cache populated by ModelRegistryProvider
const modelCache = new Map<string, ModelConfig>();

export function setModelCache(models: ModelConfig[]): void {
  modelCache.clear();
  for (const m of models) {
    modelCache.set(m.id, m);
  }
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

export function generateColorFromId(modelId: string): string {
  const h = hashString(modelId) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return modelCache.get(modelId) ?? MODELS[modelId];
}

function stripProviderPrefix(name: string): string {
  const colonIdx = name.indexOf(": ");
  if (colonIdx !== -1) return name.slice(colonIdx + 2);
  const slashIdx = name.indexOf("/");
  if (slashIdx !== -1) return name.slice(slashIdx + 1);
  return name;
}

export function getModelDisplayName(modelId: string): string {
  const raw = modelCache.get(modelId)?.displayName ?? MODELS[modelId]?.displayName ?? modelId;
  return stripProviderPrefix(raw);
}

export function getModelColor(modelId: string): string {
  return modelCache.get(modelId)?.color ?? MODELS[modelId]?.color ?? generateColorFromId(modelId);
}

// Model options for the "My Saggiatore" create form
export const MODEL_OPTIONS = [
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B", provider: "Meta" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "Groq" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: "Groq" },
] as const;
