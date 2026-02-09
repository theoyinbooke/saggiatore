import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lists scenarios that have been run (have at least one session).
 * Returns summary info per scenario for the admin Ran Scenarios table.
 */
export const listRanScenarios = query({
  args: {},
  handler: async (ctx) => {
    const scenarios = await ctx.db.query("scenarios").collect();
    const results = [];

    for (const scenario of scenarios) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_scenarioId", (q) => q.eq("scenarioId", scenario._id))
        .collect();

      if (sessions.length === 0) continue;

      const completedSessions = sessions.filter((s) => s.status === "completed");
      const modelIds = [...new Set(sessions.map((s) => s.modelId))];

      // Check if any session has an evaluation
      let hasEvaluations = false;
      for (const session of completedSessions) {
        const evaluation = await ctx.db
          .query("evaluations")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
          .first();
        if (evaluation) {
          hasEvaluations = true;
          break;
        }
      }

      results.push({
        _id: scenario._id,
        title: scenario.title,
        category: scenario.category,
        complexity: scenario.complexity,
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        modelIds,
        hasEvaluations,
      });
    }

    return results;
  },
});

/**
 * Deletes all session data for a specific scenario (sessions, messages, evaluations).
 * Does NOT delete the scenario definition itself.
 * Recalculates leaderboard for affected models afterward.
 */
export const deleteScenarioData = mutation({
  args: { scenarioId: v.id("scenarios") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_scenarioId", (q) => q.eq("scenarioId", args.scenarioId))
      .collect();

    const affectedModelIds = [...new Set(sessions.map((s) => s.modelId))];

    let deletedMessages = 0;
    let deletedEvaluations = 0;
    let deletedSessions = 0;

    for (const session of sessions) {
      // Delete messages
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
        deletedMessages++;
      }

      // Delete evaluations
      const evaluations = await ctx.db
        .query("evaluations")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const ev of evaluations) {
        await ctx.db.delete(ev._id);
        deletedEvaluations++;
      }

      // Delete session
      await ctx.db.delete(session._id);
      deletedSessions++;
    }

    // Recalculate leaderboard for each affected model
    const recalculatedModels: string[] = [];

    for (const modelId of affectedModelIds) {
      const remainingSessions = await ctx.db
        .query("sessions")
        .withIndex("by_modelId", (q) => q.eq("modelId", modelId))
        .collect();

      const completedSessions = remainingSessions.filter(
        (s) => s.status === "completed"
      );

      const existing = await ctx.db
        .query("leaderboard")
        .withIndex("by_modelId", (q) => q.eq("modelId", modelId))
        .first();

      if (completedSessions.length === 0) {
        // No remaining sessions — delete leaderboard entry
        if (existing) {
          await ctx.db.delete(existing._id);
        }
        recalculatedModels.push(modelId);
        continue;
      }

      // Gather evaluations for remaining completed sessions
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

      if (evaluations.length === 0) {
        if (existing) {
          await ctx.db.delete(existing._id);
        }
        recalculatedModels.push(modelId);
        continue;
      }

      // Recalculate averages
      const count = evaluations.length;
      const avgMetrics = {
        toolAccuracy:
          evaluations.reduce((s, e) => s + e.evaluation.metrics.toolAccuracy, 0) / count,
        empathy:
          evaluations.reduce((s, e) => s + e.evaluation.metrics.empathy, 0) / count,
        factualCorrectness:
          evaluations.reduce((s, e) => s + e.evaluation.metrics.factualCorrectness, 0) / count,
        completeness:
          evaluations.reduce((s, e) => s + e.evaluation.metrics.completeness, 0) / count,
        safetyCompliance:
          evaluations.reduce((s, e) => s + e.evaluation.metrics.safetyCompliance, 0) / count,
      };

      const overallScore =
        (avgMetrics.toolAccuracy +
          avgMetrics.empathy +
          avgMetrics.factualCorrectness +
          avgMetrics.completeness +
          avgMetrics.safetyCompliance) / 5;

      const categories = [
        "visa_application",
        "status_change",
        "family_immigration",
        "deportation_defense",
        "humanitarian",
      ] as const;

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

      const data = {
        modelId,
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
      } else {
        await ctx.db.insert("leaderboard", data);
      }

      recalculatedModels.push(modelId);
    }

    return {
      deleted: {
        sessions: deletedSessions,
        messages: deletedMessages,
        evaluations: deletedEvaluations,
      },
      recalculatedModels,
    };
  },
});
