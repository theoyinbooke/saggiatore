"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { callLLM } from "./llmClient";
import type { OpenAIMessage, OpenAIToolDef, LLMProvider } from "./llmClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelConfig {
  provider: LLMProvider;
  apiModel: string;
  supportsTools: boolean;
}

interface GeneratedTool {
  name: string;
  description: string;
  category: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
  returnType: string;
  returnDescription: string;
}

interface GeneratedPersona {
  id: string;
  name: string;
  role: string;
  backstory: string;
  goals: string[];
  challenges: string[];
  traits: string[];
}

interface GeneratedScenario {
  id: string;
  title: string;
  category: string;
  complexity: string;
  description: string;
  personaId: string;
  expectedTools: string[];
  successCriteria: string[];
  maxTurns: number;
}

// ---------------------------------------------------------------------------
// Legacy model fallback
// ---------------------------------------------------------------------------

const LEGACY_MODELS: Record<string, ModelConfig> = {
  "gpt-4o": { provider: "openai", apiModel: "gpt-4o", supportsTools: true },
  "claude-sonnet-4-5": {
    provider: "openrouter",
    apiModel: "anthropic/claude-sonnet-4.5",
    supportsTools: true,
  },
  "llama-3.3-70b-versatile": {
    provider: "groq",
    apiModel: "llama-3.3-70b-versatile",
    supportsTools: true,
  },
};

// ---------------------------------------------------------------------------
// Agent caller
// ---------------------------------------------------------------------------

