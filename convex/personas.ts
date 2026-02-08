import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("personas").collect();
  },
});

export const getById = query({
  args: { id: v.id("personas") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByVisaType = query({
  args: { visaType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personas")
      .withIndex("by_visaType", (q) => q.eq("visaType", args.visaType))
      .collect();
  },
});

export const listByComplexity = query({
  args: {
    complexityLevel: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personas")
      .withIndex("by_complexityLevel", (q) =>
        q.eq("complexityLevel", args.complexityLevel)
      )
      .collect();
  },
});
