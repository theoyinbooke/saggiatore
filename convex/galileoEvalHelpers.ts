import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// Internal queries/mutations for galileoEval
// These run in the Convex runtime (not Node.js)

export const storeEvaluation = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    overallScore: v.number(),
    metrics: v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    }),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
    failureAnalysis: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const evalId = await ctx.db.insert("evaluations", {
      sessionId: args.sessionId,
      overallScore: args.overallScore,
      metrics: args.metrics,
      galileoTraceId: args.galileoTraceId,
      galileoConsoleUrl: args.galileoConsoleUrl,
      failureAnalysis: args.failureAnalysis,
      evaluatedAt: Date.now(),
    });
    return evalId;
  },
});

export const updateLeaderboard = internalMutation({
  args: {
    modelId: v.string(),
    metrics: v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    }),
    overallScore: v.number(),
    categoryScores: v.optional(
      v.object({
        visa_application: v.number(),
        status_change: v.number(),
        family_immigration: v.number(),
        deportation_defense: v.number(),
        humanitarian: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .unique();

    if (existing) {
      const n = existing.totalEvaluations;
      const newN = n + 1;
      const avg = (oldVal: number, newVal: number) =>
        (oldVal * n + newVal) / newN;

      const updatedMetrics: typeof args.metrics = {
        toolAccuracy: avg(existing.metrics.toolAccuracy, args.metrics.toolAccuracy),
        empathy: avg(existing.metrics.empathy, args.metrics.empathy),
        factualCorrectness: avg(
          existing.metrics.factualCorrectness,
          args.metrics.factualCorrectness
        ),
        completeness: avg(existing.metrics.completeness, args.metrics.completeness),
        safetyCompliance: avg(
          existing.metrics.safetyCompliance,
          args.metrics.safetyCompliance
        ),
      };

      let updatedCategoryScores = existing.categoryScores;
      if (args.categoryScores) {
        updatedCategoryScores = {
          visa_application: avg(
            existing.categoryScores.visa_application,
            args.categoryScores.visa_application
          ),
          status_change: avg(
            existing.categoryScores.status_change,
            args.categoryScores.status_change
          ),
          family_immigration: avg(
            existing.categoryScores.family_immigration,
            args.categoryScores.family_immigration
          ),
          deportation_defense: avg(
            existing.categoryScores.deportation_defense,
            args.categoryScores.deportation_defense
          ),
          humanitarian: avg(
            existing.categoryScores.humanitarian,
            args.categoryScores.humanitarian
          ),
        };
      }

      await ctx.db.patch(existing._id, {
        overallScore: avg(existing.overallScore, args.overallScore),
        totalEvaluations: newN,
        metrics: updatedMetrics,
        categoryScores: updatedCategoryScores,
        lastUpdated: Date.now(),
      });
    } else {
      await ctx.db.insert("leaderboard", {
        modelId: args.modelId,
        overallScore: args.overallScore,
        totalEvaluations: 1,
        metrics: args.metrics,
        categoryScores: args.categoryScores ?? {
          visa_application: 0,
          status_change: 0,
          family_immigration: 0,
          deportation_defense: 0,
          humanitarian: 0,
        },
        lastUpdated: Date.now(),
      });
    }
  },
});

export const getSession = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const getSessionMessages = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getScenario = internalQuery({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scenarioId);
  },
});
