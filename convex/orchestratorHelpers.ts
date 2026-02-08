import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Internal queries/mutations for the orchestrator
// These run in the Convex runtime (not Node.js)

export const getScenario = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scenarioId);
  },
});

export const getPersona = internalQuery({
  args: { personaId: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.personaId);
  },
});

export const getAllTools = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tools").collect();
  },
});

export const createSession = internalMutation({
  args: {
    scenarioId: v.id("scenarios"),
    personaId: v.id("personas"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      scenarioId: args.scenarioId,
      personaId: args.personaId,
      modelId: args.modelId,
      status: "pending",
      totalTurns: 0,
    });
  },
});

export const updateSessionStatus = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("cancelled")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    totalTurns: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...fields } = args;
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    await ctx.db.patch(sessionId, update);
  },
});

export const getSessionStatus = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session?.status ?? null;
  },
});

export const insertMessage = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool")
    ),
    content: v.string(),
    turnNumber: v.number(),
    toolCalls: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          arguments: v.string(),
        })
      )
    ),
    toolCallId: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", args);
  },
});
