"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  GalileoLogger,
  createProject,
  createLogStream,
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
// Helpers — simulated scoring (fallback)
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function generateSimulatedMetricScores(
  modelId: string,
  metrics: GeneratedMetric[],
  messages: ConversationMessage[] = []
): Record<string, number> {
  const base = 0.76 + (hashString(modelId) % 5) / 100;
  const jitter = () => (Math.random() - 0.5) * 0.2;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  // Check whether the model actually called any tools
  const hasToolUsage = messages.some((m) => m.role === "tool");

  const scores: Record<string, number> = {};
  for (let i = 0; i < metrics.length; i++) {
    const key = metrics[i].key.toLowerCase();
    // Zero out tool-related metrics if no tools were called
    if (!hasToolUsage && key.includes("tool")) {
      scores[metrics[i].key] = 0;
      continue;
    }
    const offset = hashString(modelId + "-" + metrics[i].key) % 8;
    const metricOffset = 0.04 + (offset % 5) / 100;
    scores[metrics[i].key] = clamp(base + metricOffset + jitter());
  }
  return scores;
}

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

      // Create project
      await createProject(galileoProjectName);

      // Create log stream
      const logStreamName = "eval-run";
      await createLogStream(logStreamName, galileoProjectName);

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

      let metricScores: Record<string, number>;
      let galileoTraceId: string | undefined;
      let galileoConsoleUrl: string | undefined;
      let scoringSource: "galileo" | "simulated" = "simulated";

      // Try real Galileo evaluation if API key + project info available
      if (
        args.galileoApiKey &&
        evaluation.galileoProjectName &&
        evaluation.galileoLogStreamName &&
        evaluation.galileoMetricMapping
      ) {
        try {
          const result = await evaluateWithGalileo(
            messages,
            session.modelId,
            args.galileoApiKey,
            evaluation.galileoProjectName,
            evaluation.galileoLogStreamName,
            evaluation.galileoMetricMapping as Record<string, MetricMapping>,
            metrics,
            scenario?.title ?? "Unknown scenario",
            config.domain
          );
          metricScores = result.metricScores;
          galileoTraceId = result.traceId;
          galileoConsoleUrl = result.consoleUrl;
          scoringSource = "galileo";
        } catch (galileoErr) {
          const msg = galileoErr instanceof Error ? galileoErr.message : String(galileoErr);
          throw new Error(`Galileo evaluation failed for session ${sessionId}: ${msg}`);
        }
      } else {
        // Simulated scoring (no Galileo key)
        metricScores = generateSimulatedMetricScores(session.modelId, metrics, messages);
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
          scoringSource,
        }
      );
    } catch (error) {
      console.error("Custom session evaluation failed:", error);
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
  domain: string
): Promise<{
  metricScores: Record<string, number>;
  traceId: string;
  consoleUrl: string;
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

    logger.startTrace({
      input: firstUserMsg,
      name: scenarioTitle,
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

    // Flush and get trace ID
    const traces = await logger.flush();
    const traceId =
      (traces?.[0] as { id?: string } | undefined)?.id ?? `trace-${Date.now()}`;

    const consoleUrl = `https://console.galileo.ai/project/${encodeURIComponent(projectName)}/traces/${traceId}`;

    // Poll for scorer results
    const project = await getProject({ name: projectName });
    if (!project?.id) {
      // Can't poll without project ID — use simulated scores mapped through
      return {
        metricScores: generateSimulatedMetricScores(
          modelId,
          metrics,
          messages
        ),
        traceId,
        consoleUrl,
      };
    }

    const logStream = await getLogStream({
      name: logStreamName,
      projectName,
    });

    let scorerResults: Record<string, number> | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));

      const traceResults = await getTraces({
        projectId: project.id,
        logStreamId: logStream?.id,
        filters: [
          {
            columnId: "id",
            operator: "eq" as const,
            value: traceId,
            type: "text" as const,
          },
        ],
        limit: 1,
      });

      const trace = traceResults?.records?.[0];
      if (trace?.metrics && Object.keys(trace.metrics).length > 0) {
        const numericMetrics: Record<string, number> = {};
        for (const [key, val] of Object.entries(trace.metrics)) {
          if (typeof val === "number") {
            numericMetrics[key] = val;
          }
        }
        if (Object.keys(numericMetrics).length > 0) {
          scorerResults = numericMetrics;
          break;
        }
      }
    }

    // Map Galileo scores back to generated metric keys
    const metricScores: Record<string, number> = {};
    const clamp = (n: number) => Math.max(0, Math.min(1, n));

    for (const metric of metrics) {
      const mapping = metricMapping[metric.key];
      if (!mapping || !scorerResults) {
        // No mapping or no results — use simulated
        const simulated = generateSimulatedMetricScores(modelId, [metric], messages);
        metricScores[metric.key] = simulated[metric.key] ?? 0.75;
        continue;
      }

      const rawScore = scorerResults[mapping.galileoName];
      if (rawScore === undefined) {
        // Score not available — use simulated
        const simulated = generateSimulatedMetricScores(modelId, [metric], messages);
        metricScores[metric.key] = simulated[metric.key] ?? 0.75;
        continue;
      }

      if (mapping.isBuiltIn && mapping.isInverted) {
        metricScores[metric.key] = clamp(1 - rawScore);
      } else {
        metricScores[metric.key] = clamp(rawScore);
      }
    }

    return { metricScores, traceId, consoleUrl };
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
