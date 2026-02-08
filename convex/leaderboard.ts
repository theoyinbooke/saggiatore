import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const metricsValidator = v.object({
  toolAccuracy: v.number(),
  empathy: v.number(),
  factualCorrectness: v.number(),
  completeness: v.number(),
  safetyCompliance: v.number(),
});

const categoryScoresValidator = v.object({
  visa_application: v.number(),
  status_change: v.number(),
  family_immigration: v.number(),
  deportation_defense: v.number(),
  humanitarian: v.number(),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("leaderboard").collect();
    return entries.sort((a, b) => b.overallScore - a.overallScore);
  },
});

export const getByModel = query({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leaderboard")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .first();
  },
});

export const update = mutation({
  args: {
    modelId: v.string(),
    overallScore: v.number(),
    totalEvaluations: v.number(),
    metrics: metricsValidator,
    categoryScores: categoryScoresValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .first();

    const data = {
      modelId: args.modelId,
      overallScore: args.overallScore,
      totalEvaluations: args.totalEvaluations,
      metrics: args.metrics,
      categoryScores: args.categoryScores,
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("leaderboard", data);
    }
  },
});

export const byScenario = query({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, args) => {
    const scenario = await ctx.db.get(args.scenarioId);
    if (!scenario) return [];

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_scenarioId", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();

    const completedSessions = sessions.filter(
      (s) => s.status === "completed"
    );

    if (completedSessions.length === 0) return [];

    // Group sessions by modelId
    const byModel: Record<
      string,
      Array<{ sessionId: string }>
    > = {};
    for (const s of completedSessions) {
      if (!byModel[s.modelId]) byModel[s.modelId] = [];
      byModel[s.modelId].push({ sessionId: s._id });
    }

    const entries = [];

    for (const [modelId, modelSessions] of Object.entries(byModel)) {
      const evaluations = [];
      for (const { sessionId } of modelSessions) {
        const evaluation = await ctx.db
          .query("evaluations")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId as any))
          .first();
        if (evaluation) evaluations.push(evaluation);
      }

      if (evaluations.length === 0) continue;

      const count = evaluations.length;
      const avgMetrics = {
        toolAccuracy:
          evaluations.reduce((s, e) => s + e.metrics.toolAccuracy, 0) / count,
        empathy:
          evaluations.reduce((s, e) => s + e.metrics.empathy, 0) / count,
        factualCorrectness:
          evaluations.reduce((s, e) => s + e.metrics.factualCorrectness, 0) /
          count,
        completeness:
          evaluations.reduce((s, e) => s + e.metrics.completeness, 0) / count,
        safetyCompliance:
          evaluations.reduce((s, e) => s + e.metrics.safetyCompliance, 0) /
          count,
      };

      const overallScore =
        evaluations.reduce((s, e) => s + e.overallScore, 0) / count;

      const categoryScores = {
        visa_application: 0,
        status_change: 0,
        family_immigration: 0,
        deportation_defense: 0,
        humanitarian: 0,
      };
      categoryScores[scenario.category] = overallScore;

      entries.push({
        _id: `scenario-lb-${modelId}`,
        modelId,
        overallScore,
        totalEvaluations: count,
        metrics: avgMetrics,
        categoryScores,
        lastUpdated: Date.now(),
      });
    }

    return entries.sort((a, b) => b.overallScore - a.overallScore);
  },
});

export const recalculate = mutation({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    // Get all sessions for this model
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .collect();

    const completedSessions = sessions.filter(
      (s) => s.status === "completed"
    );

    if (completedSessions.length === 0) return null;

    // Get evaluations for completed sessions
    const evaluations = [];
    for (const session of completedSessions) {
      const evaluation = await ctx.db
        .query("evaluations")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .first();
      if (evaluation) {
        evaluations.push({ evaluation, session });
      }
    }

    if (evaluations.length === 0) return null;

    // Calculate averages
    const count = evaluations.length;
    const avgMetrics = {
      toolAccuracy:
        evaluations.reduce((s, e) => s + e.evaluation.metrics.toolAccuracy, 0) /
        count,
      empathy:
        evaluations.reduce((s, e) => s + e.evaluation.metrics.empathy, 0) /
        count,
      factualCorrectness:
        evaluations.reduce(
          (s, e) => s + e.evaluation.metrics.factualCorrectness,
          0
        ) / count,
      completeness:
        evaluations.reduce(
          (s, e) => s + e.evaluation.metrics.completeness,
          0
        ) / count,
      safetyCompliance:
        evaluations.reduce(
          (s, e) => s + e.evaluation.metrics.safetyCompliance,
          0
        ) / count,
    };

    const overallScore =
      (avgMetrics.toolAccuracy +
        avgMetrics.empathy +
        avgMetrics.factualCorrectness +
        avgMetrics.completeness +
        avgMetrics.safetyCompliance) /
      5;

    // Calculate per-category scores
    const categories = [
      "visa_application",
      "status_change",
      "family_immigration",
      "deportation_defense",
      "humanitarian",
    ] as const;

    // Get scenario info to map sessions to categories
    const categoryScores: Record<string, number> = {};
    for (const cat of categories) {
      const catEvals = [];
      for (const { evaluation, session } of evaluations) {
        const scenario = await ctx.db.get(session.scenarioId);
        if (scenario && scenario.category === cat) {
          catEvals.push(evaluation);
        }
      }
      categoryScores[cat] =
        catEvals.length > 0
          ? catEvals.reduce((s, e) => s + e.overallScore, 0) / catEvals.length
          : 0;
    }

    // Upsert leaderboard entry
    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .first();

    const data = {
      modelId: args.modelId,
      overallScore,
      totalEvaluations: count,
      metrics: avgMetrics,
      categoryScores: categoryScores as {
        visa_application: number;
        status_change: number;
        family_immigration: number;
        deportation_defense: number;
        humanitarian: number;
      },
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    } else {
      return await ctx.db.insert("leaderboard", data);
    }
  },
});
