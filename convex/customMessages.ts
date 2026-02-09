import { query, internalQuery } from "./_generated/server";
import { requireAuth, getUserIdFromIdentity } from "./authHelpers";
import { v } from "convex/values";

export const bySession = internalQuery({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const bySessionOrdered = internalQuery({
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

export const bySessionPublic = query({
  args: { sessionId: v.id("customSessions") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    const eval_ = await ctx.db.get(session.evaluationId);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");
    return await ctx.db
      .query("customMessages")
      .withIndex("by_sessionId_turnNumber", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});
