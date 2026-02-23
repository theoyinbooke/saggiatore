import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

type RunStatus = "running" | "completed" | "failed";
type SessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "cancelled";
type MessageRole = "system" | "user" | "assistant" | "tool";

const RUN_STATUSES = new Set<RunStatus>(["running", "completed", "failed"]);
const SESSION_STATUSES = new Set<SessionStatus>([
  "pending",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
]);
const MESSAGE_ROLES = new Set<MessageRole>(["system", "user", "assistant", "tool"]);

const CATEGORIES = [
  "visa_application",
  "status_change",
  "family_immigration",
  "deportation_defense",
  "humanitarian",
] as const;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRunStatus(value: unknown): RunStatus {
  return RUN_STATUSES.has(value as RunStatus) ? (value as RunStatus) : "running";
}

function asSessionStatus(value: unknown): SessionStatus {
  return SESSION_STATUSES.has(value as SessionStatus)
    ? (value as SessionStatus)
    : "failed";
}

function asMessageRole(value: unknown): MessageRole {
  return MESSAGE_ROLES.has(value as MessageRole) ? (value as MessageRole) : "assistant";
}

function normalizeMetrics(raw: unknown):
  | {
      toolAccuracy: number;
      empathy: number;
      factualCorrectness: number;
      completeness: number;
      safetyCompliance: number;
    }
  | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    toolAccuracy: asNumber(obj.toolAccuracy),
    empathy: asNumber(obj.empathy),
    factualCorrectness: asNumber(obj.factualCorrectness),
    completeness: asNumber(obj.completeness),
    safetyCompliance: asNumber(obj.safetyCompliance),
  };
}

function normalizeCategoryScoresOptional(raw: unknown):
  | {
      visa_application?: number;
      status_change?: number;
      family_immigration?: number;
      deportation_defense?: number;
      humanitarian?: number;
    }
  | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    visa_application:
      obj.visa_application === undefined ? undefined : asNumber(obj.visa_application),
    status_change: obj.status_change === undefined ? undefined : asNumber(obj.status_change),
    family_immigration:
      obj.family_immigration === undefined ? undefined : asNumber(obj.family_immigration),
    deportation_defense:
      obj.deportation_defense === undefined ? undefined : asNumber(obj.deportation_defense),
    humanitarian: obj.humanitarian === undefined ? undefined : asNumber(obj.humanitarian),
  };
}

function normalizeCategoryScoresRequired(raw: unknown): {
  visa_application: number;
  status_change: number;
  family_immigration: number;
  deportation_defense: number;
  humanitarian: number;
} {
  const optional = normalizeCategoryScoresOptional(raw) ?? {};
  return {
    visa_application: optional.visa_application ?? 0,
    status_change: optional.status_change ?? 0,
    family_immigration: optional.family_immigration ?? 0,
    deportation_defense: optional.deportation_defense ?? 0,
    humanitarian: optional.humanitarian ?? 0,
  };
}

