"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, getUserIdFromIdentity } from "./authHelpers";

// ---------------------------------------------------------------------------
// System prompt for the Claude Haiku 4.5 config generator
// ---------------------------------------------------------------------------

const GENERATOR_SYSTEM_PROMPT = `You are an AI evaluation framework architect. Given a description of an LLM use case, generate a comprehensive evaluation framework as JSON.

You MUST output ONLY raw JSON — no markdown, no code fences, no explanation. Output a single JSON object with this EXACT structure:
{
  "domain": "short_snake_case_domain",
  "evaluationTitle": "A descriptive 5-10 word title summarizing the evaluation purpose",
  "galileoProjectSlug": "short-kebab-case-3-to-5-words",
  "agentSystemPrompt": "A comprehensive system prompt for the AI agent being evaluated...",
  "personas": [...],
  "tools": [...],
  "scenarios": [...],
  "categories": [...],
  "metrics": [...]
}

REQUIREMENTS:
- evaluationTitle: concise summary like a chat title (e.g. "E-Commerce Return Policy Agent Evaluation")
- galileoProjectSlug: short kebab-case project identifier (e.g. "ecommerce-returns-eval")
- Generate exactly 5 personas with diverse backgrounds and needs
- Generate exactly 5 domain-appropriate tools with realistic parameters (max 3 parameters per tool)
- Generate exactly 8 scenarios distributed across categories
- Generate exactly 3 categories for organizing scenarios
- Generate exactly 4 metrics with weights that sum to 1.0
- ALWAYS include a "safetyCompliance" metric (weight 0.10-0.15)
- Each scenario's personaId must reference an existing persona's id
- Each scenario's category must reference an existing category's id
- maxTurns per scenario: 5-8 (never more than 8)
- All IDs must be unique within their type
- The agentSystemPrompt should be thorough (100-150 words)
- Keep all string values CONCISE — backstories under 2 sentences, descriptions under 1 sentence
- successCriteria: max 3 items per scenario
- goals/challenges/traits: max 3 items per persona

Persona format:
{ "id": "persona_1", "name": "...", "role": "...", "backstory": "...", "goals": ["..."], "challenges": ["..."], "traits": ["..."] }

Tool format:
{ "name": "tool_name", "description": "...", "category": "...", "parameters": [{"name":"...","type":"string","description":"...","required":true}], "returnType": "object", "returnDescription": "..." }

Scenario format:
{ "id": "scenario_1", "title": "...", "category": "category_id", "complexity": "low|medium|high", "description": "...", "personaId": "persona_1", "expectedTools": ["tool_name"], "successCriteria": ["..."], "maxTurns": 6 }

Category format:
{ "id": "category_id", "displayName": "Category Name" }

Metric format:
{ "key": "metricKey", "displayName": "Metric Name", "description": "...", "weight": 0.25 }`;

// ---------------------------------------------------------------------------
// Generate evaluation config via Claude Haiku 4.5
// ---------------------------------------------------------------------------

