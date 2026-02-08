import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  EvaluationProgress as EvaluationProgressType,
  CustomEvaluationStatus,
} from "@/lib/types";

interface EvaluationProgressProps {
  progress: EvaluationProgressType | undefined;
  status: CustomEvaluationStatus;
  modelIds: string[];
}

const PHASES = [
  { key: "generating", label: "Generate" },
  { key: "running", label: "Run" },
  { key: "evaluating", label: "Evaluate" },
  { key: "completed", label: "Complete" },
] as const;

function getPhaseIndex(status: CustomEvaluationStatus): number {
  switch (status) {
    case "generating":
      return 0;
    case "running":
      return 1;
    case "evaluating":
      return 2;
    case "completed":
      return 3;
    default:
      return -1;
  }
}

export default function EvaluationProgress({
  progress,
  status,
  modelIds: _modelIds,
}: EvaluationProgressProps) {
  const activeIndex = getPhaseIndex(status);

  const progressPercent =
    progress && progress.totalSessions > 0
      ? Math.round((progress.completedSessions / progress.totalSessions) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Phase indicator */}
      <div className="flex items-center gap-1">
        {PHASES.map((phase, i) => {
          const isActive = i === activeIndex;
          const isComplete = i < activeIndex;
          return (
            <div key={phase.key} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={cn(
                    "h-px w-6",
                    isComplete ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isActive && "bg-primary text-primary-foreground animate-pulse",
                  isComplete && "bg-primary/20 text-primary",
                  !isActive && !isComplete && "bg-muted text-muted-foreground"
                )}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Running progress */}
      {status === "running" && progress && (
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-sm text-muted-foreground">
            Running evaluations... {progress.completedSessions} of{" "}
            {progress.totalSessions} complete
          </p>
        </div>
      )}

      {/* Evaluating */}
      {status === "evaluating" && (
        <p className="text-sm text-muted-foreground">
          Computing scores and building leaderboard...
        </p>
      )}
    </div>
  );
}