export const internalIngestPayload = internalMutation({
  args: { payload: v.any() },
  handler: async (ctx, args) => {
    if (!args.payload || typeof args.payload !== "object") {
      throw new Error("Invalid payload: expected object.");
    }

    const payload = args.payload as Record<string, unknown>;
    const runRaw = payload.run as Record<string, unknown> | undefined;
    if (!runRaw || typeof runRaw !== "object") {
      throw new Error("Invalid payload: missing run object.");
    }

    const runId = asString(runRaw.runId);
    if (!runId) {
      throw new Error("Invalid payload: run.runId is required.");
    }

    const now = Date.now();
    const runPatch = {
      runId,
      status: asRunStatus(runRaw.status),
      models: asStringArray(runRaw.models),
      scenarioCount: asNumber(runRaw.scenarioCount),
      totalSessions: asNumber(runRaw.totalSessions),
      completedSessions: asNumber(runRaw.completedSessions),
      failedSessions: asNumber(runRaw.failedSessions),
      galileoEnabled: asBoolean(runRaw.galileoEnabled),
      startedAt: asNumber(runRaw.startedAt, now),
      completedAt:
        runRaw.completedAt === undefined ? undefined : asNumber(runRaw.completedAt),
      lastError:
        runRaw.lastError === undefined ? undefined : asString(runRaw.lastError),
      sourceVersion:
        runRaw.sourceVersion === undefined ? undefined : asString(runRaw.sourceVersion),
      updatedAt: now,
    };

    const existingRun = await ctx.db
      .query("pythonRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .first();

    if (existingRun) {
      await ctx.db.patch(existingRun._id, runPatch);
    } else {
      await ctx.db.insert("pythonRuns", {
        ...runPatch,
        createdAt: now,
      });
    }

    const sessionRaw = payload.session as Record<string, unknown> | undefined;
    if (sessionRaw && typeof sessionRaw === "object") {
      const sessionKey = asString(sessionRaw.sessionKey);
      if (sessionKey) {
        const metrics = normalizeMetrics(sessionRaw.metrics);
        const sessionPatch = {
          runId,
          sessionKey,
          scenarioTitle: asString(sessionRaw.scenarioTitle),
          scenarioCategory: asString(sessionRaw.scenarioCategory),
          modelId: asString(sessionRaw.modelId),
          personaName: asString(sessionRaw.personaName),
          status: asSessionStatus(sessionRaw.status),
          totalTurns: asNumber(sessionRaw.totalTurns),
          overallScore: asNumber(sessionRaw.overallScore),
          metrics,
          failureAnalysis: asStringArray(sessionRaw.failureAnalysis),
          galileoTraceId:
            sessionRaw.galileoTraceId === undefined
              ? undefined
              : asString(sessionRaw.galileoTraceId),
          galileoConsoleUrl:
            sessionRaw.galileoConsoleUrl === undefined
              ? undefined
              : asString(sessionRaw.galileoConsoleUrl),
          startedAt:
            sessionRaw.startedAt === undefined
              ? undefined
              : asNumber(sessionRaw.startedAt),
          completedAt:
            sessionRaw.completedAt === undefined
              ? undefined
              : asNumber(sessionRaw.completedAt),
          updatedAt: now,
        };

        const existingSession = await ctx.db
          .query("pythonSessions")
          .withIndex("by_runId_sessionKey", (q) =>
            q.eq("runId", runId).eq("sessionKey", sessionKey)
          )
          .first();

        if (existingSession) {
          await ctx.db.patch(existingSession._id, sessionPatch);
        } else {
          await ctx.db.insert("pythonSessions", sessionPatch);
        }

        const messagesRaw = sessionRaw.messages;
        if (Array.isArray(messagesRaw)) {
          const existingMessages = await ctx.db
            .query("pythonMessages")
            .withIndex("by_runId_sessionKey", (q) =>
              q.eq("runId", runId).eq("sessionKey", sessionKey)
            )
            .collect();
          for (const msg of existingMessages) {
            await ctx.db.delete(msg._id);
          }

          for (const rawMsg of messagesRaw) {
            if (!rawMsg || typeof rawMsg !== "object") continue;
            const msg = rawMsg as Record<string, unknown>;
            await ctx.db.insert("pythonMessages", {
              runId,
              sessionKey,
              role: asMessageRole(msg.role),
              content: asString(msg.content),
              turnNumber: asNumber(msg.turnNumber),
              toolCalls: Array.isArray(msg.toolCalls)
                ? msg.toolCalls
                    .filter((item) => item && typeof item === "object")
                    .map((item) => {
                      const tc = item as Record<string, unknown>;
                      return {
                        id: asString(tc.id),
                        name: asString(tc.name),
                        arguments: asString(tc.arguments),
                      };
                    })
                : undefined,
              toolCallId:
                msg.toolCallId === undefined ? undefined : asString(msg.toolCallId),
              timestamp: asNumber(msg.timestamp, now),
            });
          }
        }

        const evaluationRaw = sessionRaw.evaluation as Record<string, unknown> | undefined;
        if (evaluationRaw && typeof evaluationRaw === "object") {
          const evalMetrics = normalizeMetrics(evaluationRaw.metrics);
          if (evalMetrics) {
            const evalPatch = {
              runId,
              sessionKey,
              modelId: asString(sessionRaw.modelId),
              scenarioCategory: asString(sessionRaw.scenarioCategory),
              overallScore: asNumber(evaluationRaw.overallScore),
              metrics: evalMetrics,
              categoryScores: normalizeCategoryScoresOptional(
                evaluationRaw.categoryScores
              ),
              failureAnalysis: asStringArray(evaluationRaw.failureAnalysis),
              galileoTraceId:
                evaluationRaw.galileoTraceId === undefined
                  ? undefined
                  : asString(evaluationRaw.galileoTraceId),
              galileoConsoleUrl:
                evaluationRaw.galileoConsoleUrl === undefined
                  ? undefined
                  : asString(evaluationRaw.galileoConsoleUrl),
              evaluatedAt: asNumber(evaluationRaw.evaluatedAt, now),
            };

            const existingEvaluation = await ctx.db
              .query("pythonEvaluations")
              .withIndex("by_runId_sessionKey", (q) =>
                q.eq("runId", runId).eq("sessionKey", sessionKey)
              )
              .first();

            if (existingEvaluation) {
              await ctx.db.patch(existingEvaluation._id, evalPatch);
            } else {
              await ctx.db.insert("pythonEvaluations", evalPatch);
            }
          }
        }
      }
    }

    const leaderboardRaw = payload.leaderboard;
    if (Array.isArray(leaderboardRaw)) {
      const existingEntries = await ctx.db
        .query("pythonLeaderboard")
        .withIndex("by_runId", (q) => q.eq("runId", runId))
        .collect();
      for (const row of existingEntries) {
        await ctx.db.delete(row._id);
      }

      let fallbackRank = 1;
      for (const rawEntry of leaderboardRaw) {
        if (!rawEntry || typeof rawEntry !== "object") continue;
        const entry = rawEntry as Record<string, unknown>;
        const metrics = normalizeMetrics(entry.metrics);
        if (!metrics) continue;

        const rank = asNumber(entry.rank, fallbackRank);
        await ctx.db.insert("pythonLeaderboard", {
          runId,
          rank: rank <= 0 ? fallbackRank : rank,
          modelId: asString(entry.modelId),
          overallScore: asNumber(entry.overallScore),
          totalEvaluations: asNumber(entry.totalEvaluations),
          metrics,
          categoryScores: normalizeCategoryScoresRequired(entry.categoryScores),
          updatedAt: now,
        });
        fallbackRank += 1;
      }
    }

    return { ok: true, runId };
  },
});

export const listRuns = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const rows = await ctx.db.query("pythonRuns").order("desc").take(limit);
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },
});

