import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./authHelpers";

export const create = mutation({
  args: {
    scenarioId: v.id("scenarios"),
    personaId: v.id("personas"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      scenarioId: args.scenarioId,
      personaId: args.personaId,
      modelId: args.modelId,
      status: "pending",
      totalTurns: 0,
    });
  },
});

export const getById = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("sessions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("cancelled")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    totalTurns: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Remove undefined fields
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    await ctx.db.patch(id, update);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sessions").order("desc").collect();
  },
});

export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const cancelSession = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    if (session.status !== "running" && session.status !== "pending") {
      return { status: session.status };
    }
    await ctx.db.patch(args.id, {
      status: "cancelled",
      completedAt: Date.now(),
    });
    return { status: "cancelled" as const };
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const running = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const pending = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return [...pending, ...running];
  },
});

export const listActiveBatch = query({
  args: {},
  handler: async (ctx) => {
    // 1. Find running/pending sessions
    const running = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const pending = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const active = [...pending, ...running];

    if (active.length === 0) return [];

    // 2. Pick the scenario with the most active sessions
    const countByScenario = new Map<Id<"scenarios">, number>();
    for (const s of active) {
      countByScenario.set(s.scenarioId, (countByScenario.get(s.scenarioId) ?? 0) + 1);
    }
    const topScenarioId = [...countByScenario.entries()]
      .sort((a, b) => b[1] - a[1])[0][0];

    // 3. Get ALL sessions for that scenario
    const allForScenario = await ctx.db
      .query("sessions")
      .withIndex("by_scenarioId", (q) => q.eq("scenarioId", topScenarioId))
      .collect();

    // 4. Find the batch — active sessions share a creation-time window
    const activeTimestamps = active
      .filter((s) => s.scenarioId === topScenarioId)
      .map((s) => s._creationTime);
    const minTime = Math.min(...activeTimestamps);
    const maxTime = Math.max(...activeTimestamps);

    // Return all sessions created within ±30s of the active batch
    return allForScenario.filter(
      (s) => s._creationTime >= minTime - 30_000 && s._creationTime <= maxTime + 30_000
    );
  },
});

export const listByModel = query({
  args: { modelId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_modelId", (q) => q.eq("modelId", args.modelId))
      .collect();
  },
});
