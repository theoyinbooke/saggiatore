"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  init as galileoInit,
  GalileoLogger,
  createCustomLlmMetric,
  enableMetrics,
  getProject,
  getLogStream,
  getTraces,
} from "galileo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedMetric {
  key: string;
  displayName: string;
  description: string;
  weight: number;
}

interface MetricMapping {
  galileoName: string;
  isBuiltIn: boolean;
  isInverted?: boolean;
}

interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  turnNumber: number;
  toolCalls?: { id: string; name: string; arguments: string }[];
  toolCallId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeWeightedScore(
  metricScores: Record<string, number>,
  metrics: GeneratedMetric[]
): number {
  let total = 0;
  for (const m of metrics) {
    total += (metricScores[m.key] ?? 0) * m.weight;
  }
  return Math.round(total * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Metric mapping — map generated metric keys to Galileo built-in scorers
// ---------------------------------------------------------------------------

function mapMetricToGalileo(
  key: string,
  description: string
): MetricMapping | null {
  const k = key.toLowerCase();
  const d = description.toLowerCase();

  if (k.includes("accuracy") || k.includes("correctness") || k.includes("factual") || d.includes("factual")) {
    return { galileoName: "correctness", isBuiltIn: true };
  }
  if (k.includes("completeness") || k.includes("thorough") || d.includes("completeness")) {
    return { galileoName: "completeness", isBuiltIn: true };
  }
  if ((k.includes("tool") && (k.includes("selection") || k.includes("quality") || k.includes("usage"))) ||
      (d.includes("tool") && d.includes("selection"))) {
    return { galileoName: "tool_selection_quality", isBuiltIn: true };
  }
  if (k.includes("tool") && k.includes("error")) {
    return { galileoName: "tool_error_rate", isBuiltIn: true, isInverted: true };
  }
  if (k.includes("safety") || k.includes("toxic") || k.includes("harm") || d.includes("toxicity")) {
    return { galileoName: "output_toxicity", isBuiltIn: true, isInverted: true };
  }
  if (k.includes("pii") || k.includes("privacy") || d.includes("pii")) {
    return { galileoName: "output_pii_gpt", isBuiltIn: true, isInverted: true };
  }
  if (k.includes("injection") || d.includes("injection")) {
    return { galileoName: "prompt_injection", isBuiltIn: true, isInverted: true };
  }
  if (k.includes("instruction") || k.includes("adherence") || d.includes("instruction adherence")) {
    return { galileoName: "instruction_adherence", isBuiltIn: true };
  }
  if (k.includes("conversation") && k.includes("quality")) {
    return { galileoName: "conversation_quality", isBuiltIn: true };
  }
  if (k.includes("efficiency") || d.includes("efficiency")) {
    return { galileoName: "agent_efficiency", isBuiltIn: true };
  }

  // No match — will create a custom LLM metric
  return null;
}

function buildScorerPrompt(metric: GeneratedMetric): string {
  return `Evaluate the ${metric.displayName} of this LLM agent conversation on a scale from 0 to 1.

Metric definition: ${metric.description}

Score 0 means completely fails this quality. Score 1 means perfectly demonstrates it.
Evaluate the full conversation trace and return a numeric score.`;
}

// ---------------------------------------------------------------------------
// setupGalileoProject — create project, log stream, metrics in Galileo
// ---------------------------------------------------------------------------

export const setupGalileoProject = internalAction({
  args: {
    evaluationId: v.id("customEvaluations"),
    galileoApiKey: v.string(),
    galileoProjectName: v.string(),
  },
  handler: async (ctx, args) => {
    const { evaluationId, galileoApiKey, galileoProjectName } = args;

    try {
      // Set API key for Galileo SDK
      process.env.GALILEO_API_KEY = galileoApiKey;

      // Load evaluation config
      const evaluation = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getEvaluation,
        { id: evaluationId }
      );
      if (!evaluation || !evaluation.generatedConfig) {
        throw new Error("Evaluation config not found");
      }

      const config = evaluation.generatedConfig;
      const metrics: GeneratedMetric[] = config.metrics;

      // Initialize project + log stream via galileoInit (ensures correct project
      // type so that getTraces score retrieval works later without conflict).
      // galileoInit always creates a "default" log stream, so we use that name.
      const logStreamName = "default";
      await galileoInit({
        projectName: galileoProjectName,
      });

      // Retrieve the project ID created by init
      const createdProject = await getProject({ name: galileoProjectName });
      const galileoProjectId = createdProject?.id ?? "";

      // Map generated metrics to Galileo metrics
      const metricMapping: Record<string, MetricMapping> = {};
      const builtInMetricNames: string[] = [];
      const customMetricNames: string[] = [];

      for (const metric of metrics) {
        const mapping = mapMetricToGalileo(metric.key, metric.description);
        if (mapping) {
          metricMapping[metric.key] = mapping;
          if (!builtInMetricNames.includes(mapping.galileoName)) {
            builtInMetricNames.push(mapping.galileoName);
          }
        } else {
          // Create custom LLM metric in Galileo
          const customName = `custom_${metric.key}`;
          try {
            await createCustomLlmMetric({
              name: customName,
              userPrompt: buildScorerPrompt(metric),
            });
          } catch (err) {
            // Metric may already exist — that's fine
            console.log(`Custom metric creation note for ${customName}:`, err);
          }
          metricMapping[metric.key] = {
            galileoName: customName,
            isBuiltIn: false,
          };
          customMetricNames.push(customName);
        }
      }

      // Enable all metrics on the log stream
      const allMetricNames = [...builtInMetricNames, ...customMetricNames];
      if (allMetricNames.length > 0) {
        await enableMetrics({
          projectName: galileoProjectName,
          logStreamName,
          metrics: allMetricNames,
        });
      }

      // Store project info on the evaluation
      await ctx.runMutation(
        internal.customGalileoEvalHelpers.storeGalileoProjectInfo,
        {
          id: evaluationId,
          galileoProjectName,
          galileoProjectId,
          galileoLogStreamName: logStreamName,
          galileoMetricMapping: metricMapping,
        }
      );

      // Schedule the evaluation to start
      await ctx.scheduler.runAfter(
        0,
        internal.customOrchestrator.startEvaluation,
        {
          evaluationId,
          galileoApiKey,
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during Galileo setup";
      console.error("Galileo project setup failed:", errorMessage);

      // Store the setup error and mark evaluation as failed
      await ctx.runMutation(
        internal.customGalileoEvalHelpers.storeGalileoSetupError,
        {
          id: evaluationId,
          galileoSetupError: errorMessage,
        }
      );

      await ctx.runMutation(
        internal.customGalileoEvalHelpers.updateEvaluationStatus,
        {
          id: evaluationId,
          status: "failed",
          errorMessage: `Galileo setup failed: ${errorMessage}`,
        }
      );
    } finally {
      // Clean up env var
      delete process.env.GALILEO_API_KEY;
    }
  },
});

// ---------------------------------------------------------------------------
// evaluateCustomSession — evaluate a single completed session
// ---------------------------------------------------------------------------

export const evaluateCustomSession = internalAction({
  args: {
    sessionId: v.id("customSessions"),
    evaluationId: v.id("customEvaluations"),
    galileoApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { sessionId, evaluationId } = args;

    try {
      // Load session
      const session = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getSession,
        { sessionId }
      );
      if (!session) throw new Error(`Session ${sessionId} not found`);

      // Load evaluation config for metrics
      const evaluation = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getEvaluation,
        { id: evaluationId }
      );
      if (!evaluation || !evaluation.generatedConfig) {
        throw new Error("Evaluation config not found");
      }

      const config = evaluation.generatedConfig;
      const metrics: GeneratedMetric[] = config.metrics;

      // Load messages
      const messages: ConversationMessage[] = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getSessionMessages,
        { sessionId }
      );

      // Find the scenario
      const scenario = config.scenarios.find(
        (s: { id: string }) => s.id === session.scenarioLocalId
      );

      // Galileo is the only scoring mechanism — skip if config is missing
      if (
        !args.galileoApiKey ||
        !evaluation.galileoProjectName ||
        !evaluation.galileoLogStreamName ||
        !evaluation.galileoMetricMapping
      ) {
        console.log(`Skipping evaluation for session ${sessionId}: Galileo config missing`);
        return;
      }

      const result = await evaluateWithGalileo(
        messages,
        session.modelId,
        args.galileoApiKey,
        evaluation.galileoProjectName,
        evaluation.galileoLogStreamName,
        evaluation.galileoMetricMapping as Record<string, MetricMapping>,
        metrics,
        scenario?.title ?? "Unknown scenario",
        config.domain,
        evaluation.galileoProjectId
      );
      const { metricScores, traceId: galileoTraceId, consoleUrl: galileoConsoleUrl, scoringSource } = result;

      // If Galileo hasn't finished scoring yet, skip storing — no fake scores
      if (scoringSource === "pending_galileo") {
        console.log(
          `Session ${sessionId}: Galileo scores still computing. Trace ingested (${galileoTraceId}). Skipping score storage.`
        );
        return;
      }

      // Compute overall score as weighted average
      const overallScore = computeWeightedScore(metricScores, metrics);

      const categoryScore = scenario
        ? { category: scenario.category, score: overallScore }
        : undefined;

      // Generate failure analysis for any metric < 0.5
      const failureAnalysis: string[] = [];
      for (const m of metrics) {
        if ((metricScores[m.key] ?? 0) < 0.5) {
          failureAnalysis.push(
            `Low ${m.displayName} (${(metricScores[m.key] ?? 0).toFixed(2)}) — ${m.description}`
          );
        }
      }

      // Store evaluation
      await ctx.runMutation(
        internal.customGalileoEvalHelpers.storeSessionEvaluation,
        {
          sessionId,
          evaluationId,
          overallScore,
          metricScores,
          categoryScore,
          failureAnalysis: failureAnalysis.length > 0 ? failureAnalysis : undefined,
          galileoTraceId,
          galileoConsoleUrl,
          scoringSource: "galileo",
        }
      );
    } catch (error) {
      console.error("Custom session evaluation failed:", error);

      // Store a zero-score evaluation so finalizeEvaluation always finds records
      const config = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getEvaluation,
        { id: evaluationId }
      ).then((e) => e?.generatedConfig);

      if (config) {
        const zeroScores: Record<string, number> = {};
        for (const m of (config.metrics as GeneratedMetric[])) {
          zeroScores[m.key] = 0;
        }

        const session = await ctx.runQuery(
          internal.customGalileoEvalHelpers.getSession,
          { sessionId }
        );
        const scenario = session
          ? (config.scenarios as { id: string; category: string }[]).find(
              (s) => s.id === session.scenarioLocalId
            )
          : undefined;

        await ctx.runMutation(
          internal.customGalileoEvalHelpers.storeSessionEvaluation,
          {
            sessionId,
            evaluationId,
            overallScore: 0,
            metricScores: zeroScores,
            categoryScore: scenario ? { category: scenario.category, score: 0 } : undefined,
            failureAnalysis: [
              `Evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`,
            ],
            scoringSource: "error",
          }
        );
      }
    }
  },
});

