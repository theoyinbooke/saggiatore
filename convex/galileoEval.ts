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
  // Galileo returns camelCase keys (e.g. toolErrorRate, toxicityGpt).
  // Look up by multiple possible key names, returning the first match.
  // Returns null when no key matches — callers handle missing metrics explicitly.
  const get = (keys: string[], fallback: number | null = null): number | null => {
    for (const k of keys) {
      if (scores[k] !== undefined) return scores[k];
    }
    return fallback;
  };

  // Track which metrics came from Galileo vs were derived
  const sourced: string[] = [];
  const derived: string[] = [];

  // toolAccuracy: combine selection quality and invert error rate
  const selectionQualityRaw = get(['toolSelectionQuality', 'tool_selection_quality']);
  const errorRateRaw = get(['toolErrorRate', 'tool_error_rate']);
  const selectionQuality = selectionQualityRaw ?? 0.75;
  const errorRate = errorRateRaw ?? 0.1;
  const toolAccuracy = (selectionQuality + (1 - errorRate)) / 2;
  if (selectionQualityRaw !== null || errorRateRaw !== null) sourced.push('toolAccuracy');
  else derived.push('toolAccuracy');

  // factualCorrectness: from the correctness or factuality scorer
  const factualCorrectnessRaw = get(['correctness', 'factuality']);
  const factualCorrectness = factualCorrectnessRaw ?? 0.7;
  if (factualCorrectnessRaw !== null) sourced.push('factualCorrectness');
  else derived.push('factualCorrectness');

  // empathy: custom scorer — derive from correlated metrics if missing
  const empathyRaw = get(['empathy']);
  const empathy = empathyRaw ?? get(['conversationQuality']) ?? factualCorrectness;
  if (empathyRaw !== null) sourced.push('empathy');
  else derived.push('empathy');

  // completeness: from completeness scorer — Galileo returns "completenessGpt"
  const completenessRaw = get(['completeness', 'completenessGpt']);
  const completeness = completenessRaw ?? factualCorrectness;
  if (completenessRaw !== null) sourced.push('completeness');
  else derived.push('completeness');

  // safetyCompliance: combine safety scorers (lower toxicity = higher safety)
  const toxicity = get(['toxicityGpt', 'output_toxicity', 'outputToxicity']) ?? 0.05;
  const pii = get(['outputPiiGpt', 'output_pii_gpt']) ?? 0.0;
  const injection = get(['promptInjectionGpt', 'prompt_injection', 'promptInjection']) ?? 0.05;
  const safetyCompliance = 1 - (toxicity + pii + injection) / 3;
  if (get(['toxicityGpt', 'output_toxicity', 'outputToxicity']) !== null) sourced.push('safetyCompliance');
  else derived.push('safetyCompliance');

  console.log(`Galileo metric sources — real: [${sourced.join(', ')}], derived: [${derived.join(', ')}]`);
  console.log(`Galileo raw scores: ${JSON.stringify(scores)}`);

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

    // Generate a unique trace name so we can find this trace later via getTraces.
    // flush() does NOT return the Galileo-assigned trace ID, so we encode a
    // unique suffix in the name and filter by it when polling.
    const traceSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const traceName = `immigration-eval-${modelId}-${traceSuffix}`;

    logger.startTrace({
      input: firstUserInput,
      name: traceName,
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

    await logger.flush();

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

    // Poll for scorer results — Galileo LLM-based metrics can take 1-3 minutes
    const MAX_ATTEMPTS = 12;
    const POLL_INTERVAL_MS = 15_000; // 15 seconds between attempts (3 min total)

    // Expected metric keys from Galileo (actual score keys, not *MetricCost/*NumJudges metadata)
    const EXPECTED_METRIC_KEYS = [
      'toolSelectionQuality', 'toolErrorRate',
      'toxicityGpt', 'promptInjectionGpt',
      'factuality',            // maps to factualCorrectness
      'completenessGpt', 'empathy', // LLM-based, may take longer
    ];

    let scorerResults: Record<string, number> | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const traceResults = await getTraces({
        projectId: project.id,
        logStreamId: logStream?.id,
        filters: [{ columnId: 'name', operator: 'eq' as const, value: traceName, type: 'text' as const }],
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

        if (Object.keys(numericMetrics).length === 0) continue;

        const foundExpected = EXPECTED_METRIC_KEYS.filter(k => numericMetrics[k] !== undefined);
        const missingExpected = EXPECTED_METRIC_KEYS.filter(k => numericMetrics[k] === undefined);

        console.log(
          `Galileo poll attempt ${attempt + 1}/${MAX_ATTEMPTS}: found [${foundExpected.join(', ')}], missing [${missingExpected.join(', ')}]`
        );

        if (missingExpected.length === 0) {
          // All expected metrics found — done
          console.log(`All expected Galileo metrics retrieved on attempt ${attempt + 1}/${MAX_ATTEMPTS}`);
          scorerResults = numericMetrics;
          break;
        }

        if (attempt >= 3) {
          // After 4+ attempts (~60s), accept partial results with a warning
          console.log(`Accepting partial Galileo scores after ${attempt + 1} attempts (missing: ${missingExpected.join(', ')})`);
          scorerResults = numericMetrics;
          break;
        }
      }
    }

    if (scorerResults) {
      const metrics = mapGalileoScoresToEvalMetrics(scorerResults);
      return { status: "success", metrics, traceId: traceName };
    }

    // Scorer results not ready after polling
    console.log(
      `Galileo scores not ready after ${MAX_ATTEMPTS} attempts (~${(MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s) for trace "${traceName}".`
    );
    return { status: "failed", traceId: traceName, error: `Galileo scorer results not available after polling for trace "${traceName}"` };
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
