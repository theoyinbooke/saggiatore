import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./authHelpers";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("modelRegistry").collect();
  },
});

export const listEnabled = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("modelRegistry")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

export const getByModelId = query({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("modelRegistry")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .unique();
  },
});

// ---------------------------------------------------------------------------
// Internal queries (for use from actions)
// ---------------------------------------------------------------------------

export const internalGetByModelId = internalQuery({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("modelRegistry")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .unique();
  },
});

export const internalListEnabled = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("modelRegistry")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

export const internalList = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("modelRegistry").collect();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const toggleModel = mutation({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Find ALL entries for this modelId (handles duplicates gracefully)
    const matches = await ctx.db
      .query("modelRegistry")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .collect();

    if (matches.length === 0) throw new Error(`Model not found: ${args.modelId}`);

    const primary = matches[0];
    const newEnabled = !primary.enabled;

    if (newEnabled) {
      const rawLimit = process.env.MAX_ENABLED_MODELS;
      const maxEnabled =
        rawLimit && Number.isFinite(parseInt(rawLimit, 10)) && parseInt(rawLimit, 10) >= 1
          ? parseInt(rawLimit, 10)
          : 10;

      const enabledModels = await ctx.db
        .query("modelRegistry")
        .withIndex("by_enabled", (q) => q.eq("enabled", true))
        .collect();

      if (enabledModels.length >= maxEnabled) {
        throw new Error(
          `Maximum ${maxEnabled} models can be enabled at once. Disable one first.`
        );
      }
    }

    // Toggle the primary entry
    await ctx.db.patch(primary._id, { enabled: newEnabled });

    // Delete any duplicate entries for the same modelId
    for (let i = 1; i < matches.length; i++) {
      await ctx.db.delete(matches[i]._id);
    }

    return { enabled: newEnabled };
  },
});

export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Check if already seeded
    const existing = await ctx.db.query("modelRegistry").first();
    if (existing) {
      return { status: "already_seeded" as const };
    }

    const defaults = [
      {
        modelId: "gpt-4o",
        displayName: "GPT-4o",
        provider: "openai" as const,
        apiModel: "gpt-4o",
        envKey: "OPENAI_API_KEY",
        enabled: true,
        supportsTools: true,
        sortOrder: 0,
        color: "hsl(217, 91%, 60%)",
        lastSyncedAt: Date.now(),
        contextWindow: 128000,
        description: "OpenAI GPT-4o — fast, multimodal flagship model",
      },
      {
        modelId: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        provider: "openrouter" as const,
        apiModel: "anthropic/claude-sonnet-4.5",
        envKey: "OPENROUTER_API_KEY",
        enabled: true,
        supportsTools: true,
        sortOrder: 1,
        color: "hsl(271, 81%, 56%)",
        lastSyncedAt: Date.now(),
        contextWindow: 200000,
        description:
          "Anthropic Claude Sonnet 4.5 via OpenRouter — balanced intelligence and speed",
      },
      {
        modelId: "llama-3.3-70b-versatile",
        displayName: "Llama 3.3 70B Versatile",
        provider: "groq" as const,
        apiModel: "llama-3.3-70b-versatile",
        envKey: "GROQ_API_KEY",
        enabled: false,
        supportsTools: true,
        sortOrder: 2,
        color: "hsl(38, 92%, 50%)",
        lastSyncedAt: Date.now(),
        contextWindow: 131072,
        description:
          "Meta Llama 3.3 70B via Groq — ultra-fast inference",
      },
    ];

    for (const model of defaults) {
      await ctx.db.insert("modelRegistry", model);
    }

    return { status: "seeded" as const, count: defaults.length };
  },
});

// ---------------------------------------------------------------------------
// Internal mutations (for use from discovery action)
// ---------------------------------------------------------------------------

export const internalUpsert = internalMutation({
  args: {
    _id: v.string(),
    displayName: v.string(),
    supportsTools: v.boolean(),
    lastSyncedAt: v.number(),
    contextWindow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = {
      displayName: args.displayName,
      supportsTools: args.supportsTools,
      lastSyncedAt: args.lastSyncedAt,
    };
    if (args.contextWindow !== undefined) {
      update.contextWindow = args.contextWindow;
    }
    await ctx.db.patch(args._id as Id<"modelRegistry">, update);
  },
});

export const internalInsert = internalMutation({
  args: {
    modelId: v.string(),
    displayName: v.string(),
    provider: v.union(v.literal("openai"), v.literal("openrouter"), v.literal("groq")),
    apiModel: v.string(),
    envKey: v.string(),
    enabled: v.boolean(),
    supportsTools: v.boolean(),
    sortOrder: v.number(),
    color: v.string(),
    lastSyncedAt: v.number(),
    contextWindow: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("modelRegistry", args);
  },
});
