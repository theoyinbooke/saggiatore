import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  personas: defineTable({
    name: v.string(),
    age: v.number(),
    nationality: v.string(),
    countryFlag: v.string(),
    currentStatus: v.string(),
    visaType: v.string(),
    complexityLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    backstory: v.string(),
    goals: v.array(v.string()),
    challenges: v.array(v.string()),
    familyInfo: v.optional(v.string()),
    employmentInfo: v.optional(v.string()),
    educationInfo: v.optional(v.string()),
    tags: v.array(v.string()),
  })
    .index("by_visaType", ["visaType"])
    .index("by_complexityLevel", ["complexityLevel"])
    .index("by_nationality", ["nationality"]),

  tools: defineTable({
    name: v.string(),
    description: v.string(),
    category: v.string(),
    parameters: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        description: v.string(),
        required: v.boolean(),
      })
    ),
    returnType: v.string(),
    returnDescription: v.string(),
  }).index("by_category", ["category"]),

  scenarios: defineTable({
    title: v.string(),
    category: v.union(
      v.literal("visa_application"),
      v.literal("status_change"),
      v.literal("family_immigration"),
      v.literal("deportation_defense"),
      v.literal("humanitarian")
    ),
    complexity: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    description: v.string(),
    personaId: v.id("personas"),
    expectedTools: v.array(v.string()),
    successCriteria: v.array(v.string()),
    maxTurns: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_complexity", ["complexity"])
    .index("by_personaId", ["personaId"]),

  sessions: defineTable({
    scenarioId: v.id("scenarios"),
    personaId: v.id("personas"),
    modelId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("cancelled")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    totalTurns: v.number(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_modelId", ["modelId"])
    .index("by_scenarioId", ["scenarioId"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool")
    ),
    content: v.string(),
    turnNumber: v.number(),
    toolCalls: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          arguments: v.string(),
        })
      )
    ),
    toolCallId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_turnNumber", ["sessionId", "turnNumber"]),

  evaluations: defineTable({
    sessionId: v.id("sessions"),
    overallScore: v.number(),
    metrics: v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    }),
    categoryScores: v.optional(
      v.object({
        visa_application: v.optional(v.number()),
        status_change: v.optional(v.number()),
        family_immigration: v.optional(v.number()),
        deportation_defense: v.optional(v.number()),
        humanitarian: v.optional(v.number()),
      })
    ),
    failureAnalysis: v.optional(v.array(v.string())),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
    evaluatedAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  leaderboard: defineTable({
    modelId: v.string(),
    overallScore: v.number(),
    totalEvaluations: v.number(),
    metrics: v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    }),
    categoryScores: v.object({
      visa_application: v.number(),
      status_change: v.number(),
      family_immigration: v.number(),
      deportation_defense: v.number(),
      humanitarian: v.number(),
    }),
    lastUpdated: v.number(),
  }).index("by_modelId", ["modelId"]),

  // ============================================
  // My Saggiatore Tables (custom evaluations)
  // ============================================

  customEvaluations: defineTable({
    userId: v.string(),
    title: v.string(),
    useCaseDescription: v.string(),
    selectedModelIds: v.array(v.string()),
    generatedConfig: v.optional(v.object({
      domain: v.string(),
      agentSystemPrompt: v.string(),
      personas: v.array(v.object({
        id: v.string(),
        name: v.string(),
        role: v.string(),
        backstory: v.string(),
        goals: v.array(v.string()),
        challenges: v.array(v.string()),
        traits: v.array(v.string()),
      })),
      tools: v.array(v.object({
        name: v.string(),
        description: v.string(),
        category: v.string(),
        parameters: v.array(v.object({
          name: v.string(),
          type: v.string(),
          description: v.string(),
          required: v.boolean(),
        })),
        returnType: v.string(),
        returnDescription: v.string(),
      })),
      scenarios: v.array(v.object({
        id: v.string(),
        title: v.string(),
        category: v.string(),
        complexity: v.string(),
        description: v.string(),
        personaId: v.string(),
        expectedTools: v.array(v.string()),
        successCriteria: v.array(v.string()),
        maxTurns: v.number(),
      })),
      categories: v.array(v.object({
        id: v.string(),
        displayName: v.string(),
      })),
      metrics: v.array(v.object({
        key: v.string(),
        displayName: v.string(),
        description: v.string(),
        weight: v.number(),
      })),
    })),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("running"),
      v.literal("evaluating"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    progress: v.optional(v.object({
      totalModels: v.number(),
      totalScenarios: v.number(),
      completedSessions: v.number(),
      totalSessions: v.number(),
      failedSessions: v.number(),
      currentPhase: v.string(),
    })),
    shareId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    galileoProjectName: v.optional(v.string()),
    galileoProjectId: v.optional(v.string()),
    galileoLogStreamName: v.optional(v.string()),
    galileoMetricMapping: v.optional(v.any()),
    galileoSetupError: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_shareId", ["shareId"])
    .index("by_status", ["status"]),

  customSessions: defineTable({
    evaluationId: v.id("customEvaluations"),
    scenarioLocalId: v.string(),
    personaLocalId: v.string(),
    modelId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("cancelled")
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    totalTurns: v.number(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_evaluationId", ["evaluationId"])
    .index("by_evaluationId_modelId", ["evaluationId", "modelId"])
    .index("by_status", ["status"]),

  customMessages: defineTable({
    sessionId: v.id("customSessions"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool")
    ),
    content: v.string(),
    turnNumber: v.number(),
    toolCalls: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      arguments: v.string(),
    }))),
    toolCallId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_turnNumber", ["sessionId", "turnNumber"]),

  customSessionEvaluations: defineTable({
    sessionId: v.id("customSessions"),
    evaluationId: v.id("customEvaluations"),
    overallScore: v.number(),
    metricScores: v.any(),
    categoryScore: v.optional(v.object({
      category: v.string(),
      score: v.number(),
    })),
    failureAnalysis: v.optional(v.array(v.string())),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
    scoringSource: v.optional(v.string()),
    evaluatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_evaluationId", ["evaluationId"]),

  customLeaderboard: defineTable({
    evaluationId: v.id("customEvaluations"),
    modelId: v.string(),
    overallScore: v.number(),
    totalSessions: v.number(),
    metricScores: v.any(),
    categoryScores: v.any(),
    lastUpdated: v.number(),
  })
    .index("by_evaluationId", ["evaluationId"])
    .index("by_evaluationId_modelId", ["evaluationId", "modelId"]),

  // ============================================
  // Python SDK Ingestion Tables
  // ============================================

  pythonRuns: defineTable({
    runId: v.string(),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    models: v.array(v.string()),
    scenarioCount: v.number(),
    totalSessions: v.number(),
    completedSessions: v.number(),
    failedSessions: v.number(),
    galileoEnabled: v.boolean(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    sourceVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  pythonSessions: defineTable({
    runId: v.string(),
    sessionKey: v.string(),
    scenarioTitle: v.string(),
    scenarioCategory: v.string(),
    modelId: v.string(),
    personaName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("timeout"),
      v.literal("cancelled")
    ),
    totalTurns: v.number(),
    overallScore: v.number(),
    metrics: v.optional(v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    })),
    failureAnalysis: v.optional(v.array(v.string())),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_runId_sessionKey", ["runId", "sessionKey"])
    .index("by_modelId", ["modelId"]),

  pythonMessages: defineTable({
    runId: v.string(),
    sessionKey: v.string(),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool")
    ),
    content: v.string(),
    turnNumber: v.number(),
    toolCalls: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          arguments: v.string(),
        })
      )
    ),
    toolCallId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_runId_sessionKey", ["runId", "sessionKey"])
    .index("by_runId_sessionKey_turnNumber", ["runId", "sessionKey", "turnNumber"]),

  pythonEvaluations: defineTable({
    runId: v.string(),
    sessionKey: v.string(),
    modelId: v.string(),
    scenarioCategory: v.string(),
    overallScore: v.number(),
    metrics: v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    }),
    categoryScores: v.optional(
      v.object({
        visa_application: v.optional(v.number()),
        status_change: v.optional(v.number()),
        family_immigration: v.optional(v.number()),
        deportation_defense: v.optional(v.number()),
        humanitarian: v.optional(v.number()),
      })
    ),
    failureAnalysis: v.optional(v.array(v.string())),
    galileoTraceId: v.optional(v.string()),
    galileoConsoleUrl: v.optional(v.string()),
    evaluatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_runId_sessionKey", ["runId", "sessionKey"])
    .index("by_runId_modelId", ["runId", "modelId"]),

  pythonLeaderboard: defineTable({
    runId: v.string(),
    rank: v.number(),
    modelId: v.string(),
    overallScore: v.number(),
    totalEvaluations: v.number(),
    metrics: v.object({
      toolAccuracy: v.number(),
      empathy: v.number(),
      factualCorrectness: v.number(),
      completeness: v.number(),
      safetyCompliance: v.number(),
    }),
    categoryScores: v.object({
      visa_application: v.number(),
      status_change: v.number(),
      family_immigration: v.number(),
      deportation_defense: v.number(),
      humanitarian: v.number(),
    }),
    updatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_runId_rank", ["runId", "rank"])
    .index("by_runId_modelId", ["runId", "modelId"]),

  modelRegistry: defineTable({
    modelId: v.string(),
    displayName: v.string(),
    provider: v.union(v.literal("openai"), v.literal("openrouter"), v.literal("groq")),
    apiModel: v.string(),
    envKey: v.string(),
    enabled: v.boolean(),
    supportsTools: v.boolean(),
    sortOrder: v.number(),
    color: v.string(),
    lastSyncedAt: v.number(),
    contextWindow: v.optional(v.number()),
    description: v.optional(v.string()),
  })
    .index("by_modelId", ["modelId"])
    .index("by_provider", ["provider"])
    .index("by_enabled", ["enabled"]),
});
