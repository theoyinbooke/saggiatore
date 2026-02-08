import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTrash } from "@tabler/icons-react";
import { formatDate } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getModelDisplayName } from "@/lib/models";
import { getScoreTailwind } from "@/lib/constants";
import type { CustomEvaluation, CustomEvaluationStatus } from "@/lib/types";

interface EvaluationCardProps {
  evaluation: CustomEvaluation;
  onClick?: () => void;
  onDelete?: (id: string) => void;
}

const STATUS_STYLES: Record<CustomEvaluationStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  generating: "bg-yellow-100 text-yellow-700 border-yellow-200",
  running: "bg-blue-100 text-blue-700 border-blue-200",
  evaluating: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

export default function EvaluationCard({
  evaluation,
  onClick,
  onDelete,
}: EvaluationCardProps) {
  const isCompleted = evaluation.status === "completed";

  const rawTopEntry = useQuery(
    api.customLeaderboard.getTopByEvaluation,
    isCompleted ? { evaluationId: evaluation._id as never } : "skip"
  );

  const topEntry = rawTopEntry ?? null;

  return (
    <Card
      className={
        onClick
          ? "cursor-pointer transition-shadow hover:shadow-md"
          : ""
      }
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="truncate">{evaluation.title}</CardTitle>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(evaluation._id);
            }}
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={STATUS_STYLES[evaluation.status]}>
              {evaluation.status}
            </Badge>
            {evaluation.generatedConfig?.domain && (
              <Badge variant="secondary">
                {evaluation.generatedConfig.domain}
              </Badge>
            )}
          </div>
          {topEntry && (
            <span
              className={`text-sm font-semibold ${getScoreTailwind(topEntry.overallScore)}`}
            >
              {Math.round(topEntry.overallScore * 100)}%
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{formatDate(evaluation.createdAt)}</span>
          {topEntry && (
            <span className="max-w-24 truncate font-medium">
              {getModelDisplayName(topEntry.modelId)}
            </span>
          )}
          <span>{evaluation.selectedModelIds.length} models</span>
        </div>
      </CardFooter>
    </Card>
  );
}