async function callAgent(
  config: ModelConfig,
  messages: OpenAIMessage[],
  tools: OpenAIToolDef[]
): Promise<{
  content: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
}> {
  const effectiveTools = config.supportsTools ? tools : undefined;
  try {
    return await callLLM(config.provider, messages, effectiveTools, config.apiModel);
  } catch (err) {
    // If tools caused the failure, retry without them
    if (effectiveTools && err instanceof Error && /tool/i.test(err.message)) {
      console.warn(`Tool call failed for ${config.apiModel}, retrying without tools`);
      return callLLM(config.provider, messages, undefined, config.apiModel);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Persona & Tool Simulators (GPT-4o-mini)
// ---------------------------------------------------------------------------

async function callPersonaSimulator(
  personaSystemPrompt: string,
  conversationHistory: OpenAIMessage[]
): Promise<string> {
  const perspectiveMessages: OpenAIMessage[] = [
    { role: "system", content: personaSystemPrompt },
  ];

  for (const msg of conversationHistory) {
    if (msg.role === "user") {
      perspectiveMessages.push({ role: "assistant", content: msg.content });
    } else if (msg.role === "assistant" && msg.content) {
      perspectiveMessages.push({ role: "user", content: msg.content });
    }
  }

  const result = await callLLM("openai", perspectiveMessages, undefined, "gpt-4o-mini", 500);
  return result.content ?? "I'm not sure what to say.";
}

async function callToolSimulator(
  toolName: string,
  toolArguments: string,
  toolDef: GeneratedTool
): Promise<string> {
  const systemPrompt = `You are a simulated API. Return a realistic JSON response for this tool call.
Tool: ${toolName}
Description: ${toolDef.description}
Expected return: ${toolDef.returnType} — ${toolDef.returnDescription}
Arguments: ${toolArguments}
Return ONLY valid JSON, no explanation. Make the data plausible and detailed.`;

  const result = await callLLM(
    "openai",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Arguments: ${toolArguments}` },
    ],
    undefined,
    "gpt-4o-mini",
    300
  );

  return result.content ?? JSON.stringify({ error: "Tool simulation failed" });
}

// ---------------------------------------------------------------------------
// Prompt Builders
// ---------------------------------------------------------------------------

function buildGenericPersonaPrompt(
  persona: GeneratedPersona,
  scenario: GeneratedScenario
): string {
  return `You are roleplaying as ${persona.name}, ${persona.role}.
BACKGROUND: ${persona.backstory}
YOUR GOALS:\n${persona.goals.map((g) => `- ${g}`).join("\n")}
YOUR CHALLENGES:\n${persona.challenges.map((c) => `- ${c}`).join("\n")}
PERSONALITY TRAITS: ${persona.traits.join(", ")}
SCENARIO: ${scenario.title}\n${scenario.description}
INSTRUCTIONS:
- Stay in character throughout
- Ask questions a real person in this situation would ask
- Show appropriate emotions based on your traits
- Respond to the agent's advice with realistic follow-ups
- Keep responses concise (2-4 sentences)
Start by introducing yourself and describing what you need help with.`;
}

function toOpenAITools(tools: GeneratedTool[]): OpenAIToolDef[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          t.parameters.map((p) => {
            const prop: Record<string, unknown> = {
              type: p.type,
              description: p.description,
            };
            // OpenAI requires "items" for array-type parameters
            if (p.type === "array") {
              prop.items = { type: "string" };
            }
            return [p.name, prop];
          })
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}

// ---------------------------------------------------------------------------
// startEvaluation — creates all sessions, schedules per-model runs
// ---------------------------------------------------------------------------

export const startEvaluation = internalAction({
  args: {
    evaluationId: v.id("customEvaluations"),
    galileoApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const evaluation = await ctx.runQuery(
      internal.customOrchestratorHelpers.getEvaluation,
      { id: args.evaluationId }
    );
    if (!evaluation) throw new Error("Evaluation not found");
    if (!evaluation.generatedConfig) throw new Error("No generated config");

    const config = evaluation.generatedConfig;
    const modelIds = evaluation.selectedModelIds;
    const scenarios = config.scenarios;

    // Set status to running
    await ctx.runMutation(
      internal.customOrchestratorHelpers.updateEvaluationStatus,
      {
        id: args.evaluationId,
        status: "running",
      }
    );

    // Initialize progress
    const totalSessions = modelIds.length * scenarios.length;
    await ctx.runMutation(
      internal.customOrchestratorHelpers.updateEvaluationProgress,
      {
        id: args.evaluationId,
        progress: {
          totalModels: modelIds.length,
          totalScenarios: scenarios.length,
          completedSessions: 0,
          totalSessions,
          failedSessions: 0,
          currentPhase: "Creating sessions",
        },
      }
    );

    // Create all session records in a single batch transaction
    const sessionsToCreate = modelIds.flatMap((modelId: string) =>
      scenarios.map((scenario: GeneratedScenario) => ({
        evaluationId: args.evaluationId,
        scenarioLocalId: scenario.id,
        personaLocalId: scenario.personaId,
        modelId,
      }))
    );
    await ctx.runMutation(
      internal.customOrchestratorHelpers.createSessionsBatch,
      { sessions: sessionsToCreate }
    );

    // Schedule each session as its own action to avoid the 600s timeout
    const allSessions = await ctx.runQuery(
      internal.customOrchestratorHelpers.getAllSessions,
      { evaluationId: args.evaluationId }
    );
    for (const session of allSessions) {
      await ctx.scheduler.runAfter(
        0,
        internal.customOrchestrator.runSingleSession,
        {
          evaluationId: args.evaluationId,
          sessionId: session._id,
          galileoApiKey: args.galileoApiKey,
        }
      );
    }
  },
});

// ---------------------------------------------------------------------------
// runSingleSession — runs one session (conversation + eval scheduling)
// ---------------------------------------------------------------------------

export const runSingleSession = internalAction({
  args: {
    evaluationId: v.id("customEvaluations"),
    sessionId: v.id("customSessions"),
    galileoApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { evaluationId, sessionId } = args;

    // Load session
    const session = await ctx.runQuery(
      internal.customOrchestratorHelpers.getSession,
      { sessionId }
    );
    if (!session) throw new Error(`Session ${sessionId} not found`);
    const modelId = session.modelId;

    // Resolve model config
    let modelConfig: ModelConfig;
    try {
      const registryEntry = await ctx.runQuery(
        internal.modelRegistry.internalGetByModelId,
        { modelId }
      );
      if (registryEntry) {
        modelConfig = {
          provider: registryEntry.provider,
          apiModel: registryEntry.apiModel,
          supportsTools: registryEntry.supportsTools,
        };
      } else if (LEGACY_MODELS[modelId]) {
        modelConfig = LEGACY_MODELS[modelId];
      } else {
        throw new Error(`Unknown modelId: ${modelId}`);
      }
    } catch (lookupErr) {
      if (LEGACY_MODELS[modelId]) {
        modelConfig = LEGACY_MODELS[modelId];
      } else {
        throw lookupErr;
      }
    }

    // Load evaluation config
    const evaluation = await ctx.runQuery(
      internal.customOrchestratorHelpers.getEvaluation,
      { id: evaluationId }
    );
    if (!evaluation || !evaluation.generatedConfig) {
      throw new Error("Evaluation or config not found");
    }

    const config = evaluation.generatedConfig;
    const personaMap = new Map(config.personas.map((p: GeneratedPersona) => [p.id, p]));
    const toolMap = new Map(config.tools.map((t: GeneratedTool) => [t.name, t]));
    const openAITools = toOpenAITools(config.tools);

    try {
      const scenario = config.scenarios.find(
        (s: GeneratedScenario) => s.id === session.scenarioLocalId
      );
      if (!scenario) {
        await ctx.runMutation(
          internal.customOrchestratorHelpers.updateSessionStatus,
          {
            sessionId,
            status: "failed",
            errorMessage: `Scenario ${session.scenarioLocalId} not found in config`,
          }
        );
        await scheduleProgressAndFinalizationCheck(ctx, evaluationId, evaluation);
        return;
      }

      const persona = personaMap.get(scenario.personaId);
      if (!persona) {
        await ctx.runMutation(
          internal.customOrchestratorHelpers.updateSessionStatus,
          {
            sessionId,
            status: "failed",
            errorMessage: `Persona ${scenario.personaId} not found in config`,
          }
        );
        await scheduleProgressAndFinalizationCheck(ctx, evaluationId, evaluation);
        return;
      }

      // Mark session as running
      await ctx.runMutation(
        internal.customOrchestratorHelpers.updateSessionStatus,
        {
          sessionId,
          status: "running",
          startedAt: Date.now(),
        }
      );

      // Build prompts
      const agentSystemPrompt = config.agentSystemPrompt;
      const personaPrompt = buildGenericPersonaPrompt(persona, scenario);

      // Store system message
      await ctx.runMutation(
        internal.customOrchestratorHelpers.insertMessage,
        {
          sessionId,
          role: "system",
          content: agentSystemPrompt,
          turnNumber: 0,
          timestamp: Date.now(),
        }
      );

      // Conversation state
      const agentHistory: OpenAIMessage[] = [
        { role: "system", content: agentSystemPrompt },
      ];
      const personaConversation: OpenAIMessage[] = [];

      let turnNumber = 1;
      const maxTurns = scenario.maxTurns;

      // Initial persona message
      const initialPersonaMsg = await callPersonaSimulator(personaPrompt, []);

      await ctx.runMutation(
        internal.customOrchestratorHelpers.insertMessage,
        {
          sessionId,
          role: "user",
          content: initialPersonaMsg,
          turnNumber,
          timestamp: Date.now(),
        }
      );

      agentHistory.push({ role: "user", content: initialPersonaMsg });
      personaConversation.push({ role: "user", content: initialPersonaMsg });
      turnNumber++;

      // Main conversation loop
      while (turnNumber <= maxTurns) {
        // Check for cancellation
        const currentStatus = await ctx.runQuery(
          internal.customOrchestratorHelpers.getSessionStatus,
          { sessionId }
        );
        if (currentStatus === "cancelled") break;

        // Agent responds
        const agentResponse = await callAgent(
          modelConfig,
          agentHistory,
          openAITools
        );

        // Handle tool calls
        if (agentResponse.tool_calls && agentResponse.tool_calls.length > 0) {
          const toolCallsForDb = agentResponse.tool_calls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }));

          await ctx.runMutation(
            internal.customOrchestratorHelpers.insertMessage,
            {
              sessionId,
              role: "assistant",
              content: agentResponse.content ?? "",
              turnNumber,
              toolCalls: toolCallsForDb,
              timestamp: Date.now(),
            }
          );

          agentHistory.push({
            role: "assistant",
            content: agentResponse.content,
            tool_calls: agentResponse.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: tc.function,
            })),
          });

          // Parallelize LLM tool simulation calls (independent)
          const toolResults = await Promise.all(
            agentResponse.tool_calls.map(async (toolCall) => {
              const toolDef = toolMap.get(toolCall.function.name);
              if (toolDef) {
                try {
                  const result = await callToolSimulator(
                    toolCall.function.name,
                    toolCall.function.arguments,
                    toolDef
                  );
                  return { toolCall, result };
                } catch {
                  return {
                    toolCall,
                    result: JSON.stringify({
                      error: `Tool simulation error for ${toolCall.function.name}`,
                    }),
                  };
                }
              }
              return {
                toolCall,
                result: JSON.stringify({
                  error: `Unknown tool: ${toolCall.function.name}`,
                }),
              };
            })
          );

          // Insert messages sequentially (must await each mutation)
          for (const { toolCall, result } of toolResults) {
            await ctx.runMutation(
              internal.customOrchestratorHelpers.insertMessage,
              {
                sessionId,
                role: "tool",
                content: result,
                turnNumber,
                toolCallId: toolCall.id,
                timestamp: Date.now(),
              }
            );

            agentHistory.push({
              role: "tool",
              content: result,
              tool_call_id: toolCall.id,
            });
          }

          turnNumber++;
          continue;
        }

        // No tool calls — agent produced a text response
        const agentText = agentResponse.content ?? "";

        await ctx.runMutation(
          internal.customOrchestratorHelpers.insertMessage,
          {
            sessionId,
            role: "assistant",
            content: agentText,
            turnNumber,
            timestamp: Date.now(),
          }
        );

        agentHistory.push({ role: "assistant", content: agentText });
        personaConversation.push({ role: "assistant", content: agentText });
        turnNumber++;

        if (turnNumber > maxTurns) break;

        // Check for cancellation before calling persona simulator
        const statusCheck = await ctx.runQuery(
          internal.customOrchestratorHelpers.getSessionStatus,
          { sessionId }
        );
        if (statusCheck === "cancelled") break;

        // Persona responds
        const personaMsg = await callPersonaSimulator(
          personaPrompt,
          personaConversation
        );

        await ctx.runMutation(
          internal.customOrchestratorHelpers.insertMessage,
          {
            sessionId,
            role: "user",
            content: personaMsg,
            turnNumber,
            timestamp: Date.now(),
          }
        );

        agentHistory.push({ role: "user", content: personaMsg });
        personaConversation.push({ role: "user", content: personaMsg });
        turnNumber++;
      }

      // Check if session was cancelled
      const finalStatus = await ctx.runQuery(
        internal.customOrchestratorHelpers.getSessionStatus,
        { sessionId }
      );
      if (finalStatus === "cancelled") {
        await scheduleProgressAndFinalizationCheck(ctx, evaluationId, evaluation);
        return;
      }

      // Mark session complete
      await ctx.runMutation(
        internal.customOrchestratorHelpers.updateSessionStatus,
        {
          sessionId,
          status: "completed",
          completedAt: Date.now(),
          totalTurns: turnNumber - 1,
        }
      );

      // Schedule evaluation for this session
      await ctx.scheduler.runAfter(
        0,
        internal.customGalileoEval.evaluateCustomSession,
        {
          sessionId,
          evaluationId,
          galileoApiKey: args.galileoApiKey,
        }
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Session error (${sessionId}, model=${modelId}):`,
        errorMessage
      );

      await ctx.runMutation(
        internal.customOrchestratorHelpers.updateSessionStatus,
        {
          sessionId,
          status: "failed",
          completedAt: Date.now(),
          errorMessage,
        }
      );

      // Schedule evaluation even for failed sessions so the model appears on
      // the leaderboard with meaningful scores (e.g. tool metrics = 0 when no
      // tools were called).
      await ctx.scheduler.runAfter(
        0,
        internal.customGalileoEval.evaluateCustomSession,
        {
          sessionId,
          evaluationId,
          galileoApiKey: args.galileoApiKey,
        }
      );
    }

    // Update progress and check if all sessions are done
    await scheduleProgressAndFinalizationCheck(ctx, evaluationId, evaluation);
  },
});

