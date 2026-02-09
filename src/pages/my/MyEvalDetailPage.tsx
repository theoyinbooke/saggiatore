import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowLeft, IconExternalLink, IconLoader2, IconPlayerStop, IconRefresh } from "@tabler/icons-react";
import { getGalileoKey } from "@/lib/galileoKey";
import type { CustomEvaluation, CustomLeaderboardEntry, CustomSession } from "@/lib/types";
import GenericLeaderboardTable from "@/components/my/GenericLeaderboardTable";
import GenericCategoryBreakdown from "@/components/my/GenericCategoryBreakdown";
import EvaluationProgress from "@/components/my/EvaluationProgress";
import GeneratedContentViewer from "@/components/my/GeneratedContentViewer";
import ShareButton from "@/components/my/ShareButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CustomModelSessionPanel } from "@/components/my/CustomModelSessionPanel";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  generating: "Generating",
  running: "Running",
  evaluating: "Evaluating",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

function getGridClass(count: number): string {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  if (count === 3) return "grid-cols-3";
  if (count <= 6) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function getPanelHeight(count: number): string {
  if (count <= 3) return "h-[500px]";
  if (count <= 6) return "h-[350px]";
  return "h-[280px]";
}

export default function MyEvalDetailPage() {
  const { evalId } = useParams<{ evalId: string }>();
  const navigate = useNavigate();
  const generateConfig = useAction(api.customGenerator.generateEvaluationConfig);
  const [isRetrying, setIsRetrying] = useState(false);
  const cancelEvaluation = useMutation(api.customEvaluations.cancelEvaluation);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const rawEvaluation = useQuery(
    api.customEvaluations.getById,
    evalId ? { id: evalId as never } : "skip"
  );
  const rawLeaderboard = useQuery(
    api.customLeaderboard.getByEvaluation,
    evalId ? { evaluationId: evalId as never } : "skip"
  );

  const shouldFetchSessions = rawEvaluation &&
    ((rawEvaluation as any).status === "running" || (rawEvaluation as any).status === "evaluating" || (rawEvaluation as any).status === "cancelled");
  const rawSessions = useQuery(
    api.customSessions.listByEvaluationPublic,
    shouldFetchSessions ? { evaluationId: evalId as never } : "skip"
  );
  const sessions: CustomSession[] = (rawSessions as CustomSession[] | undefined) ?? [];

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
        {(evaluation.status === "running" || evaluation.status === "evaluating") && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCancelConfirm(true)}
          >
            <IconPlayerStop className="h-4 w-4" />
            Cancel Evaluation
          </Button>
        )}
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

          {/* Activity grid for running sessions */}
          {(evaluation.status === "running" || evaluation.status === "evaluating") && sessions.length > 0 && (() => {
            const modelIds = [...new Set(sessions.map((s: CustomSession) => s.modelId))];
            const activeSessionPerModel = new Map<string, CustomSession>();
            for (const modelId of modelIds) {
              const modelSessions = sessions.filter((s: CustomSession) => s.modelId === modelId);
              const active = modelSessions.find((s: CustomSession) => s.status === "running")
                ?? modelSessions.find((s: CustomSession) => s.status === "pending")
                ?? modelSessions[modelSessions.length - 1];
              if (active) activeSessionPerModel.set(modelId, active);
            }
            const completedByModel = (modelId: string) =>
              sessions.filter((s: CustomSession) => s.modelId === modelId && (s.status === "completed" || s.status === "failed")).length;
            const totalByModel = (modelId: string) =>
              sessions.filter((s: CustomSession) => s.modelId === modelId).length;
            return (
              <div className={cn("grid gap-4", getGridClass(modelIds.length))}>
                {modelIds.map((modelId) => {
                  const session = activeSessionPerModel.get(modelId);
                  if (!session) return null;
                  return (
                    <CustomModelSessionPanel
                      key={modelId}
                      session={session}
                      completedCount={completedByModel(modelId)}
                      totalCount={totalByModel(modelId)}
                      panelHeight={getPanelHeight(modelIds.length)}
                    />
                  );
                })}
              </div>
            );
          })()}

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

          {leaderboard.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10">
                <IconLoader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm font-medium">
                  Galileo is still computing scores
                </p>
                <p className="max-w-md text-center text-sm text-muted-foreground">
                  Your evaluation sessions have been ingested. Galileo is scoring them against
                  your metrics — this can take a few minutes. Check back shortly or view progress
                  in the Galileo Console.
                </p>
                {(evaluation.galileoProjectId || evaluation.galileoProjectName) && (
                  <a
                    href={
                      evaluation.galileoProjectId
                        ? `https://app.galileo.ai/meetumo/project/${encodeURIComponent(evaluation.galileoProjectId)}`
                        : `https://app.galileo.ai/meetumo/project/${encodeURIComponent(evaluation.galileoProjectName!)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 underline underline-offset-2"
                  >
                    View in Galileo Console
                    <IconExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </CardContent>
            </Card>
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

      {/* Phase: cancelled */}
      {evaluation.status === "cancelled" && (
        <div className="space-y-4">
          <EvaluationProgress
            progress={evaluation.progress}
            status={evaluation.status}
            modelIds={evaluation.selectedModelIds}
          />
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex items-center gap-2 text-amber-600">
                <IconPlayerStop className="h-5 w-5" />
                <p className="font-medium">Evaluation Cancelled</p>
              </div>
              <p className="text-sm text-muted-foreground">
                This evaluation was cancelled before completion.
                {evaluation.progress && evaluation.progress.completedSessions > 0 && (
                  <span> {evaluation.progress.completedSessions} of {evaluation.progress.totalSessions} sessions completed.</span>
                )}
              </p>
            </CardContent>
          </Card>

          {leaderboard.length > 0 && evaluation.generatedConfig && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Partial Results</span>
              </div>
              <GenericLeaderboardTable
                entries={leaderboard}
                metrics={evaluation.generatedConfig.metrics}
              />
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        onOpenChange={setShowCancelConfirm}
        onConfirm={async () => {
          if (!evalId) return;
          try {
            await cancelEvaluation({ id: evalId as never });
          } catch (err) {
            console.error("Cancel failed:", err);
          }
          setShowCancelConfirm(false);
        }}
        title="Cancel Evaluation"
        description="All running and pending sessions will be stopped. Any completed results will be preserved. This cannot be undone."
        confirmText="Cancel Evaluation"
        variant="destructive"
      />
    </div>
  );
}

function ScoringSourceIndicator({ evaluation }: { evaluation: CustomEvaluation }) {
  const projectUrl = evaluation.galileoProjectId
    ? `https://app.galileo.ai/meetumo/project/${encodeURIComponent(evaluation.galileoProjectId)}`
    : evaluation.galileoProjectName
      ? `https://app.galileo.ai/meetumo/project/${encodeURIComponent(evaluation.galileoProjectName)}`
      : null;

  const isFallback = !!evaluation.galileoSetupError;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isFallback ? "bg-amber-500" : "bg-green-500"
            )}
          />
          <span className="text-sm font-medium text-foreground">
            {isFallback ? "Scored with approximate metrics" : "Scored by Galileo"}
          </span>
        </div>
        {projectUrl && (
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 underline underline-offset-2"
          >
            View in Galileo Console
            <IconExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {isFallback && (
        <p className="text-xs text-muted-foreground">
          {evaluation.galileoSetupError}
        </p>
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
