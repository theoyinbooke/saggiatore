import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const listByEvaluation = internalQuery({
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

export const listByEvaluationAndModel = internalQuery({
  args: {
    evaluationId: v.id("customEvaluations"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customSessions")
      .withIndex("by_evaluationId_modelId", (q) =>
        q
          .eq("evaluationId", args.evaluationId)
          .eq("modelId", args.modelId)
      )
      .collect();
  },
});

export const getById = internalQuery({
  args: { id: v.id("customSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
