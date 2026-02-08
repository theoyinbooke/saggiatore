"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireAdmin } from "./authHelpers";
import type { Id } from "./_generated/dataModel";
import { callLLM } from "./llmClient";
import type { OpenAIMessage, OpenAIToolDef, LLMProvider } from "./llmClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolDefinition {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
  returnType: string;
  returnDescription: string;
}

// ---------------------------------------------------------------------------
// Convert our tool definitions to OpenAI function calling format
// ---------------------------------------------------------------------------

function toOpenAITools(tools: ToolDefinition[]): OpenAIToolDef[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object" as const,
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            { type: p.type, description: p.description },
          ])
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}

// ---------------------------------------------------------------------------
// Call the agent (routes based on provider config)
// ---------------------------------------------------------------------------

interface ModelConfig {
  provider: LLMProvider;
  apiModel: string;
  supportsTools: boolean;
}

// Legacy fallback when registry lookup fails
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

async function callAgent(
  config: ModelConfig,
  messages: OpenAIMessage[],
  tools: OpenAIToolDef[]
): Promise<{ content: string | null; tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[] }> {
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
// Persona simulator (GPT-4o-mini)
// ---------------------------------------------------------------------------

async function callPersonaSimulator(
  personaSystemPrompt: string,
  conversationHistory: OpenAIMessage[]
): Promise<string> {
  // Build messages from the persona's perspective: user messages become assistant
  // and assistant messages become user
  const perspectiveMessages: OpenAIMessage[] = [
    { role: "system", content: personaSystemPrompt },
  ];

  for (const msg of conversationHistory) {
    if (msg.role === "user") {
      // Persona's own previous messages
      perspectiveMessages.push({ role: "assistant", content: msg.content });
    } else if (msg.role === "assistant" && msg.content) {
      // Agent's messages appear as user to the persona
      perspectiveMessages.push({ role: "user", content: msg.content });
    }
    // Skip system, tool messages from agent perspective
  }

  const result = await callLLM("openai", perspectiveMessages, undefined, "gpt-4o-mini");
  return result.content ?? "I'm not sure what to say.";
}

// ---------------------------------------------------------------------------
// Tool response simulator (GPT-4o-mini)
// ---------------------------------------------------------------------------

async function callToolSimulator(
  toolName: string,
  toolArguments: string,
  toolDefinition: ToolDefinition
): Promise<string> {
  const systemPrompt = `You are a simulated immigration tool API. You return realistic, plausible JSON responses for immigration-related tool calls.

Tool: ${toolName}
Description: ${toolDefinition.description}
Expected return: ${toolDefinition.returnType} — ${toolDefinition.returnDescription}

Return a realistic JSON response based on the arguments provided. Make the data plausible and detailed for an immigration context. Return ONLY valid JSON, no explanation.`;

  const result = await callLLM(
    "openai",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Arguments: ${toolArguments}` },
    ],
    undefined,
    "gpt-4o-mini"
  );

  return result.content ?? JSON.stringify({ error: "Tool simulation failed" });
}

// ---------------------------------------------------------------------------
// Build system prompts
// ---------------------------------------------------------------------------

function buildAgentSystemPrompt(tools: ToolDefinition[]): string {
  const toolList = tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  return `You are an expert immigration legal assistant helping clients navigate US immigration law. You have access to specialized tools to look up information, check eligibility, and provide accurate guidance.

IMPORTANT GUIDELINES:
1. Always be empathetic and understanding of the client's situation
2. Use your tools to verify information before making claims
3. Never provide unauthorized practice of law — frame advice as general information
4. Be thorough — cover all relevant aspects of the client's question
5. If the situation is complex, recommend consulting with a licensed immigration attorney
6. Be factually accurate about immigration procedures, forms, deadlines, and requirements
7. Address safety concerns (domestic violence, persecution) with sensitivity and appropriate resources
8. Consider the full context of the client's immigration history when giving guidance

Available tools:
${toolList}

Use tools proactively to look up current processing times, eligibility requirements, and form information. Do not guess when you can verify with a tool.`;
}

function buildPersonaSystemPrompt(
  persona: {
    name: string;
    age: number;
    nationality: string;
    currentStatus: string;
    visaType: string;
    backstory: string;
    goals: string[];
    challenges: string[];
    familyInfo?: string;
    employmentInfo?: string;
    educationInfo?: string;
  },
  scenario: {
    title: string;
    description: string;
  }
): string {
  return `You are roleplaying as ${persona.name}, a ${persona.age}-year-old ${persona.nationality} national.

YOUR BACKGROUND:
- Current status: ${persona.currentStatus}
- Visa type: ${persona.visaType}
- Backstory: ${persona.backstory}
${persona.familyInfo ? `- Family: ${persona.familyInfo}` : ""}
${persona.employmentInfo ? `- Employment: ${persona.employmentInfo}` : ""}
${persona.educationInfo ? `- Education: ${persona.educationInfo}` : ""}

YOUR GOALS:
${persona.goals.map((g) => `- ${g}`).join("\n")}

YOUR CHALLENGES:
${persona.challenges.map((c) => `- ${c}`).join("\n")}

SCENARIO: ${scenario.title}
${scenario.description}

INSTRUCTIONS:
- Stay in character as ${persona.name} throughout the conversation
- Ask questions a real person in this situation would ask
- Show appropriate emotions (anxiety about status, hope for resolution, confusion about process)
- Respond to the agent's advice with follow-up questions that dig deeper
- If the agent uses technical terms, ask for clarification like a real client would
- Share relevant details from your background naturally as the conversation progresses
- Keep responses concise (2-4 sentences typically)

Start by introducing yourself and describing your current situation and what you need help with.`;
}

// ---------------------------------------------------------------------------
// Main entry point — called from the UI
// ---------------------------------------------------------------------------

export const startSession = action({
  args: {
    scenarioId: v.id("scenarios"),
    modelId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"sessions">> => {
    await requireAdmin(ctx);

    // 1. Load scenario and persona
    const scenario = await ctx.runQuery(internal.orchestratorHelpers.getScenario, {
      scenarioId: args.scenarioId,
    });
    if (!scenario) throw new Error("Scenario not found");

    const persona = await ctx.runQuery(internal.orchestratorHelpers.getPersona, {
      personaId: scenario.personaId,
    });
    if (!persona) throw new Error("Persona not found");

    await ctx.runQuery(internal.orchestratorHelpers.getAllTools);

    // 2. Create session
    const sessionId = await ctx.runMutation(
      internal.orchestratorHelpers.createSession,
      {
        scenarioId: args.scenarioId,
        personaId: scenario.personaId,
        modelId: args.modelId,
      }
    );

    // 3. Run the conversation asynchronously
    // We schedule the actual loop so the UI gets the sessionId immediately
    await ctx.scheduler.runAfter(0, internal.orchestrator.runConversation, {
      sessionId,
      scenarioId: args.scenarioId,
      modelId: args.modelId,
    });

    return sessionId;
  },
});

// ---------------------------------------------------------------------------
// Conversation loop (scheduled action)
// ---------------------------------------------------------------------------

export const runConversation = internalAction({
  args: {
    sessionId: v.id("sessions"),
    scenarioId: v.id("scenarios"),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    const { sessionId, scenarioId, modelId } = args;

    try {
      // Look up model config from registry, with legacy fallback
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
        // Registry not available yet — use legacy fallback
        if (LEGACY_MODELS[modelId]) {
          modelConfig = LEGACY_MODELS[modelId];
        } else {
          throw lookupErr;
        }
      }

      // Load data
      const scenario = await ctx.runQuery(internal.orchestratorHelpers.getScenario, {
        scenarioId,
      });
      if (!scenario) throw new Error("Scenario not found");

      const persona = await ctx.runQuery(internal.orchestratorHelpers.getPersona, {
        personaId: scenario.personaId,
      });
      if (!persona) throw new Error("Persona not found");

      const allTools = await ctx.runQuery(internal.orchestratorHelpers.getAllTools);
      const toolMap = new Map(allTools.map((t) => [t.name, t]));

      // Update session to running
      await ctx.runMutation(internal.orchestratorHelpers.updateSessionStatus, {
        sessionId,
        status: "running",
        startedAt: Date.now(),
      });

      // Build prompts
      const agentSystemPrompt = buildAgentSystemPrompt(allTools);
      const personaPrompt = buildPersonaSystemPrompt(persona, scenario);
      const openAITools = toOpenAITools(allTools);

      // Store system message
      await ctx.runMutation(internal.orchestratorHelpers.insertMessage, {
        sessionId,
        role: "system",
        content: agentSystemPrompt,
        turnNumber: 0,
        timestamp: Date.now(),
      });

      // Conversation state
      const agentHistory: OpenAIMessage[] = [
        { role: "system", content: agentSystemPrompt },
      ];
      const personaConversation: OpenAIMessage[] = [];

      let turnNumber = 1;
      const maxTurns = scenario.maxTurns;

      // Get initial persona message
      const initialPersonaMsg = await callPersonaSimulator(
        personaPrompt,
        []
      );

      // Store and add to history
      await ctx.runMutation(internal.orchestratorHelpers.insertMessage, {
        sessionId,
        role: "user",
        content: initialPersonaMsg,
        turnNumber,
        timestamp: Date.now(),
      });

      agentHistory.push({ role: "user", content: initialPersonaMsg });
      personaConversation.push({ role: "user", content: initialPersonaMsg });
      turnNumber++;

      // Main conversation loop
      while (turnNumber <= maxTurns) {
        // Check for cancellation before calling the agent
        const currentStatus = await ctx.runQuery(
          internal.orchestratorHelpers.getSessionStatus, { sessionId }
        );
        if (currentStatus === "cancelled") break;

        // Agent responds
        const agentResponse = await callAgent(modelConfig, agentHistory, openAITools);

        // Handle tool calls
        if (agentResponse.tool_calls && agentResponse.tool_calls.length > 0) {
          // Store the assistant message with tool calls (content may be null)
          const toolCallsForDb = agentResponse.tool_calls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }));

          await ctx.runMutation(internal.orchestratorHelpers.insertMessage, {
            sessionId,
            role: "assistant",
            content: agentResponse.content ?? "",
            turnNumber,
            toolCalls: toolCallsForDb,
            timestamp: Date.now(),
          });

          agentHistory.push({
            role: "assistant",
            content: agentResponse.content,
            tool_calls: agentResponse.tool_calls.map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: tc.function,
            })),
          });

          // Process each tool call
          for (const toolCall of agentResponse.tool_calls) {
            const toolDef = toolMap.get(toolCall.function.name);
            let toolResult: string;

            if (toolDef) {
              try {
                toolResult = await callToolSimulator(
                  toolCall.function.name,
                  toolCall.function.arguments,
                  toolDef
                );
              } catch (err) {
                toolResult = JSON.stringify({
                  error: `Tool simulation error: ${err instanceof Error ? err.message : "Unknown error"}`,
                });
              }
            } else {
              toolResult = JSON.stringify({
                error: `Unknown tool: ${toolCall.function.name}`,
              });
            }

            // Store tool response
            await ctx.runMutation(internal.orchestratorHelpers.insertMessage, {
              sessionId,
              role: "tool",
              content: toolResult,
              turnNumber,
              toolCallId: toolCall.id,
              timestamp: Date.now(),
            });

            agentHistory.push({
              role: "tool",
              content: toolResult,
              tool_call_id: toolCall.id,
            });
          }

          turnNumber++;
          // Continue loop — agent will process tool results on next iteration
          continue;
        }

        // No tool calls — agent produced a text response
        const agentText = agentResponse.content ?? "";

        await ctx.runMutation(internal.orchestratorHelpers.insertMessage, {
          sessionId,
          role: "assistant",
          content: agentText,
          turnNumber,
          timestamp: Date.now(),
        });

        agentHistory.push({ role: "assistant", content: agentText });
        personaConversation.push({ role: "assistant", content: agentText });
        turnNumber++;

        // Check if we've reached max turns
        if (turnNumber > maxTurns) break;

        // Check for cancellation before calling persona simulator
        const statusCheck = await ctx.runQuery(
          internal.orchestratorHelpers.getSessionStatus, { sessionId }
        );
        if (statusCheck === "cancelled") break;

        // Persona responds
        const personaMsg = await callPersonaSimulator(
          personaPrompt,
          personaConversation
        );

        await ctx.runMutation(internal.orchestratorHelpers.insertMessage, {
          sessionId,
          role: "user",
          content: personaMsg,
          turnNumber,
          timestamp: Date.now(),
        });

        agentHistory.push({ role: "user", content: personaMsg });
        personaConversation.push({ role: "user", content: personaMsg });
        turnNumber++;
      }

      // Check if session was cancelled during the loop
      const finalStatus = await ctx.runQuery(
        internal.orchestratorHelpers.getSessionStatus, { sessionId }
      );
      if (finalStatus === "cancelled") return;

      // Conversation completed
      await ctx.runMutation(internal.orchestratorHelpers.updateSessionStatus, {
        sessionId,
        status: "completed",
        completedAt: Date.now(),
        totalTurns: turnNumber - 1,
      });

      // Schedule evaluation asynchronously — don't block session completion
      await ctx.scheduler.runAfter(0, api.galileoEval.evaluateSession, {
        sessionId,
      });
    } catch (error) {
      // Handle errors gracefully
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Orchestrator error:", errorMessage);

      await ctx.runMutation(internal.orchestratorHelpers.updateSessionStatus, {
        sessionId,
        status: "failed",
        completedAt: Date.now(),
        errorMessage,
      });

      // Schedule evaluation even for failed sessions so the model appears on
      // the leaderboard with meaningful scores (e.g. toolAccuracy = 0 when no
      // tools were called).
      await ctx.scheduler.runAfter(0, api.galileoEval.evaluateSession, {
        sessionId,
      });
    }
  },
});