// ---------------------------------------------------------------------------
// evaluateWithGalileo — log traces & poll for real scorer results
// ---------------------------------------------------------------------------

async function evaluateWithGalileo(
  messages: ConversationMessage[],
  modelId: string,
  galileoApiKey: string,
  projectName: string,
  logStreamName: string,
  metricMapping: Record<string, MetricMapping>,
  metrics: GeneratedMetric[],
  scenarioTitle: string,
  domain: string,
  projectId?: string
): Promise<{
  metricScores: Record<string, number>;
  traceId: string;
  consoleUrl: string;
  scoringSource: "galileo" | "pending_galileo";
}> {
  // Set API key
  process.env.GALILEO_API_KEY = galileoApiKey;

  try {
    // Create a logger scoped to this project + log stream
    const logger = new GalileoLogger({
      projectName,
      logStreamName,
    });

    await logger.startSession({
      name: `eval-${modelId}-${scenarioTitle.replace(/\s+/g, "-").toLowerCase().slice(0, 30)}`,
    });

    // Find first user message for trace input
    const firstUserMsg = messages.find((m) => m.role === "user")?.content ?? "Agent evaluation";

    // Generate a unique trace name so we can find this trace later via getTraces.
    // flush() does NOT return the Galileo-assigned trace ID, so we encode a
    // unique suffix in the name and filter by it when polling.
    const traceSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const traceName = `${scenarioTitle} [${modelId}] ${traceSuffix}`;

    logger.startTrace({
      input: firstUserMsg,
      name: traceName,
      tags: [modelId, domain],
    });

    // Log conversation spans
    const systemMsg = messages.find((m) => m.role === "system");

    for (const msg of messages) {
      if (msg.role === "assistant") {
        const precedingInput = messages
          .filter((m) => m.turnNumber < msg.turnNumber && m.role === "user")
          .pop();

        logger.addLlmSpan({
          input: precedingInput?.content ?? systemMsg?.content ?? "",
          output: msg.content,
          model: modelId,
          tags: ["turn-" + msg.turnNumber],
        });

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            const toolResult = messages.find(
              (m) => m.role === "tool" && m.toolCallId === tc.id
            );
            logger.addToolSpan({
              input: tc.arguments,
              output: toolResult?.content ?? "",
              name: tc.name,
              durationNs: 0,
            });
          }
        }
      }
    }

    // Conclude trace
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    logger.conclude({
      output: lastAssistant?.content ?? "",
    });

    // Flush traces to Galileo
    await logger.flush();

    // Resolve project ID: prefer stored ID, fall back to API lookup
    let resolvedProjectId = projectId;
    if (!resolvedProjectId) {
      const project = await getProject({ name: projectName });
      resolvedProjectId = project?.id;
    }

    const consoleUrl = resolvedProjectId
      ? `https://app.galileo.ai/meetumo/project/${encodeURIComponent(resolvedProjectId)}`
      : `https://app.galileo.ai/meetumo/project/${encodeURIComponent(projectName)}`;

    if (!resolvedProjectId) {
      throw new Error(`Cannot poll Galileo scores: project ID not found for "${projectName}"`);
    }

    // Initialize Galileo SDK state before polling so getTraces can resolve context
    try {
      await galileoInit({ projectName, logstream: logStreamName });
    } catch (initErr) {
      console.warn("galileoInit warning (will continue with polling):", initErr);
    }

    let logStream: { id?: string } | null = null;
    try {
      logStream = await getLogStream({
        name: logStreamName,
        projectName,
      });
    } catch (lsErr) {
      console.warn("getLogStream warning (will poll without logStreamId):", lsErr);
    }

    // Poll for scorer results — Galileo LLM-based metrics can take 1-3 minutes
    const MAX_ATTEMPTS = 12;
    const POLL_INTERVAL_MS = 15_000; // 15 seconds between attempts (3 min total)

    let scorerResults: Record<string, number> | null = null;
    let lastPollingError: string | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      try {
        const traceResults = await getTraces({
          projectId: resolvedProjectId,
          logStreamId: logStream?.id,
          filters: [
            {
              columnId: "name",
              operator: "eq" as const,
              value: traceName,
              type: "text" as const,
            },
          ],
          limit: 1,
        });

        const trace = traceResults?.records?.[0];
        if (trace) {
          const traceMetrics = trace.metrics;
          if (traceMetrics && Object.keys(traceMetrics).length > 0) {
            const numericMetrics: Record<string, number> = {};
            for (const [key, val] of Object.entries(traceMetrics)) {
              if (typeof val === "number") {
                numericMetrics[key] = val;
              }
            }
            if (Object.keys(numericMetrics).length > 0) {
              console.log(
                `Galileo scores retrieved on attempt ${attempt + 1}/${MAX_ATTEMPTS}:`,
                Object.keys(numericMetrics).join(", ")
              );
              scorerResults = numericMetrics;
              break;
            }
          }
          // Trace found but no metrics yet — keep polling
          if (attempt % 3 === 2) {
            console.log(
              `Galileo polling attempt ${attempt + 1}/${MAX_ATTEMPTS}: trace found, metrics not ready yet`
            );
          }
        } else if (attempt % 3 === 2) {
          console.log(
            `Galileo polling attempt ${attempt + 1}/${MAX_ATTEMPTS}: trace not found yet`
          );
        }
      } catch (pollErr) {
        lastPollingError =
          pollErr instanceof Error ? pollErr.message : String(pollErr);
        console.warn(`Galileo polling attempt ${attempt + 1}/${MAX_ATTEMPTS} failed:`, lastPollingError);
      }
    }

    // If scores not ready yet, return pending status (no fake scores)
    if (!scorerResults) {
      console.log(
        `Galileo scores not ready after ${MAX_ATTEMPTS} attempts (~${(MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s)${lastPollingError ? ` (last error: ${lastPollingError})` : ""}. Scores will be available in Galileo Console.`
      );
      return { metricScores: {}, traceId: traceName, consoleUrl, scoringSource: "pending_galileo" };
    }

    // Map Galileo scores back to generated metric keys
    const metricScores: Record<string, number> = {};
    const clamp = (n: number) => Math.max(0, Math.min(1, n));

    for (const metric of metrics) {
      const mapping = metricMapping[metric.key];
      if (!mapping) {
        metricScores[metric.key] = 0;
        continue;
      }

      const rawScore = scorerResults[mapping.galileoName];
      if (rawScore === undefined) {
        metricScores[metric.key] = 0;
        continue;
      }

      if (mapping.isBuiltIn && mapping.isInverted) {
        metricScores[metric.key] = clamp(1 - rawScore);
      } else {
        metricScores[metric.key] = clamp(rawScore);
      }
    }

    return { metricScores, traceId: traceName, consoleUrl, scoringSource: "galileo" as const };
  } finally {
    delete process.env.GALILEO_API_KEY;
  }
}

