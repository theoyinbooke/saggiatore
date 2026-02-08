// Local TypeScript interfaces mirroring the Convex schema.
// These allow components to compile even when Convex is not fully configured.

export type ComplexityLevel = "low" | "medium" | "high";

export type ScenarioCategory =
  | "visa_application"
  | "status_change"
  | "family_immigration"
  | "deportation_defense"
  | "humanitarian";

export type SessionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "cancelled";

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface Persona {
  _id: string;
  name: string;
  age: number;
  nationality: string;
  countryFlag: string;
  currentStatus: string;
  visaType: string;
  complexityLevel: ComplexityLevel;
  backstory: string;
  goals: string[];
  challenges: string[];
  familyInfo?: string;
  employmentInfo?: string;
  educationInfo?: string;
  tags: string[];
}

export interface Scenario {
  _id: string;
  title: string;
  category: ScenarioCategory;
  complexity: ComplexityLevel;
  description: string;
  personaId: string;
  expectedTools: string[];
  successCriteria: string[];
  maxTurns: number;
}

export interface Tool {
  _id: string;
  name: string;
  description: string;
  category: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
  returnType: string;
  returnDescription: string;
}

export interface Session {
  _id: string;
  scenarioId: string;
  personaId: string;
  modelId: string;
  status: SessionStatus;
  startedAt?: number;
  completedAt?: number;
  totalTurns: number;
  errorMessage?: string;
}

export interface Message {
  _id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  turnNumber: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: number;
}

export interface EvaluationMetrics {
  toolAccuracy: number;
  empathy: number;
  factualCorrectness: number;
  completeness: number;
  safetyCompliance: number;
}

export interface CategoryScores {
  visa_application?: number;
  status_change?: number;
  family_immigration?: number;
  deportation_defense?: number;
  humanitarian?: number;
}

export interface Evaluation {
  _id: string;
  sessionId: string;
  overallScore: number;
  metrics: EvaluationMetrics;
  categoryScores?: CategoryScores;
  failureAnalysis?: string[];
  galileoTraceId?: string;
  galileoConsoleUrl?: string;
  evaluatedAt: number;
}

export interface LeaderboardEntry {
  _id: string;
  modelId: string;
  overallScore: number;
  totalEvaluations: number;
  metrics: EvaluationMetrics;
  categoryScores: Required<CategoryScores>;
  lastUpdated: number;
}

export interface ModelRegistryEntry {
  _id: string;
  modelId: string;
  displayName: string;
  provider: "openai" | "openrouter" | "groq";
  apiModel: string;
  envKey: string;
  enabled: boolean;
  supportsTools: boolean;
  sortOrder: number;
  color: string;
  lastSyncedAt: number;
  contextWindow?: number;
  description?: string;
}

// ============================================
// My Saggiatore Types
// ============================================

export type CustomEvaluationStatus = "draft" | "generating" | "running" | "evaluating" | "completed" | "failed";

export interface GeneratedPersona {
  id: string;
  name: string;
  role: string;
  backstory: string;
  goals: string[];
  challenges: string[];
  traits: string[];
}

export interface GeneratedTool {
  name: string;
  description: string;
  category: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
  returnType: string;
  returnDescription: string;
}

export interface GeneratedScenario {
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

export interface GeneratedCategory {
  id: string;
  displayName: string;
}

export interface GeneratedMetric {
  key: string;
  displayName: string;
  description: string;
  weight: number;
}

export interface GeneratedConfig {
  domain: string;
  agentSystemPrompt: string;
  personas: GeneratedPersona[];
  tools: GeneratedTool[];
  scenarios: GeneratedScenario[];
  categories: GeneratedCategory[];
  metrics: GeneratedMetric[];
}

export interface EvaluationProgress {
  totalModels: number;
  totalScenarios: number;
  completedSessions: number;
  totalSessions: number;
  failedSessions: number;
  currentPhase: string;
}

export interface CustomEvaluation {
  _id: string;
  userId: string;
  title: string;
  useCaseDescription: string;
  selectedModelIds: string[];
  generatedConfig?: GeneratedConfig;
  status: CustomEvaluationStatus;
  progress?: EvaluationProgress;
  shareId?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  errorMessage?: string;
  galileoProjectName?: string;
  galileoLogStreamName?: string;
  galileoMetricMapping?: Record<string, { galileoName: string; isBuiltIn: boolean; isInverted?: boolean }>;
  galileoSetupError?: string;
}

export interface CustomSession {
  _id: string;
  evaluationId: string;
  scenarioLocalId: string;
  personaLocalId: string;
  modelId: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout" | "cancelled";
  startedAt?: number;
  completedAt?: number;
  totalTurns: number;
  errorMessage?: string;
}

export interface CustomSessionEvaluation {
  _id: string;
  sessionId: string;
  evaluationId: string;
  overallScore: number;
  metricScores: Record<string, number>;
  categoryScore?: { category: string; score: number };
  failureAnalysis?: string[];
  galileoTraceId?: string;
  galileoConsoleUrl?: string;
  scoringSource?: string;
  evaluatedAt: number;
}

export interface CustomLeaderboardEntry {
  _id: string;
  evaluationId: string;
  modelId: string;
  overallScore: number;
  totalSessions: number;
  metricScores: Record<string, number>;
  categoryScores: Record<string, number>;
  lastUpdated: number;
}