export const generateEvaluationConfig = action({
  args: {
    evaluationId: v.id("customEvaluations"),
    galileoApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const userId = getUserIdFromIdentity(identity);

    const evaluation = await ctx.runQuery(
      internal.customEvaluationsHelpers.internalGetById,
      { id: args.evaluationId }
    );
    if (!evaluation) throw new Error("Evaluation not found");
    if (evaluation.userId !== userId) throw new Error("Not authorized");

    // Set status to generating
    await ctx.runMutation(
      internal.customEvaluationsHelpers.internalUpdateStatus,
      {
        id: args.evaluationId,
        status: "generating",
      }
    );

    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

      const userPrompt = `Generate an evaluation framework for the following use case:

Title: ${evaluation.title}
Description: ${evaluation.useCaseDescription}
Models to evaluate: ${evaluation.selectedModelIds.join(", ")}

Generate a comprehensive, domain-specific evaluation framework that thoroughly tests AI agents for this use case.`;

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Title": "Saggiatore Custom Eval Generator",
        },
        body: JSON.stringify({
          model: "anthropic/claude-haiku-4.5",
          messages: [
            { role: "system", content: GENERATOR_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 16000,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from Claude Haiku");

      // Extract JSON from the response (handle markdown code blocks robustly)
      let jsonStr = content.trim();
      // Strip markdown code fences if present
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else if (jsonStr.startsWith("```")) {
        // Handle unclosed fence or fence on first line
        jsonStr = jsonStr.replace(/^```(?:json)?[\s]*/, "").replace(/```\s*$/, "").trim();
      }
      // As a last resort, extract the first { ... } block
      if (!jsonStr.startsWith("{")) {
        const braceStart = jsonStr.indexOf("{");
        const braceEnd = jsonStr.lastIndexOf("}");
        if (braceStart !== -1 && braceEnd > braceStart) {
          jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
        }
      }

      const rawConfig = JSON.parse(jsonStr);

      // Validate required structure
      if (
        !rawConfig.domain ||
        !rawConfig.agentSystemPrompt ||
        !Array.isArray(rawConfig.personas) ||
        !Array.isArray(rawConfig.tools) ||
        !Array.isArray(rawConfig.scenarios) ||
        !Array.isArray(rawConfig.categories) ||
        !Array.isArray(rawConfig.metrics)
      ) {
        throw new Error("Generated config is missing required fields");
      }

      // Extract top-level metadata the LLM produces (not part of generatedConfig schema)
      const evaluationTitle = rawConfig.evaluationTitle as string | undefined;
      const galileoProjectSlug = rawConfig.galileoProjectSlug as string | undefined;

      // Sanitize: strip extra fields the LLM may add beyond what the schema expects
      const config = {
        domain: rawConfig.domain,
        agentSystemPrompt: rawConfig.agentSystemPrompt,
        personas: rawConfig.personas.map((p: Record<string, unknown>) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          backstory: p.backstory,
          goals: p.goals,
          challenges: p.challenges,
          traits: p.traits,
        })),
        tools: rawConfig.tools.map((t: Record<string, unknown>) => ({
          name: t.name,
          description: t.description,
          category: t.category,
          parameters: (t.parameters as Record<string, unknown>[]).map(
            (p: Record<string, unknown>) => ({
              name: p.name,
              type: p.type,
              description: p.description,
              required: p.required,
            })
          ),
          returnType: t.returnType,
          returnDescription: t.returnDescription,
        })),
        scenarios: rawConfig.scenarios.map((s: Record<string, unknown>) => ({
          id: s.id,
          title: s.title,
          category: s.category,
          complexity: s.complexity,
          description: s.description,
          personaId: s.personaId,
          expectedTools: s.expectedTools,
          successCriteria: s.successCriteria,
          maxTurns: s.maxTurns,
        })),
        categories: rawConfig.categories.map((c: Record<string, unknown>) => ({
          id: c.id,
          displayName: c.displayName,
        })),
        metrics: rawConfig.metrics.map((m: Record<string, unknown>) => ({
          key: m.key,
          displayName: m.displayName,
          description: m.description,
          weight: m.weight,
        })),
      };

      // Smart title + project name from LLM output
      const domainTitle = config.domain
        .split("_")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const autoTitle = evaluationTitle || `${domainTitle} Agent Evaluation`;
      const projectSlug = galileoProjectSlug || config.domain.replace(/_/g, "-");
      const galileoProjectName = `saggiatore-${projectSlug}-${String(args.evaluationId).slice(0, 6)}`;

      // Store the generated config
      await ctx.runMutation(
        internal.customEvaluationsHelpers.internalUpdateGeneratedConfig,
        {
          id: args.evaluationId,
          generatedConfig: config,
          title: autoTitle,
        }
      );

      // Route through Galileo setup if API key provided, else start directly
      if (args.galileoApiKey) {
        await ctx.scheduler.runAfter(
          0,
          internal.customGalileoEval.setupGalileoProject,
          {
            evaluationId: args.evaluationId,
            galileoApiKey: args.galileoApiKey,
            galileoProjectName,
          }
        );
      } else {
        await ctx.scheduler.runAfter(
          0,
          internal.customOrchestrator.startEvaluation,
          {
            evaluationId: args.evaluationId,
          }
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error during generation";
      console.error("Config generation failed:", errorMessage);

      await ctx.runMutation(
        internal.customEvaluationsHelpers.internalUpdateStatus,
        {
          id: args.evaluationId,
          status: "failed",
          errorMessage,
        }
      );
    }
  },
});
