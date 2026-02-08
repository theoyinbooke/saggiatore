import { ScoreDonut } from "@/components/ScoreDonut";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  IconExternalLink,
  IconChevronDown,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  getScoreLabel,
  getScoreDotTailwind,
  METRIC_DISPLAY_NAMES,
  type MetricKey,
  METRIC_KEYS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Evaluation } from "@/lib/types";
import { useState } from "react";

interface EvaluationPanelProps {
  evaluation: Evaluation;
}

export function EvaluationPanel({ evaluation }: EvaluationPanelProps) {
  const [failuresOpen, setFailuresOpen] = useState(false);
  const label = getScoreLabel(evaluation.overallScore);

  return (
    <div className="space-y-6">
      {/* Overall score */}
      <div className="flex flex-col items-center gap-2 py-4">
        <ScoreDonut score={evaluation.overallScore} size="lg" showLabel />
        <p className="text-sm text-muted-foreground">
          {label === "Great"
            ? "Excellent performance across all metrics."
            : label === "Needs work"
              ? "Some areas need improvement."
              : "Significant issues detected."}
        </p>
      </div>

      <Separator />

      {/* Metric stat row */}
      <div className="flex flex-wrap justify-center gap-6">
        {METRIC_KEYS.map((key) => {
          const value = evaluation.metrics[key as keyof typeof evaluation.metrics];
          return (
            <div key={key} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  getScoreDotTailwind(value)
                )}
              />
              <span className="text-xs text-muted-foreground">
                {METRIC_DISPLAY_NAMES[key as MetricKey]}
              </span>
              <span className="text-sm font-medium">
                {(value * 100).toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Failure analysis */}
      {evaluation.failureAnalysis && evaluation.failureAnalysis.length > 0 && (
        <>
          <Separator />
          <Collapsible open={failuresOpen} onOpenChange={setFailuresOpen}>
            <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm font-medium hover:text-foreground text-muted-foreground">
              <IconAlertTriangle className="h-4 w-4 text-orange-500" />
              Failure Analysis ({evaluation.failureAnalysis.length})
              <IconChevronDown
                className={cn(
                  "ml-auto h-4 w-4 transition-transform",
                  failuresOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-2 space-y-1.5">
                {evaluation.failureAnalysis.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* Galileo Console link */}
      {evaluation.galileoConsoleUrl && (
        <>
          <Separator />
          <div className="flex justify-center">
            <Button variant="outline" size="sm" asChild>
              <a
                href={evaluation.galileoConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                <IconExternalLink className="h-4 w-4" />
                View in Galileo Console
              </a>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
