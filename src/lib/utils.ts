import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import {
  getScoreLabel as _getScoreLabel,
  getScoreColor as _getScoreColor,
  CATEGORY_COLORS,
  type ScenarioCategory,
} from "./constants"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a 0-1 score to 2 decimal places (e.g. 0.85) */
export function formatScore(score: number): string {
  return score.toFixed(2)
}

/** Format a 0-1 score as a percentage string (e.g. "85%") */
export function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`
}

/** Format a millisecond duration to human-readable (e.g. "1m 23s") */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

/** Format a timestamp (ms since epoch) to a localized date string */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Get the label for a score: "Great" | "Needs work" | "Poor" */
export const getScoreLabel = _getScoreLabel

/** Get the HSL color string for a score */
export const getScoreColor = _getScoreColor

/** Get the chart color for a scenario category */
export function getCategoryColor(category: ScenarioCategory): string {
  return CATEGORY_COLORS[category]
}
