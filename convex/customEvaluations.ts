import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, getUserIdFromIdentity } from "./authHelpers";

export const create = mutation({
  args: {
    userId: v.string(),
    title: v.string(),
    useCaseDescription: v.string(),
    selectedModelIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    return await ctx.db.insert("customEvaluations", {
      userId,
      title: args.title,
      useCaseDescription: args.useCaseDescription,
      selectedModelIds: args.selectedModelIds,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getById = query({
  args: { id: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const eval_ = await ctx.db.get(args.id);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");
    return eval_;
  },
});

export const getByShareId = query({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customEvaluations")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, _args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const results = await ctx.db
      .query("customEvaluations")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return results.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("customEvaluations"),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("running"),
      v.literal("evaluating"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    errorMessage: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    progress: v.optional(
      v.object({
        totalModels: v.number(),
        totalScenarios: v.number(),
        completedSessions: v.number(),
        totalSessions: v.number(),
        failedSessions: v.number(),
        currentPhase: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const eval_ = await ctx.db.get(args.id);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");
    const { id, ...fields } = args;
    const update: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    await ctx.db.patch(id, update);
  },
});

export const updateGeneratedConfig = mutation({
  args: {
    id: v.id("customEvaluations"),
    generatedConfig: v.object({
      domain: v.string(),
      agentSystemPrompt: v.string(),
      personas: v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          role: v.string(),
          backstory: v.string(),
          goals: v.array(v.string()),
          challenges: v.array(v.string()),
          traits: v.array(v.string()),
        })
      ),
      tools: v.array(
        v.object({
          name: v.string(),
          description: v.string(),
          category: v.string(),
          parameters: v.array(
            v.object({
              name: v.string(),
              type: v.string(),
              description: v.string(),
              required: v.boolean(),
            })
          ),
          returnType: v.string(),
          returnDescription: v.string(),
        })
      ),
      scenarios: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          category: v.string(),
          complexity: v.string(),
          description: v.string(),
          personaId: v.string(),
          expectedTools: v.array(v.string()),
          successCriteria: v.array(v.string()),
          maxTurns: v.number(),
        })
      ),
      categories: v.array(
        v.object({
          id: v.string(),
          displayName: v.string(),
        })
      ),
      metrics: v.array(
        v.object({
          key: v.string(),
          displayName: v.string(),
          description: v.string(),
          weight: v.number(),
        })
      ),
    }),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const eval_ = await ctx.db.get(args.id);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");
    const update: Record<string, unknown> = {
      generatedConfig: args.generatedConfig,
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) {
      update.title = args.title;
    }
    await ctx.db.patch(args.id, update);
  },
});

export const generateShareLink = mutation({
  args: { id: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const eval_ = await ctx.db.get(args.id);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");
    const shareId = crypto.randomUUID();
    await ctx.db.patch(args.id, { shareId, updatedAt: Date.now() });
    return shareId;
  },
});

export const cancelEvaluation = mutation({
  args: { id: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const eval_ = await ctx.db.get(args.id);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");
    if (eval_.status !== "running" && eval_.status !== "evaluating") {
      throw new Error("Can only cancel running or evaluating evaluations");
    }

    // Mark evaluation as cancelled
    await ctx.db.patch(args.id, {
      status: "cancelled",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Cancel all pending/running sessions
    const sessions = await ctx.db
      .query("customSessions")
      .withIndex("by_evaluationId", (q) => q.eq("evaluationId", args.id))
      .collect();
    for (const session of sessions) {
      if (session.status === "pending" || session.status === "running") {
        await ctx.db.patch(session._id, {
          status: "cancelled",
          completedAt: Date.now(),
        });
      }
    }
  },
});

export const deleteEvaluation = mutation({
  args: { id: v.id("customEvaluations") },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);
    const eval_ = await ctx.db.get(args.id);
    if (!eval_ || eval_.userId !== userId) throw new Error("Not authorized");

    // Cascade delete: customLeaderboard
    const leaderboardEntries = await ctx.db
      .query("customLeaderboard")
      .withIndex("by_evaluationId", (q) => q.eq("evaluationId", args.id))
      .collect();
    for (const entry of leaderboardEntries) {
      await ctx.db.delete(entry._id);
    }

    // Cascade delete: customSessionEvaluations
    const sessionEvals = await ctx.db
      .query("customSessionEvaluations")
      .withIndex("by_evaluationId", (q) => q.eq("evaluationId", args.id))
      .collect();
    for (const se of sessionEvals) {
      await ctx.db.delete(se._id);
    }

    // Cascade delete: customMessages (need sessions first)
    const sessions = await ctx.db
      .query("customSessions")
      .withIndex("by_evaluationId", (q) => q.eq("evaluationId", args.id))
      .collect();
    for (const session of sessions) {
      const messages = await ctx.db
        .query("customMessages")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }
      await ctx.db.delete(session._id);
    }

    // Delete the evaluation itself
    await ctx.db.delete(args.id);
  },
});
