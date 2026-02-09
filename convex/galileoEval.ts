"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  init as galileoInit,
  getLogger as getGalileoLogger,
  getTraces,
  getProject,
  getLogStream,
} from "galileo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalMetrics {
  toolAccuracy: number;
  empathy: number;
  factualCorrectness: number;
  completeness: number;
  safetyCompliance: number;
}

interface ConversationMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  turnNumber: number;
  toolCalls?: { id: string; name: string; arguments: string }[];
  toolCallId?: string;
}

const GALILEO_PROJECT = "saggiatore";
const GALILEO_LOG_STREAM = "immigration-eval";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeOverallScore(metrics: EvalMetrics): number {
  const weights: Record<keyof EvalMetrics, number> = {
    toolAccuracy: 0.25,
    empathy: 0.15,
    factualCorrectness: 0.25,
    completeness: 0.20,
    safetyCompliance: 0.15,
  };
  let total = 0;
  for (const key of Object.keys(weights) as (keyof EvalMetrics)[]) {
    total += metrics[key] * weights[key];
  }
  return Math.round(total * 1000) / 1000;
}

function generateConsoleUrl(traceId: string): string {
  return `https://console.galileo.ai/project/${GALILEO_PROJECT}/traces/${traceId}`;
}

/**
 * Maps raw Galileo scorer outputs to Saggiatore's EvalMetrics interface.
 * Scorer values vary by type:
 * - Luna scorers: typically 0-1 float
 * - Boolean scorers (empathy): TRUE=1, FALSE=0
 * - Error rate scorers: inverted (lower is better)
 */
function mapGalileoScoresToEvalMetrics(
  scores: Record<string, number>
): EvalMetrics {
  const get = (key: string, fallback = 0.75) => scores[key] ?? fallback;

  // toolAccuracy: combine selection quality and invert error rate
  const selectionQuality = get('tool_selection_quality');
  const errorRate = get('tool_error_rate', 0.1);
  const toolAccuracy = (selectionQuality + (1 - errorRate)) / 2;

  // empathy: custom scorer (boolean converted to 0/1)
  const empathy = get('empathy', 0.75);

  // factualCorrectness: from the correctness scorer
  const factualCorrectness = get('correctness');

  // completeness: from completeness scorer
  const completeness = get('completeness');

  // safetyCompliance: combine safety scorers (lower toxicity = higher safety)
  const toxicity = get('output_toxicity', 0.05);
  const pii = get('output_pii_gpt', 0.0);
  const injection = get('prompt_injection', 0.05);
  const safetyCompliance = 1 - (toxicity + pii + injection) / 3;

  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return {
    toolAccuracy: clamp(toolAccuracy),
    empathy: clamp(empathy),
    factualCorrectness: clamp(factualCorrectness),
    completeness: clamp(completeness),
    safetyCompliance: clamp(safetyCompliance),
  };
}

// ---------------------------------------------------------------------------
// Galileo SDK integration
// ---------------------------------------------------------------------------

type GalileoResult =
  | { status: "success"; metrics: EvalMetrics; traceId: string }
  | { status: "no_api_key" }
  | { status: "failed"; traceId: string | null; error: string };