export const getRun = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pythonRuns")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .first();
  },
});

export const leaderboardByRun = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pythonLeaderboard")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
    return rows.sort((a, b) => a.rank - b.rank);
  },
});

export const sessionsByRun = query({
  args: { runId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
    const rows = await ctx.db
      .query("pythonSessions")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  },
});

export const messagesBySession = query({
  args: { runId: v.string(), sessionKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pythonMessages")
      .withIndex("by_runId_sessionKey_turnNumber", (q) =>
        q.eq("runId", args.runId).eq("sessionKey", args.sessionKey)
      )
      .collect();
  },
});

export const latestLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const runs = await ctx.db.query("pythonRuns").order("desc").take(50);
    if (runs.length === 0) return null;

    const latestCompleted =
      runs.find((run) => run.status === "completed") ??
      runs.sort((a, b) => b.startedAt - a.startedAt)[0];
    if (!latestCompleted) return null;

    const entries = await ctx.db
      .query("pythonLeaderboard")
      .withIndex("by_runId", (q) => q.eq("runId", latestCompleted.runId))
      .collect();

    return {
      run: latestCompleted,
      entries: entries.sort((a, b) => a.rank - b.rank),
    };
  },
});

export const categoryList = query({
  args: {},
  handler: async () => CATEGORIES,
});
