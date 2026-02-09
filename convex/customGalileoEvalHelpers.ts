import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ---------------------------------------------------------------------------
// Internal queries
// ---------------------------------------------------------------------------

export const getSession = internalQuery({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getSessionMessages = internalQuery({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getAllSessionEvaluations = internalQuery({
  args: { evaluationId: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customSessionEvaluations")
      .withIndex("by_evaluationId", (q) =>
        q.eq("evaluationId", args.evaluationId)
      )
      .collect();
  },
});

export const getEvaluation = internalQuery({
  args: { id: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getSessionsByEvaluation = internalQuery({
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

// ---------------------------------------------------------------------------
// Internal mutations
// ---------------------------------------------------------------------------

export const storeSessionEvaluation = internalMutation({
  args: {
    sessionId: v.id("customSessions"),
    evaluationId: v.id("customEvaluations"),
    overallScore: v.number(),
    metricScores: v.any(),
    categoryScore: v.optional(
      v.object({
        category: v.string(),
        score: v.number(),
      })
    ),
    failureAnalysis: v.optional(v.array(v.string())),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
    scoringSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customSessionEvaluations", {
      sessionId: args.sessionId,
      evaluationId: args.evaluationId,
      overallScore: args.overallScore,
      metricScores: args.metricScores,
      categoryScore: args.categoryScore,
      failureAnalysis: args.failureAnalysis,
      galileoTraceId: args.galileoTraceId,
      galileoConsoleUrl: args.galileoConsoleUrl,
      scoringSource: args.scoringSource,
      evaluatedAt: Date.now(),
    });
  },
});

export const upsertLeaderboard = internalMutation({
  args: {
    evaluationId: v.id("customEvaluations"),
    modelId: v.string(),
    overallScore: v.number(),
    totalSessions: v.number(),
    metricScores: v.any(),
    categoryScores: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customLeaderboard")
      .withIndex("by_evaluationId_modelId", (q) =>
        q
          .eq("evaluationId", args.evaluationId)
          .eq("modelId", args.modelId)
      )
      .first();

    const data = {
      evaluationId: args.evaluationId,
      modelId: args.modelId,
      overallScore: args.overallScore,
      totalSessions: args.totalSessions,
      metricScores: args.metricScores,
      categoryScores: args.categoryScores,
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("customLeaderboard", data);
    }
  },
});

export const storeGalileoSetupError = internalMutation({
  args: {
    id: v.id("customEvaluations"),
    galileoSetupError: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      galileoSetupError: args.galileoSetupError,
      updatedAt: Date.now(),
    });
  },
});

export const storeGalileoProjectInfo = internalMutation({
  args: {
    id: v.id("customEvaluations"),
    galileoProjectName: v.string(),
    galileoProjectId: v.optional(v.string()),
    galileoLogStreamName: v.string(),
    galileoMetricMapping: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      galileoProjectName: args.galileoProjectName,
      ...(args.galileoProjectId ? { galileoProjectId: args.galileoProjectId } : {}),
      galileoLogStreamName: args.galileoLogStreamName,
      galileoMetricMapping: args.galileoMetricMapping,
      updatedAt: Date.now(),
    });
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
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
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
