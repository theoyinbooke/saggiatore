import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getUserIdFromIdentity } from "./authHelpers";

async function verifyEvaluationAccess(
  ctx: QueryCtx,
  evaluationId: Id<"customEvaluations">
) {
  const eval_ = await ctx.db.get(evaluationId);
  if (!eval_) throw new Error("Evaluation not found");

  const identity = await ctx.auth.getUserIdentity();
  if (identity) {
    // Authenticated: must be the owner
    if (eval_.userId !== getUserIdFromIdentity(identity))
      throw new Error("Not authorized");
  } else {
    // Unauthenticated: evaluation must have been explicitly shared
    if (!eval_.shareId) throw new Error("Not authorized");
  }
  return eval_;
}

export const getByEvaluation = query({
  args: { evaluationId: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    await verifyEvaluationAccess(ctx, args.evaluationId);
    const entries = await ctx.db
      .query("customLeaderboard")
      .withIndex("by_evaluationId", (q) =>
        q.eq("evaluationId", args.evaluationId)
      )
      .collect();
    return entries.sort((a, b) => b.overallScore - a.overallScore);
  },
});

export const getTopByEvaluation = query({
  args: { evaluationId: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    await verifyEvaluationAccess(ctx, args.evaluationId);
    const entries = await ctx.db
      .query("customLeaderboard")
      .withIndex("by_evaluationId", (q) =>
        q.eq("evaluationId", args.evaluationId)
      )
      .collect();
    if (entries.length === 0) return null;
    entries.sort((a, b) => b.overallScore - a.overallScore);
    return entries[0];
  },
});

export const getByEvaluationAndModel = query({
  args: {
    evaluationId: v.id("customEvaluations"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyEvaluationAccess(ctx, args.evaluationId);
    return await ctx.db
      .query("customLeaderboard")
      .withIndex("by_evaluationId_modelId", (q) =>
        q
          .eq("evaluationId", args.evaluationId)
          .eq("modelId", args.modelId)
      )
      .first();
  },
});
