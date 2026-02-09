import { IconLoader2 } from "@tabler/icons-react";
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
    case "cancelled":
      return 1;
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
                  isActive && status !== "cancelled" && "bg-primary text-primary-foreground animate-pulse",
                  isActive && status === "cancelled" && "bg-amber-100 text-amber-700",
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

      {/* Evaluating — Galileo scoring in progress */}
      {status === "evaluating" && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <IconLoader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Scoring with Galileo
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Galileo is evaluating each session against your metrics. This
            typically takes 1–3 minutes. Results will appear automatically once
            scoring is complete.
          </p>
        </div>
      )}

      {status === "cancelled" && (
        <p className="text-sm font-medium text-amber-600">
          Evaluation was cancelled
        </p>
      )}
    </div>
  );
}