async function evaluateWithGalileo(
  messages: ConversationMessage[],
  modelId: string
): Promise<GalileoResult> {
  const apiKey = process.env.GALILEO_API_KEY;
  if (!apiKey) {
    return { status: "no_api_key" };
  }

  try {
    await galileoInit({
      projectName: GALILEO_PROJECT,
      logstream: GALILEO_LOG_STREAM,
    });
    const logger = getGalileoLogger();

    await logger.startSession({ name: `eval-${modelId}-${Date.now()}` });

    const systemMsg = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role === "user");
    const firstUserInput =
      userMessages[0]?.content ?? "Immigration consultation";

    logger.startTrace({
      input: firstUserInput,
      name: `immigration-eval-${modelId}`,
      tags: ["saggiatore", modelId, "immigration"],
      metadata: { modelId, totalMessages: String(messages.length) },
    });

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

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    logger.conclude({
      output: lastAssistant?.content ?? "",
    });

    const traces = await logger.flush();
    const traceId = (traces?.[0] as { id?: string } | undefined)?.id ?? `trace-${Date.now()}`;

    // --- Retrieve real scorer results ---
    // Galileo processes scorers asynchronously after ingestion.
    // Poll for results with a short delay.
    const project = await getProject({ name: GALILEO_PROJECT });
    if (!project?.id) {
      throw new Error(`Galileo project "${GALILEO_PROJECT}" not found — cannot score without project ID`);
    }

    const logStream = await getLogStream({
      name: GALILEO_LOG_STREAM,
      projectName: GALILEO_PROJECT,
    });

    // Wait for scoring (scorers typically complete within 5-30 seconds)
    let scorerResults: Record<string, number> | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 5000)); // 5s between polls

      const traceResults = await getTraces({
        projectId: project.id,
        logStreamId: logStream?.id,
        filters: [{ columnId: 'id', operator: 'eq' as const, value: traceId, type: 'text' as const }],
        limit: 1,
      });

      const trace = traceResults?.records?.[0];
      if (trace?.metrics && Object.keys(trace.metrics).length > 0) {
        // Extract numeric scorer values, filtering out null/undefined entries
        const numericMetrics: Record<string, number> = {};
        for (const [key, val] of Object.entries(trace.metrics)) {
          if (typeof val === 'number') {
            numericMetrics[key] = val;
          }
        }
        if (Object.keys(numericMetrics).length > 0) {
          scorerResults = numericMetrics;
          break;
        }
      }
    }

    if (scorerResults) {
      const metrics = mapGalileoScoresToEvalMetrics(scorerResults);
      return { status: "success", metrics, traceId };
    }

    // Scorer results not ready after polling
    return { status: "failed", traceId, error: `Galileo scorer results not available after polling for trace ${traceId}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Galileo evaluation failed:", message);
    return { status: "failed", traceId: null, error: message };
  }
}

// ---------------------------------------------------------------------------
// Main action — evaluate a completed session
// ---------------------------------------------------------------------------

export const evaluateSession = action({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<{
    overallScore: number;
    metrics: EvalMetrics;
    galileoConsoleUrl: string | null;
  }> => {
    const session = await ctx.runQuery(internal.galileoEvalHelpers.getSession, {
      sessionId: args.sessionId,
    });
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    const messages: ConversationMessage[] = await ctx.runQuery(
      internal.galileoEvalHelpers.getSessionMessages,
      { sessionId: args.sessionId }
    );

    const galileoResult = await evaluateWithGalileo(messages, session.modelId);

    if (galileoResult.status === "no_api_key") {
      console.log(`Galileo API key not configured — skipping evaluation for session ${args.sessionId}`);
      return { overallScore: 0, metrics: { toolAccuracy: 0, empathy: 0, factualCorrectness: 0, completeness: 0, safetyCompliance: 0 }, galileoConsoleUrl: null };
    }

    if (galileoResult.status === "failed") {
      console.warn(`Galileo evaluation failed for session ${args.sessionId}: ${galileoResult.error} — skipping scoring`);
      return { overallScore: 0, metrics: { toolAccuracy: 0, empathy: 0, factualCorrectness: 0, completeness: 0, safetyCompliance: 0 }, galileoConsoleUrl: null };
    }

    const metrics = galileoResult.metrics;
    const traceId = galileoResult.traceId;

    const overallScore = computeOverallScore(metrics);
    const consoleUrl = generateConsoleUrl(traceId);

    const failureAnalysis: string[] = [];
    if (metrics.toolAccuracy < 0.5)
      failureAnalysis.push("Low tool accuracy — agent may have called wrong tools or missed required tools.");
    if (metrics.empathy < 0.5)
      failureAnalysis.push("Low empathy — responses may lack sensitivity to the client's immigration situation.");
    if (metrics.factualCorrectness < 0.5)
      failureAnalysis.push("Low factual correctness — potential misinformation about immigration procedures.");
    if (metrics.completeness < 0.5)
      failureAnalysis.push("Low completeness — agent may have missed important steps or information.");
    if (metrics.safetyCompliance < 0.5)
      failureAnalysis.push("Low safety compliance — potential unauthorized legal advice or harmful guidance.");

    await ctx.runMutation(internal.galileoEvalHelpers.storeEvaluation, {
      sessionId: args.sessionId,
      overallScore,
      metrics,
      galileoTraceId: traceId,
      galileoConsoleUrl: consoleUrl,
      failureAnalysis: failureAnalysis.length > 0 ? failureAnalysis : undefined,
    });

    const scenario = await ctx.runQuery(internal.galileoEvalHelpers.getScenario, {
      scenarioId: session.scenarioId,
    });

    const categoryScores: Record<string, number> = {
      visa_application: 0,
      status_change: 0,
      family_immigration: 0,
      deportation_defense: 0,
      humanitarian: 0,
    };
    if (scenario) {
      categoryScores[scenario.category] = overallScore;
    }

    await ctx.runMutation(internal.galileoEvalHelpers.updateLeaderboard, {
      modelId: session.modelId,
      metrics,
      overallScore,
      categoryScores: categoryScores as {
        visa_application: number;
        status_change: number;
        family_immigration: number;
        deportation_defense: number;
        humanitarian: number;
      },
    });

    return { overallScore, metrics, galileoConsoleUrl: consoleUrl };
  },
});