// ---------------------------------------------------------------------------
// finalizeEvaluation — aggregate all session evaluations into leaderboard
// ---------------------------------------------------------------------------

export const finalizeEvaluation = internalAction({
  args: {
    evaluationId: v.id("customEvaluations"),
  },
  handler: async (ctx, args) => {
    const { evaluationId } = args;

    try {
      // Load evaluation config
      const evaluation = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getEvaluation,
        { id: evaluationId }
      );
      if (!evaluation || !evaluation.generatedConfig) {
        throw new Error("Evaluation config not found");
      }

      const config = evaluation.generatedConfig;
      const metrics: GeneratedMetric[] = config.metrics;
      const categories = config.categories;

      // Get all session evaluations
      const allEvals = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getAllSessionEvaluations,
        { evaluationId }
      );

      // Get all sessions to map sessionId -> modelId
      const allSessions = await ctx.runQuery(
        internal.customGalileoEvalHelpers.getSessionsByEvaluation,
        { evaluationId }
      );

      const sessionMap = new Map(
        allSessions.map((s) => [s._id, s])
      );

      // Group evaluations by modelId
      const byModel = new Map<string, typeof allEvals>();
      for (const evalEntry of allEvals) {
        const session = sessionMap.get(evalEntry.sessionId);
        if (!session) continue;
        const modelId = session.modelId;
        if (!byModel.has(modelId)) {
          byModel.set(modelId, []);
        }
        byModel.get(modelId)!.push(evalEntry);
      }

      // Compute per-model aggregates and upsert leaderboard
      for (const [modelId, modelEvals] of byModel) {
        const count = modelEvals.length;
        if (count === 0) continue;

        // Average metric scores
        const avgMetricScores: Record<string, number> = {};
        for (const m of metrics) {
          const sum = modelEvals.reduce(
            (s, e) => s + ((e.metricScores as Record<string, number>)[m.key] ?? 0),
            0
          );
          avgMetricScores[m.key] = sum / count;
        }

        // Average overall score
        const avgOverall =
          modelEvals.reduce((s, e) => s + e.overallScore, 0) / count;

        // Per-category average
        const categoryScores: Record<string, number> = {};
        for (const cat of categories) {
          const catEvals = modelEvals.filter(
            (e) => e.categoryScore?.category === cat.id
          );
          categoryScores[cat.id] =
            catEvals.length > 0
              ? catEvals.reduce((s, e) => s + e.overallScore, 0) / catEvals.length
              : 0;
        }

        await ctx.runMutation(
          internal.customGalileoEvalHelpers.upsertLeaderboard,
          {
            evaluationId,
            modelId,
            overallScore: Math.round(avgOverall * 1000) / 1000,
            totalSessions: count,
            metricScores: avgMetricScores,
            categoryScores,
          }
        );
      }

      // Detect sessions where Galileo scores weren't ready (no stored evaluation)
      const totalExpected = allSessions.length;
      const totalScored = allEvals.length;
      const pendingCount = totalExpected - totalScored;

      if (pendingCount > 0 && totalScored === 0) {
        // No sessions got scores — Galileo is still computing everything
        await ctx.runMutation(
          internal.customGalileoEvalHelpers.storeGalileoSetupError,
          {
            id: evaluationId,
            galileoSetupError: `Galileo is still computing scores for all ${totalExpected} sessions. Check the Galileo Console for results.`,
          }
        );
      } else if (pendingCount > 0) {
        // Some sessions scored, some still pending
        await ctx.runMutation(
          internal.customGalileoEvalHelpers.storeGalileoSetupError,
          {
            id: evaluationId,
            galileoSetupError: `Galileo returned scores for ${totalScored} of ${totalExpected} sessions. Remaining scores are still being computed.`,
          }
        );
      }

      // Check if evaluation was cancelled during finalization
      const currentEval = await ctx.runQuery(
        internal.customEvaluationsHelpers.internalGetById,
        { id: evaluationId }
      );
      if (currentEval?.status === "cancelled") {
        console.log("Evaluation was cancelled, skipping completion status update");
        return;
      }

      // Mark evaluation as completed
      await ctx.runMutation(
        internal.customGalileoEvalHelpers.updateEvaluationStatus,
        {
          id: evaluationId,
          status: "completed",
          completedAt: Date.now(),
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown finalization error";
      console.error("Finalization error:", errorMessage);

      await ctx.runMutation(
        internal.customGalileoEvalHelpers.updateEvaluationStatus,
        {
          id: evaluationId,
          status: "failed",
          errorMessage,
        }
      );
    }
  },
});
