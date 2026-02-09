import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ---------------------------------------------------------------------------
// Internal queries for customOrchestrator
// ---------------------------------------------------------------------------

export const getEvaluation = internalQuery({
  args: { id: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getSessionsByEvaluationAndModel = internalQuery({
  args: {
    evaluationId: v.id("customEvaluations"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customSessions")
      .withIndex("by_evaluationId_modelId", (q) =>
        q.eq("evaluationId", args.evaluationId).eq("modelId", args.modelId)
      )
      .collect();
  },
});

export const getAllSessions = internalQuery({
  args: { evaluationId: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customSessions")
      .withIndex("by_evaluationId", (q) =>
        q.eq("evaluationId", args.evaluationId)
      )
      .collect();
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getSessionStatus = internalQuery({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    return session?.status ?? null;
  },
});

export const getSessionMessages = internalQuery({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customMessages")
      .withIndex("by_sessionId_turnNumber", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Internal mutations for customOrchestrator
// ---------------------------------------------------------------------------

export const createSession = internalMutation({
  args: {
    evaluationId: v.id("customEvaluations"),
    scenarioLocalId: v.string(),
    personaLocalId: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customSessions", {
      evaluationId: args.evaluationId,
      scenarioLocalId: args.scenarioLocalId,
      personaLocalId: args.personaLocalId,
      modelId: args.modelId,
      status: "pending",
      totalTurns: 0,
    });
  },
});

export const createSessionsBatch = internalMutation({
  args: {
    sessions: v.array(
      v.object({
        evaluationId: v.id("customEvaluations"),
        scenarioLocalId: v.string(),
        personaLocalId: v.string(),
        modelId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const s of args.sessions) {
      await ctx.db.insert("customSessions", {
        ...s,
        status: "pending",
        totalTurns: 0,
      });
    }
  },
});

export const updateSessionStatus = internalMutation({
  args: {
    sessionId: v.id("customSessions"),
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

export const insertMessage = internalMutation({
  args: {
    sessionId: v.id("customSessions"),
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
    return await ctx.db.insert("customMessages", args);
  },
});

export const updateEvaluationStatus = internalMutation({
  args: {
    id: v.id("customEvaluations"),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("running"),
      v.literal("evaluating"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    errorMessage: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    await ctx.db.patch(id, update);
  },
});

export const updateEvaluationProgress = internalMutation({
  args: {
    id: v.id("customEvaluations"),
    progress: v.object({
      totalModels: v.number(),
      totalScenarios: v.number(),
      completedSessions: v.number(),
      totalSessions: v.number(),
      failedSessions: v.number(),
      currentPhase: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      progress: args.progress,
      updatedAt: Date.now(),
    });
  },
});
