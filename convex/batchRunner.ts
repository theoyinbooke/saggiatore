"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./authHelpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_IDS = ["gpt-4o", "claude-sonnet-4-5"];

const CATEGORIES = [
  "visa_application",
  "status_change",
  "family_immigration",
  "deportation_defense",
  "humanitarian",
] as const;

type Category = (typeof CATEGORIES)[number];

interface MetricsShape {
  toolAccuracy: number;
  empathy: number;
  factualCorrectness: number;
  completeness: number;
  safetyCompliance: number;
}

// ---------------------------------------------------------------------------
// Deterministic score generation
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

function generateMetrics(
  modelId: string,
  category: Category,
  scenarioIndex: number
): MetricsShape {
  const seed = hashString(`${modelId}-${category}-${scenarioIndex}`);
  const rand = mulberry32(seed);
  const clamp = (n: number) => Math.max(0.35, Math.min(0.98, n));

  const catMod: Record<Category, number> = {
    visa_application: 0.04,
    status_change: 0.02,
    family_immigration: 0.0,
    deportation_defense: -0.03,
    humanitarian: -0.05,
  };

  const jitter = () => (rand() - 0.5) * 0.15;
  const cm = catMod[category];

  // Hash-based offset per model (0.00 to 0.09) instead of model-specific branching
  const baseOffset = (hashString(modelId) % 10) / 100;
  const base = 0.80 + baseOffset;

  return {
    toolAccuracy: clamp(base + 0.06 + cm + jitter()),
    empathy: clamp(base + 0.02 + cm + jitter()),
    factualCorrectness: clamp(base + 0.04 + cm + jitter()),
    completeness: clamp(base + 0.03 + cm + jitter()),
    safetyCompliance: clamp(base + 0.10 + cm + jitter()),
  };
}

function computeOverallScore(m: MetricsShape): number {
  const score =
    m.toolAccuracy * 0.25 +
    m.factualCorrectness * 0.25 +
    m.completeness * 0.2 +
    m.empathy * 0.15 +
    m.safetyCompliance * 0.15;
  return Math.round(score * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Main batch action — runnable via `npx convex run batchRunner:populateEvaluations`
// ---------------------------------------------------------------------------

export const populateEvaluations = action({
  args: {},
  handler: async (ctx): Promise<{ created: number; models: string[] }> => {
    await requireAdmin(ctx);

    const scenarios = await ctx.runQuery(
      internal.batchHelpers.getAllScenarios,
      {}
    );

    if (scenarios.length === 0) {
      throw new Error(
        "No scenarios found in database. Run seed.ts first to populate scenarios."
      );
    }

    // Fetch enabled models from registry, fallback to defaults
    let modelIds: string[];
    try {
      const enabledModels: { modelId: string }[] = await ctx.runQuery(
        internal.modelRegistry.internalListEnabled,
        {}
      );
      modelIds = enabledModels.length > 0
        ? enabledModels.map((m) => m.modelId)
        : DEFAULT_MODEL_IDS;
    } catch {
      modelIds = DEFAULT_MODEL_IDS;
    }

    console.log(
      `[batchRunner] Found ${scenarios.length} scenarios. Generating ${scenarios.length * modelIds.length} evaluations...`
    );

    const aggregates: Record<
      string,
      {
        count: number;
        totalOverall: number;
        metrics: MetricsShape;
        categoryTotals: Record<Category, { sum: number; count: number }>;
      }
    > = {};

    for (const modelId of modelIds) {
      aggregates[modelId] = {
        count: 0,
        totalOverall: 0,
        metrics: {
          toolAccuracy: 0,
          empathy: 0,
          factualCorrectness: 0,
          completeness: 0,
          safetyCompliance: 0,
        },
        categoryTotals: {
          visa_application: { sum: 0, count: 0 },
          status_change: { sum: 0, count: 0 },
          family_immigration: { sum: 0, count: 0 },
          deportation_defense: { sum: 0, count: 0 },
          humanitarian: { sum: 0, count: 0 },
        },
      };
    }

    let created = 0;

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];

      for (const modelId of modelIds) {
        const category = scenario.category as Category;
        const metrics = generateMetrics(modelId, category, i);
        const overallScore = computeOverallScore(metrics);

        const sessionId = await ctx.runMutation(
          internal.batchHelpers.createSession,
          {
            scenarioId: scenario._id,
            personaId: scenario.personaId,
            modelId,
            totalTurns: 3,
          }
        );

        await ctx.runMutation(internal.batchHelpers.createMessages, {
          sessionId,
          modelId,
          scenarioTitle: scenario.title,
        });

        await ctx.runMutation(internal.batchHelpers.createEvaluation, {
          sessionId,
          overallScore,
          metrics,
          category,
        });

        const agg = aggregates[modelId];
        agg.count++;
        agg.totalOverall += overallScore;
        agg.metrics.toolAccuracy += metrics.toolAccuracy;
        agg.metrics.empathy += metrics.empathy;
        agg.metrics.factualCorrectness += metrics.factualCorrectness;
        agg.metrics.completeness += metrics.completeness;
        agg.metrics.safetyCompliance += metrics.safetyCompliance;
        agg.categoryTotals[category].sum += overallScore;
        agg.categoryTotals[category].count++;

        created++;
      }
    }

    for (const modelId of modelIds) {
      const agg = aggregates[modelId];
      const n = agg.count;
      if (n === 0) continue;

      const avgMetrics: MetricsShape = {
        toolAccuracy: Math.round((agg.metrics.toolAccuracy / n) * 1000) / 1000,
        empathy: Math.round((agg.metrics.empathy / n) * 1000) / 1000,
        factualCorrectness:
          Math.round((agg.metrics.factualCorrectness / n) * 1000) / 1000,
        completeness:
          Math.round((agg.metrics.completeness / n) * 1000) / 1000,
        safetyCompliance:
          Math.round((agg.metrics.safetyCompliance / n) * 1000) / 1000,
      };

      const catScores: Record<Category, number> = {
        visa_application: 0,
        status_change: 0,
        family_immigration: 0,
        deportation_defense: 0,
        humanitarian: 0,
      };
      for (const cat of CATEGORIES) {
        const ct = agg.categoryTotals[cat];
        catScores[cat] =
          ct.count > 0
            ? Math.round((ct.sum / ct.count) * 1000) / 1000
            : 0;
      }

      await ctx.runMutation(internal.batchHelpers.upsertLeaderboard, {
        modelId,
        overallScore:
          Math.round((agg.totalOverall / n) * 1000) / 1000,
        totalEvaluations: n,
        metrics: avgMetrics,
        categoryScores: catScores,
      });

      console.log(
        `[batchRunner] ${modelId}: ${n} evaluations, avg score ${(agg.totalOverall / n).toFixed(3)}`
      );
    }

    console.log(
      `[batchRunner] Done. Created ${created} evaluations across ${modelIds.length} models.`
    );

    return { created, models: [...modelIds] };
  },
});
