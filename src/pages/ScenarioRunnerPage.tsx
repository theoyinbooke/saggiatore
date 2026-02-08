import { useState, useRef, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ModelSessionPanel } from "@/components/ModelSessionPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelMultiSelect } from "@/components/ModelMultiSelect";
import { IconPlayerPlay, IconRefresh, IconAlertTriangle, IconInfoCircle, IconPlayerStop, IconX } from "@tabler/icons-react";
import { CATEGORY_DISPLAY_NAMES, MAX_ENABLED_MODELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Scenario, ScenarioCategory, ModelRegistryEntry } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

export function ScenarioRunnerPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [activeSessions, setActiveSessions] = useState<Map<string, string>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [showCancelAll, setShowCancelAll] = useState(false);

  const rawScenarios = useQuery(api.scenarios.list);
  const scenarios: Scenario[] = (rawScenarios as Scenario[] | undefined) ?? [];

  const rawEnabledModels = useQuery(api.modelRegistry.listEnabled);
  const enabledModels: ModelRegistryEntry[] = (rawEnabledModels as ModelRegistryEntry[] | undefined) ?? [];

  // Action to start a session
  const startSession = useAction(api.orchestrator.startSession);

  // Mutation to cancel a session
  const cancelSession = useMutation(api.sessions.cancelSession);

  // Restore running sessions on mount
  const rawActiveSessions = useQuery(api.sessions.listActiveBatch);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    // Only restore once per mount, and only when query has resolved
    if (hasRestoredRef.current || rawActiveSessions === undefined) return;
    hasRestoredRef.current = true;

    if (rawActiveSessions.length === 0) return;

    // Group by scenarioId — pick the scenario with the most active sessions
    const byScenario = new Map<string, typeof rawActiveSessions>();
    for (const s of rawActiveSessions) {
      const group = byScenario.get(s.scenarioId) ?? [];
      group.push(s);
      byScenario.set(s.scenarioId, group);
    }
    const largest = [...byScenario.entries()].sort(
      (a, b) => b[1].length - a[1].length
    )[0];

    const [scenarioId, sessions] = largest;
    const restoredMap = new Map<string, string>();
    const modelIds: string[] = [];
    for (const s of sessions) {
      restoredMap.set(s.modelId, s._id);
      modelIds.push(s.modelId);
    }

    setSelectedScenarioId(scenarioId);
    setSelectedModelIds(modelIds);
    setActiveSessions(restoredMap);
    setIsRunning(true);
  }, [rawActiveSessions]);

  async function handleRun() {
    if (!selectedScenarioId || selectedModelIds.length === 0) return;

    setIsRunning(true);
    setActiveSessions(new Map());
    setBackendError(false);

    let hadError = false;
    const results = await Promise.allSettled(
      selectedModelIds.map(async (modelId) => {
        try {
          const sessionId = await startSession({
            scenarioId: selectedScenarioId as never,
            modelId,
          });
          return { modelId, sessionId: sessionId as unknown as string };
        } catch {
          hadError = true;
          return { modelId, sessionId: `mock-${modelId}` };
        }
      })
    );
    if (hadError) setBackendError(true);

    const newSessions = new Map<string, string>();
    for (const result of results) {
      if (result.status === "fulfilled") {
        newSessions.set(result.value.modelId, result.value.sessionId);
      }
    }
    setActiveSessions(newSessions);
  }

  function handleNewRun() {
    setActiveSessions(new Map());
    setIsRunning(false);
  }

  async function handleCancelSession(sessionId: string) {
    if (sessionId.startsWith("mock-")) return;
    try {
      await cancelSession({ id: sessionId as never });
    } catch {
      // Ignore errors (session may already be terminal)
    }
  }

  async function handleCancelAll() {
    const promises = [...activeSessions.values()]
      .filter((id) => !id.startsWith("mock-"))
      .map((sessionId) =>
        cancelSession({ id: sessionId as never }).catch(() => {})
      );
    await Promise.allSettled(promises);
  }

  function removeModel(modelId: string) {
    setSelectedModelIds((ids) => ids.filter((id) => id !== modelId));
  }

  const selectedScenario = scenarios.find((s) => s._id === selectedScenarioId);

  // Derive selected model objects for the chip strip
  const selectedModels = selectedModelIds
    .map((id) => enabledModels.find((m) => m.modelId === id))
    .filter(Boolean) as ModelRegistryEntry[];

  return (
    <div>
      <PageHeader title="Scenario Runner" />

      {/* Config row */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Scenario
          </label>
          <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a scenario..." />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Models
          </label>
          {rawEnabledModels === undefined ? (
            <ModelMultiSelect
              models={[]}
              selectedIds={[]}
              onSelectionChange={() => {}}
              disabled
            />
          ) : enabledModels.length > 0 ? (
            <ModelMultiSelect
              models={enabledModels}
              selectedIds={selectedModelIds}
              onSelectionChange={setSelectedModelIds}
              maxSelections={MAX_ENABLED_MODELS}
              disabled={isRunning}
            />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              <IconInfoCircle className="h-4 w-4 shrink-0" />
              No models enabled.{" "}
              <Link to="/settings" className="font-medium underline underline-offset-2">
                Go to Settings
              </Link>{" "}
              to enable models.
            </div>
          )}
        </div>

        {isRunning ? (
          <Button
            variant="destructive"
            onClick={() => setShowCancelAll(true)}
            className="gap-1.5"
          >
            <IconPlayerStop className="h-4 w-4" />
            Cancel All
          </Button>
        ) : (
          <Button
            onClick={handleRun}
            disabled={!selectedScenarioId || selectedModelIds.length === 0}
            className="gap-1.5"
          >
            <IconPlayerPlay className="h-4 w-4" />
            Run Evaluation
          </Button>
        )}

        {activeSessions.size > 0 && (
          <Button variant="outline" onClick={handleNewRun} className="gap-1.5">
            <IconRefresh className="h-4 w-4" />
            New Run
          </Button>
        )}
      </div>

      {/* Selected models chip strip */}
      {selectedModels.length > 0 && !isRunning && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selectedModels.map((model) => (
            <span
              key={model.modelId}
              className="bg-muted inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: model.color }}
              />
              {model.displayName}
              <button
                type="button"
                className="hover:text-destructive ml-0.5 cursor-pointer rounded-sm"
                onClick={() => removeModel(model.modelId)}
              >
                <IconX className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Scenario info */}
      {selectedScenario && (
        <div className="mb-6 flex items-center gap-2">
          <Badge variant="secondary">
            {CATEGORY_DISPLAY_NAMES[selectedScenario.category as ScenarioCategory] ??
              selectedScenario.category}
          </Badge>
          <Badge variant="outline">{selectedScenario.complexity}</Badge>
          <span className="text-sm text-muted-foreground">
            {selectedScenario.description}
          </span>
        </div>
      )}

      {/* Backend error banner */}
      {backendError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          Could not connect to backend — showing demo data
        </div>
      )}

      {/* Session display */}
      {activeSessions.size > 0 ? (
        <div
          className={cn("grid gap-4", getGridClass(activeSessions.size))}
        >
          {[...activeSessions.entries()].map(([modelId, sessionId]) => (
            <ModelSessionPanel
              key={modelId}
              modelId={modelId}
              sessionId={sessionId}
              panelHeight={getPanelHeight(activeSessions.size)}
              onCancel={() => handleCancelSession(sessionId)}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            Select a scenario and model(s), then click "Run Evaluation" to start.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={showCancelAll}
        onOpenChange={setShowCancelAll}
        onConfirm={() => { handleCancelAll(); setShowCancelAll(false); }}
        title="Cancel All Sessions"
        description="All running evaluation sessions will be stopped. This cannot be undone."
        confirmText="Cancel All"
        variant="destructive"
      />
    </div>
  );
}
