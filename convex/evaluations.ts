import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const metricsValidator = v.object({
  toolAccuracy: v.number(),
  empathy: v.number(),
  factualCorrectness: v.number(),
  completeness: v.number(),
  safetyCompliance: v.number(),
});

const categoryScoresValidator = v.optional(
  v.object({
    visa_application: v.optional(v.number()),
    status_change: v.optional(v.number()),
    family_immigration: v.optional(v.number()),
    deportation_defense: v.optional(v.number()),
    humanitarian: v.optional(v.number()),
  })
);

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    overallScore: v.number(),
    metrics: metricsValidator,
    categoryScores: categoryScoresValidator,
    failureAnalysis: v.optional(v.array(v.string())),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("evaluations", {
      ...args,
      evaluatedAt: Date.now(),
    });
  },
});

export const bySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("evaluations")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("evaluations").order("desc").take(50);
  },
});
