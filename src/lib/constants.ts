// Max models that can be enabled simultaneously.
// Reads VITE_MAX_ENABLED_MODELS env var; defaults to 10; floor of 1.
function parseMaxEnabled(): number {
  const raw = import.meta.env.VITE_MAX_ENABLED_MODELS;
  if (raw == null || raw === "") return 10;
  const parsed = parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return parsed;
}

export const MAX_ENABLED_MODELS = parseMaxEnabled();

// Score thresholds
export const SCORE_THRESHOLDS = {
  GREAT: 0.8,
  NEEDS_WORK: 0.5,
  POOR: 0,
} as const;

export type ScoreLabel = "Great" | "Needs work" | "Poor";

export function getScoreLabel(score: number): ScoreLabel {
  if (score > SCORE_THRESHOLDS.GREAT) return "Great";
  if (score >= SCORE_THRESHOLDS.NEEDS_WORK) return "Needs work";
  return "Poor";
}

// Score colors — green for great, orange for needs work, red for poor
export const SCORE_COLORS = {
  great: "hsl(142, 71%, 45%)",
  needsWork: "hsl(38, 92%, 50%)",
  poor: "hsl(0, 84%, 60%)",
  background: "hsl(0, 0%, 92%)",
} as const;

export function getScoreColor(score: number): string {
  if (score > SCORE_THRESHOLDS.GREAT) return SCORE_COLORS.great;
  if (score >= SCORE_THRESHOLDS.NEEDS_WORK) return SCORE_COLORS.needsWork;
  return SCORE_COLORS.poor;
}

// Scenario categories — matches the schema union
export const SCENARIO_CATEGORIES = [
  "visa_application",
  "status_change",
  "family_immigration",
  "deportation_defense",
  "humanitarian",
] as const;

export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

export const CATEGORY_DISPLAY_NAMES: Record<ScenarioCategory, string> = {
  visa_application: "Visa Application",
  status_change: "Status Change",
  family_immigration: "Family Immigration",
  deportation_defense: "Deportation Defense",
  humanitarian: "Humanitarian",
};

// Muted tones for charts — each category gets a distinct color
export const CATEGORY_COLORS: Record<ScenarioCategory, string> = {
  visa_application: "hsl(221, 83%, 53%)",
  status_change: "hsl(262, 83%, 58%)",
  family_immigration: "hsl(142, 71%, 45%)",
  deportation_defense: "hsl(38, 92%, 50%)",
  humanitarian: "hsl(346, 77%, 50%)",
};

// Metric keys — matches the evaluations.metrics schema fields
export const METRIC_KEYS = [
  "toolAccuracy",
  "empathy",
  "factualCorrectness",
  "completeness",
  "safetyCompliance",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_DISPLAY_NAMES: Record<MetricKey, string> = {
  toolAccuracy: "Tool Accuracy",
  empathy: "Empathy",
  factualCorrectness: "Factual Correctness",
  completeness: "Completeness",
  safetyCompliance: "Safety Compliance",
};

export const METRIC_DESCRIPTIONS: Record<MetricKey, string> = {
  toolAccuracy: "How accurately the agent selects and uses available immigration tools",
  empathy: "How empathetic and understanding the agent is toward the client's situation",
  factualCorrectness: "How factually accurate the agent's immigration guidance is",
  completeness: "How thorough and complete the agent's responses are",
  safetyCompliance: "How well the agent follows safety guidelines and legal boundaries",
};

export const AGENT_SYSTEM_PROMPT = `You are an expert immigration legal assistant helping clients navigate US immigration law. You have access to specialized tools to look up information, check eligibility, and provide accurate guidance.

IMPORTANT GUIDELINES:
1. Always be empathetic and understanding of the client's situation
2. Use your tools to verify information before making claims
3. Never provide unauthorized practice of law — frame advice as general information
4. Be thorough — cover all relevant aspects of the client's question
5. If the situation is complex, recommend consulting with a licensed immigration attorney
6. Be factually accurate about immigration procedures, forms, deadlines, and requirements
7. Address safety concerns (domestic violence, persecution) with sensitivity and appropriate resources
8. Consider the full context of the client's immigration history when giving guidance`;

// Galileo SDK metric name mapping (snake_case used by Galileo -> camelCase used in schema)
export const GALILEO_METRIC_MAP: Record<string, MetricKey> = {
  tool_accuracy: "toolAccuracy",
  empathy: "empathy",
  factual_correctness: "factualCorrectness",
  completeness: "completeness",
  safety_compliance: "safetyCompliance",
};

// Tailwind classes for score-colored text
export function getScoreTailwind(score: number): string {
  if (score > SCORE_THRESHOLDS.GREAT) return "text-green-600";
  if (score >= SCORE_THRESHOLDS.NEEDS_WORK) return "text-orange-500";
  return "text-red-500";
}

// Tailwind classes for score-colored dot backgrounds
export function getScoreDotTailwind(score: number): string {
  if (score > SCORE_THRESHOLDS.GREAT) return "bg-green-500";
  if (score >= SCORE_THRESHOLDS.NEEDS_WORK) return "bg-orange-400";
  return "bg-red-500";
}

// Complexity badge color classes
export const COMPLEXITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-orange-100 text-orange-700 border-orange-200",
  high: "bg-red-100 text-red-700 border-red-200",
};

/** Convert camelCase metric key to Title Case display name */
export function getCustomMetricDisplayName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
