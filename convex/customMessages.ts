import { internalQuery } from "./_generated/server";
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
