import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("scenarios").collect();
  },
});

export const getById = query({
  args: { id: v.id("scenarios") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByCategory = query({
  args: {
    category: v.union(
      v.literal("visa_application"),
      v.literal("status_change"),
      v.literal("family_immigration"),
      v.literal("deportation_defense"),
      v.literal("humanitarian")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenarios")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

export const listByComplexity = query({
  args: {
    complexity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenarios")
      .withIndex("by_complexity", (q) => q.eq("complexity", args.complexity))
      .collect();
  },
});

export const evaluatedScenarioIds = query({
  args: {},
  handler: async (ctx) => {
    const evaluations = await ctx.db.query("evaluations").collect();
    const scenarioIds = new Set<string>();
    for (const evaluation of evaluations) {
      const session = await ctx.db.get(evaluation.sessionId);
      if (session) scenarioIds.add(session.scenarioId as string);
    }
    return [...scenarioIds];
  },
});
