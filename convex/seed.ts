import { mutation } from "./_generated/server";
import personasData from "../data/personas.json";
import toolsData from "../data/tools.json";
import scenariosData from "../data/scenarios.json";
import { requireAdmin } from "./authHelpers";

/**
 * Seed the database with personas, tools, and scenarios.
 * Runnable via: npx convex run seed:seedAll
 *
 * Pass { clear: true } to wipe existing data before seeding.
 * Without clear, it will skip if data already exists.
 */
export const seedAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Check if data already exists
    const existingPersona = await ctx.db.query("personas").first();
    if (existingPersona) {
      return { status: "already_seeded" as const };
    }

    // 1. Insert all personas and capture IDs
    const personaIds: string[] = [];
    for (const p of personasData) {
      const id = await ctx.db.insert("personas", {
        name: p.name,
        age: p.age,
        nationality: p.nationality,
        countryFlag: p.countryFlag,
        currentStatus: p.currentStatus,
        visaType: p.visaType,
        complexityLevel: p.complexityLevel as "low" | "medium" | "high",
        backstory: p.backstory,
        goals: p.goals,
        challenges: p.challenges,
        familyInfo: p.familyInfo,
        employmentInfo: p.employmentInfo,
        educationInfo: p.educationInfo,
        tags: p.tags,
      });
      personaIds.push(id);
    }

    // 2. Insert all tools
    for (const t of toolsData) {
      await ctx.db.insert("tools", {
        name: t.name,
        description: t.description,
        category: t.category,
        parameters: t.parameters,
        returnType: t.returnType,
        returnDescription: t.returnDescription,
      });
    }

    // 3. Insert all scenarios with resolved persona IDs
    for (const s of scenariosData) {
      const personaId = personaIds[s.personaIndex];
      if (!personaId) {
        throw new Error(
          `Invalid personaIndex ${s.personaIndex} in scenario "${s.title}"`
        );
      }
      await ctx.db.insert("scenarios", {
        title: s.title,
        category: s.category as
          | "visa_application"
          | "status_change"
          | "family_immigration"
          | "deportation_defense"
          | "humanitarian",
        complexity: s.complexity as "low" | "medium" | "high",
        description: s.description,
        personaId: personaId as any,
        expectedTools: s.expectedTools,
        successCriteria: s.successCriteria,
        maxTurns: s.maxTurns,
      });
    }

    // 4. Seed model registry defaults
    const modelRegistryDefaults = [
      {
        modelId: "gpt-4o",
        displayName: "GPT-4o",
        provider: "openai" as const,
        apiModel: "gpt-4o",
        envKey: "OPENAI_API_KEY",
        enabled: true,
        supportsTools: true,
        sortOrder: 0,
        color: "hsl(217, 91%, 60%)",
        lastSyncedAt: Date.now(),
        contextWindow: 128000,
        description: "OpenAI GPT-4o — fast, multimodal flagship model",
      },
      {
        modelId: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        provider: "openrouter" as const,
        apiModel: "anthropic/claude-sonnet-4.5",
        envKey: "OPENROUTER_API_KEY",
        enabled: true,
        supportsTools: true,
        sortOrder: 1,
        color: "hsl(271, 81%, 56%)",
        lastSyncedAt: Date.now(),
        contextWindow: 200000,
        description:
          "Anthropic Claude Sonnet 4.5 via OpenRouter — balanced intelligence and speed",
      },
    ];

    for (const model of modelRegistryDefaults) {
      await ctx.db.insert("modelRegistry", model);
    }

    return {
      status: "seeded" as const,
      counts: {
        personas: personaIds.length,
        tools: toolsData.length,
        scenarios: scenariosData.length,
        modelRegistry: modelRegistryDefaults.length,
      },
    };
  },
});

/**
 * Clear all seed data tables and re-seed from JSON.
 * Runnable via: npx convex run seed:clearAndReseed
 *
 * WARNING: This deletes ALL data in personas, tools, scenarios,
 * plus dependent data in sessions, messages, evaluations, and leaderboard.
 */