// ---------------------------------------------------------------------------
// Helper — update progress counters and trigger finalization if all done
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scheduleProgressAndFinalizationCheck(
  ctx: any,
  evaluationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluation: any
) {
  const allSessions = await ctx.runQuery(
    internal.customOrchestratorHelpers.getAllSessions,
    { evaluationId }
  ) as { _id: string; status: string }[];

  const completed = allSessions.filter(
    (s) => s.status === "completed" || s.status === "failed"
  ).length;
  const failed = allSessions.filter((s) => s.status === "failed").length;

  await ctx.runMutation(
    internal.customOrchestratorHelpers.updateEvaluationProgress,
    {
      id: evaluationId,
      progress: {
        totalModels: evaluation.selectedModelIds.length,
        totalScenarios: evaluation.generatedConfig?.scenarios.length ?? 0,
        completedSessions: completed,
        totalSessions: allSessions.length,
        failedSessions: failed,
        currentPhase: `Running sessions (${completed}/${allSessions.length})`,
      },
    }
  );

  const allDone = allSessions.every(
    (s) =>
      s.status === "completed" ||
      s.status === "failed" ||
      s.status === "cancelled"
  );

  if (allDone) {
    await ctx.scheduler.runAfter(
      500,
      internal.customGalileoEval.finalizeEvaluation,
      { evaluationId }
    );
  }
}
