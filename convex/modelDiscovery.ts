"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// 12-color HSL palette for deterministic assignment
// ---------------------------------------------------------------------------

const COLOR_PALETTE = [
  "hsl(171, 77%, 40%)",  // teal
  "hsl(24, 94%, 53%)",   // orange
  "hsl(217, 91%, 60%)",  // blue
  "hsl(271, 81%, 56%)",  // purple
  "hsl(330, 81%, 60%)",  // pink
  "hsl(142, 71%, 45%)",  // green
  "hsl(38, 92%, 50%)",   // amber
  "hsl(199, 89%, 48%)",  // sky
  "hsl(292, 84%, 61%)",  // fuchsia
  "hsl(48, 96%, 53%)",   // yellow
  "hsl(0, 84%, 60%)",    // red
  "hsl(187, 85%, 43%)",  // cyan
];

function hashModelId(modelId: string): number {
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    hash = ((hash << 5) - hash + modelId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorForModel(modelId: string): string {
  return COLOR_PALETTE[hashModelId(modelId) % COLOR_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Legacy model IDs that default to enabled
// ---------------------------------------------------------------------------

const LEGACY_ENABLED = new Set(["gpt-4o", "claude-sonnet-4-5"]);

// ---------------------------------------------------------------------------
// OpenAI model filtering
// ---------------------------------------------------------------------------

const OPENAI_EXCLUDES = [
  "ft:", "realtime", "audio", "embedding", "dall-e", "tts", "whisper",
  "babbage", "davinci", "curie", "ada", "moderation", "search",
  "code-search", "text-search", "similarity", "insert", "edit",
  "canary", "chatgpt-4o-latest",
];

function isAllowedOpenAIModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !OPENAI_EXCLUDES.some((ex) => lower.includes(ex));
}

// ---------------------------------------------------------------------------
// OpenRouter model filtering
// ---------------------------------------------------------------------------

const OPENROUTER_EXCLUDES = [
  "audio", "tts", "whisper", "embedding", "moderation",
  "dall-e", "image", "vision-preview",
];

function isAllowedOpenRouterModel(id: string): boolean {
  const lower = id.toLowerCase();
  // Must have a provider prefix (e.g. "anthropic/...")
  if (!id.includes("/")) return false;
  return !OPENROUTER_EXCLUDES.some((ex) => lower.includes(ex));
}

// ---------------------------------------------------------------------------
// Helpers to normalize a model ID into a registry-friendly slug
// ---------------------------------------------------------------------------

function openaiSlug(id: string): string {
  return id; // OpenAI IDs like "gpt-4o" are already clean
}

function openrouterSlug(id: string): string {
  // "anthropic/claude-sonnet-4.5" → "claude-sonnet-4-5"
  const parts = id.split("/");
  const name = parts.length > 1 ? parts.slice(1).join("-") : id;
  return name.replace(/\./g, "-");
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Groq model filtering
// ---------------------------------------------------------------------------

const GROQ_EXCLUDES = ["whisper", "audio", "tts", "speech", "embedding", "guard", "tool-use", "specdec"];

function isAllowedGroqModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !GROQ_EXCLUDES.some((ex) => lower.includes(ex));
}

function groqSlug(id: string): string {
  return id; // Groq IDs like "llama-3.3-70b-versatile" are already clean
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

interface DiscoveryResult {
  openai: { count: number; error?: string };
  openrouter: { count: number; error?: string };
  groq: { count: number; error?: string };
}

export const fetchModels = action({
  args: {},
  handler: async (ctx): Promise<DiscoveryResult> => {
    // Load existing models to preserve user settings
    const allModels = await ctx.runQuery(internal.modelRegistry.internalList) as {
      modelId: string;
      enabled: boolean;
      color: string;
      _id: string;
    }[];
    const existingByModelId = new Map(
      allModels.map((m) => [
        m.modelId,
        { enabled: m.enabled, color: m.color, _id: m._id },
      ])
    );

    const result: DiscoveryResult = {
      openai: { count: 0 },
      openrouter: { count: 0 },
      groq: { count: 0 },
    };

    let nextSortOrder = allModels.length;

    // ----- OpenAI -----
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openaiKey}` },
      });
      if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const models = (data.data ?? []) as { id: string; created?: number }[];

      for (const m of models) {
        if (!isAllowedOpenAIModel(m.id)) continue;

        const modelId = openaiSlug(m.id);
        const existing = existingByModelId.get(modelId);

        if (existing) {
          // Update metadata, preserve user settings
          await ctx.runMutation(internal.modelRegistry.internalUpsert, {
            _id: existing._id,
            displayName: m.id,
            supportsTools: true,
            lastSyncedAt: Date.now(),
          });
        } else {
          // New model — insert and track in map to prevent duplicates
          const newId = await ctx.runMutation(internal.modelRegistry.internalInsert, {
            modelId,
            displayName: m.id,
            provider: "openai",
            apiModel: m.id,
            envKey: "OPENAI_API_KEY",
            enabled: LEGACY_ENABLED.has(modelId),
            supportsTools: true,
            sortOrder: nextSortOrder++,
            color: colorForModel(modelId),
            lastSyncedAt: Date.now(),
          });
          existingByModelId.set(modelId, {
            enabled: LEGACY_ENABLED.has(modelId),
            color: colorForModel(modelId),
            _id: newId as string,
          });
        }
        result.openai.count++;
      }
    } catch (err) {
      result.openai.error = err instanceof Error ? err.message : String(err);
    }

    // ----- OpenRouter -----
    try {
      const orKey = process.env.OPENROUTER_API_KEY;
      if (!orKey) throw new Error("OPENROUTER_API_KEY not configured");

      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${orKey}` },
      });
      if (!res.ok) throw new Error(`OpenRouter API ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const models = (data.data ?? []) as {
        id: string;
        name?: string;
        context_length?: number;
        description?: string;
        supported_parameters?: string[];
      }[];

      for (const m of models) {
        if (!isAllowedOpenRouterModel(m.id)) continue;

        const modelId = openrouterSlug(m.id);
        const existing = existingByModelId.get(modelId);

        if (existing) {
          await ctx.runMutation(internal.modelRegistry.internalUpsert, {
            _id: existing._id,
            displayName: m.name ?? m.id,
            supportsTools: Array.isArray(m.supported_parameters)
              ? m.supported_parameters.includes("tools")
              : true,
            lastSyncedAt: Date.now(),
            contextWindow: m.context_length,
          });
        } else {
          // New model — insert and track in map to prevent duplicates
          const newId = await ctx.runMutation(internal.modelRegistry.internalInsert, {
            modelId,
            displayName: m.name ?? m.id,
            provider: "openrouter",
            apiModel: m.id,
            envKey: "OPENROUTER_API_KEY",
            enabled: LEGACY_ENABLED.has(modelId),
            supportsTools: Array.isArray(m.supported_parameters)
              ? m.supported_parameters.includes("tools")
              : true,
            sortOrder: nextSortOrder++,
            color: colorForModel(modelId),
            lastSyncedAt: Date.now(),
            contextWindow: m.context_length,
            description: m.description,
          });
          existingByModelId.set(modelId, {
            enabled: LEGACY_ENABLED.has(modelId),
            color: colorForModel(modelId),
            _id: newId as string,
          });
        }
        result.openrouter.count++;
      }
    } catch (err) {
      result.openrouter.error = err instanceof Error ? err.message : String(err);
    }

    // ----- Groq -----
    try {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) throw new Error("GROQ_API_KEY not configured");

      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${groqKey}` },
      });
      if (!res.ok) throw new Error(`Groq API ${res.status}: ${await res.text()}`);

      const data = await res.json();
      const models = (data.data ?? []) as {
        id: string;
        context_window?: number;
      }[];

      for (const m of models) {
        if (!isAllowedGroqModel(m.id)) continue;

        const modelId = groqSlug(m.id);
        const existing = existingByModelId.get(modelId);

        if (existing) {
          await ctx.runMutation(internal.modelRegistry.internalUpsert, {
            _id: existing._id,
            displayName: m.id,
            supportsTools: true,
            lastSyncedAt: Date.now(),
            contextWindow: m.context_window,
          });
        } else {
          const newId = await ctx.runMutation(internal.modelRegistry.internalInsert, {
            modelId,
            displayName: m.id,
            provider: "groq",
            apiModel: m.id,
            envKey: "GROQ_API_KEY",
            enabled: false,
            supportsTools: true,
            sortOrder: nextSortOrder++,
            color: colorForModel(modelId),
            lastSyncedAt: Date.now(),
            contextWindow: m.context_window,
          });
          existingByModelId.set(modelId, {
            enabled: false,
            color: colorForModel(modelId),
            _id: newId as string,
          });
        }
        result.groq.count++;
      }
    } catch (err) {
      result.groq.error = err instanceof Error ? err.message : String(err);
    }

    return result;
  },
});
