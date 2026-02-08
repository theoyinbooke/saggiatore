import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowLeft, IconExternalLink, IconLoader2, IconRefresh } from "@tabler/icons-react";
import { getGalileoKey } from "@/lib/galileoKey";
import type { CustomEvaluation, CustomLeaderboardEntry } from "@/lib/types";
import GenericLeaderboardTable from "@/components/my/GenericLeaderboardTable";
import GenericCategoryBreakdown from "@/components/my/GenericCategoryBreakdown";
import EvaluationProgress from "@/components/my/EvaluationProgress";
import GeneratedContentViewer from "@/components/my/GeneratedContentViewer";
import ShareButton from "@/components/my/ShareButton";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  running: "Running",
  evaluating: "Evaluating",
  completed: "Completed",
  failed: "Failed",
};

export default function MyEvalDetailPage() {
  const { evalId } = useParams<{ evalId: string }>();
  const navigate = useNavigate();
  const generateConfig = useAction(api.customGenerator.generateEvaluationConfig);
  const [isRetrying, setIsRetrying] = useState(false);

  const rawEvaluation = useQuery(
    api.customEvaluations.getById,
    evalId ? { id: evalId as never } : "skip"
  );
  const rawLeaderboard = useQuery(
    api.customLeaderboard.getByEvaluation,
    evalId ? { evaluationId: evalId as never } : "skip"
  );

  // Show loading state while Convex queries resolve
  if (evalId && rawEvaluation === undefined) {
    return (
      <div>
        <PageHeader title="Evaluation Detail" />
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading evaluation…
        </div>
      </div>
    );
  }

  const evaluation: CustomEvaluation | undefined =
    rawEvaluation as CustomEvaluation | null | undefined ?? undefined;

  const leaderboard: CustomLeaderboardEntry[] =
    (rawLeaderboard as CustomLeaderboardEntry[] | undefined) ?? [];

  if (!evaluation) {
    return (
      <div>
        <PageHeader title="Evaluation Detail" />
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Evaluation not found
          </p>
          <button
            onClick={() => navigate("/my")}
            className="mt-4 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Back to Evaluations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() => navigate("/my")}
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Evaluations
        </Button>
      </div>

      <PageHeader title={evaluation.title || "Evaluation Detail"} />

      <div className="mb-4 flex items-center gap-2">
        <Badge variant="outline">
          {STATUS_LABELS[evaluation.status] ?? evaluation.status}
        </Badge>
        {evaluation.selectedModelIds.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {evaluation.selectedModelIds.length} model(s)
          </span>
        )}
      </div>

      {/* Phase: draft / generating / running / evaluating */}
      {(evaluation.status === "draft" ||
        evaluation.status === "generating" ||
        evaluation.status === "running" ||
        evaluation.status === "evaluating") && (
        <div className="space-y-4">
          <EvaluationProgress
            progress={evaluation.progress}
            status={evaluation.status}
            modelIds={evaluation.selectedModelIds}
          />

          {(evaluation.status === "draft" ||
            evaluation.status === "generating") && (
            <Card>
              <CardContent className="space-y-4 py-8">
                <div className="flex items-center gap-3">
                  <IconLoader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    AI is designing your evaluation framework...
                  </p>
                </div>
                <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                  <GeneratingStep label="Analyzing your use case description" />
                  <GeneratingStep label="Creating diverse test personas" />
                  <GeneratingStep label="Designing domain-specific tools" />
                  <GeneratingStep label="Building evaluation scenarios" />
                  <GeneratingStep label="Defining scoring metrics" />
                </div>
                <p className="ml-8 text-xs text-muted-foreground">
                  This typically takes 30–60 seconds.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Phase: completed */}
      {evaluation.status === "completed" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <ScoringSourceIndicator evaluation={evaluation} />
            {evaluation.shareId && (
              <ShareButton evaluationId={evaluation._id} shareId={evaluation.shareId} />
            )}
          </div>

          {leaderboard.length > 0 && evaluation.generatedConfig && (
            <>
              <GenericLeaderboardTable
                entries={leaderboard}
                metrics={evaluation.generatedConfig.metrics}
              />
              <GenericCategoryBreakdown
                entries={leaderboard}
                categories={evaluation.generatedConfig.categories}
              />
            </>
          )}

          {evaluation.generatedConfig && (
            <GeneratedContentViewer config={evaluation.generatedConfig} />
          )}
        </div>
      )}

      {/* Phase: failed */}
      {evaluation.status === "failed" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex items-center gap-2 text-destructive">
              <IconAlertTriangle className="h-5 w-5" />
              <p className="font-medium">Evaluation Failed</p>
            </div>
            {evaluation.errorMessage && (
              <p className="text-sm text-muted-foreground">
                {evaluation.errorMessage}
              </p>
            )}
            <Button
              variant="outline"
              disabled={isRetrying}
              onClick={async () => {
                if (!evalId || isRetrying) return;
                setIsRetrying(true);
                try {
                  generateConfig({
                    evaluationId: evalId as never,
                    galileoApiKey: getGalileoKey() || undefined,
                  });
                } catch (err) {
                  console.error("Retry failed:", err);
                  setIsRetrying(false);
                }
              }}
              className="gap-1.5"
            >
              {isRetrying ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4" />
              )}
              {isRetrying ? "Retrying..." : "Try Again"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoringSourceIndicator({ evaluation }: { evaluation: CustomEvaluation }) {
  const hasGalileo = !!evaluation.galileoProjectName && !evaluation.galileoSetupError;
  const hasSetupError = !!evaluation.galileoSetupError;

  if (hasGalileo) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-foreground">Scored by Galileo</span>
        </div>
        <a
          href={`https://console.galileo.ai/project/${encodeURIComponent(evaluation.galileoProjectName!)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 underline underline-offset-2"
        >
          View in Galileo Console
          <IconExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-amber-500" />
      <span className="text-sm font-medium text-foreground">Simulated Scores</span>
      {hasSetupError && (
        <span className="text-xs text-muted-foreground ml-1" title={evaluation.galileoSetupError}>
          — Galileo setup failed: {evaluation.galileoSetupError}
        </span>
      )}
    </div>
  );
}

function GeneratingStep({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />
      <span>{label}</span>
    </div>
  );
}