export const clearAndReseed = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all tables in dependency order
    const tables = [
      "messages",
      "evaluations",
      "leaderboard",
      "sessions",
      "scenarios",
      "tools",
      "personas",
      "modelRegistry",
    ] as const;

    const deleteCounts: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      deleteCounts[table] = docs.length;
    }

    // Now insert fresh data — same logic as seedAll
    const personaIds: string[] = [];
    for (const p of personasData) {
      const id = await ctx.db.insert("personas", {
        name: p.name,
        age: p.age,
        nationality: p.nationality,
        countryFlag: p.countryFlag,
        currentStatus: p.currentStatus,
        visaType: p.visaType,
        complexityLevel: p.complexityLevel as "low" | "medium" | "high",
        backstory: p.backstory,
        goals: p.goals,
        challenges: p.challenges,
        familyInfo: p.familyInfo,
        employmentInfo: p.employmentInfo,
        educationInfo: p.educationInfo,
        tags: p.tags,
      });
      personaIds.push(id);
    }

    for (const t of toolsData) {
      await ctx.db.insert("tools", {
        name: t.name,
        description: t.description,
        category: t.category,
        parameters: t.parameters,
        returnType: t.returnType,
        returnDescription: t.returnDescription,
      });
    }

    for (const s of scenariosData) {
      const personaId = personaIds[s.personaIndex];
      if (!personaId) {
        throw new Error(
          `Invalid personaIndex ${s.personaIndex} in scenario "${s.title}"`
        );
      }
      await ctx.db.insert("scenarios", {
        title: s.title,
        category: s.category as
          | "visa_application"
          | "status_change"
          | "family_immigration"
          | "deportation_defense"
          | "humanitarian",
        complexity: s.complexity as "low" | "medium" | "high",
        description: s.description,
        personaId: personaId as any,
        expectedTools: s.expectedTools,
        successCriteria: s.successCriteria,
        maxTurns: s.maxTurns,
      });
    }

    // Seed model registry defaults
    const modelRegistryDefaults = [
      {
        modelId: "gpt-4o",
        displayName: "GPT-4o",
        provider: "openai" as const,
        apiModel: "gpt-4o",
        envKey: "OPENAI_API_KEY",
        enabled: true,
        supportsTools: true,
        sortOrder: 0,
        color: "hsl(217, 91%, 60%)",
        lastSyncedAt: Date.now(),
        contextWindow: 128000,
        description: "OpenAI GPT-4o — fast, multimodal flagship model",
      },
      {
        modelId: "claude-sonnet-4-5",
        displayName: "Claude Sonnet 4.5",
        provider: "openrouter" as const,
        apiModel: "anthropic/claude-sonnet-4.5",
        envKey: "OPENROUTER_API_KEY",
        enabled: true,
        supportsTools: true,
        sortOrder: 1,
        color: "hsl(271, 81%, 56%)",
        lastSyncedAt: Date.now(),
        contextWindow: 200000,
        description:
          "Anthropic Claude Sonnet 4.5 via OpenRouter — balanced intelligence and speed",
      },
    ];

    for (const model of modelRegistryDefaults) {
      await ctx.db.insert("modelRegistry", model);
    }

    return {
      status: "reseeded" as const,
      deleted: deleteCounts,
      inserted: {
        personas: personaIds.length,
        tools: toolsData.length,
        scenarios: scenariosData.length,
        modelRegistry: modelRegistryDefaults.length,
      },
    };
  },
});

/**
 * Clear demo/simulated evaluation results only.
 * Removes sessions, messages, evaluations, and leaderboard entries
 * while preserving reference data (personas, tools, scenarios, modelRegistry).
 *
 * Runnable via: npx convex run seed:clearDemoResults
 */
export const clearDemoResults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tables = ["messages", "evaluations", "leaderboard", "sessions"] as const;
    const deleteCounts: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      deleteCounts[table] = docs.length;
    }

    return { status: "cleared" as const, deleted: deleteCounts };
  },
});
