import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ModelSessionPanel } from "@/components/ModelSessionPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { ModelMultiSelect } from "@/components/ModelMultiSelect";
import { IconPlayerPlay, IconRefresh, IconAlertTriangle, IconInfoCircle, IconPlayerStop, IconX, IconChevronDown, IconChartBar } from "@tabler/icons-react";
import { CATEGORY_DISPLAY_NAMES, MAX_ENABLED_MODELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Scenario, ScenarioCategory, ModelRegistryEntry } from "@/lib/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useNavigate } from "react-router-dom";

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
  const [isComplete, setIsComplete] = useState(false);
  const [completedSessionIds, setCompletedSessionIds] = useState<string[]>([]);
  const [backendError, setBackendError] = useState(false);
  const [showCancelAll, setShowCancelAll] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const navigate = useNavigate();

  const rawScenarios = useQuery(api.scenarios.list);
  const scenarios: Scenario[] = (rawScenarios as Scenario[] | undefined) ?? [];

  // Group scenarios by category for the dropdown
  const scenariosByCategory = useMemo(() => {
    const grouped: Record<string, Scenario[]> = {};
    for (const s of scenarios) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    return grouped;
  }, [scenarios]);

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

  // Show completion state when all sessions finish (no more active sessions)
  useEffect(() => {
    if (
      isRunning &&
      activeSessions.size > 0 &&
      hasRestoredRef.current &&
      rawActiveSessions !== undefined &&
      rawActiveSessions.length === 0
    ) {
      setCompletedSessionIds([...activeSessions.values()]);
      setIsRunning(false);
      setIsComplete(true);
    }
  }, [rawActiveSessions, isRunning, activeSessions.size]);

  async function handleRun() {
    if (!selectedScenarioId || selectedModelIds.length === 0) return;

    setIsRunning(true);
    setIsComplete(false);
    setCompletedSessionIds([]);
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
    setCompletedSessionIds([]);
    setIsRunning(false);
    setIsComplete(false);
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
          <Popover open={scenarioOpen} onOpenChange={setScenarioOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="border-input bg-background flex h-9 w-72 items-center justify-between rounded-md border px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">
                  {selectedScenarioId
                    ? scenarios.find((s) => s._id === selectedScenarioId)?.title ?? "Select a scenario..."
                    : "Select a scenario..."}
                </span>
                <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search scenarios..." />
                <CommandList>
                  <CommandEmpty>No scenarios found.</CommandEmpty>
                  {Object.entries(scenariosByCategory).map(([cat, items]) => (
                    <CommandGroup key={cat} heading={CATEGORY_DISPLAY_NAMES[cat as ScenarioCategory] ?? cat}>
                      {items.map((s) => (
                        <CommandItem
                          key={s._id}
                          value={s.title}
                          data-checked={selectedScenarioId === s._id}
                          onSelect={() => {
                            setSelectedScenarioId(s._id);
                            setScenarioOpen(false);
                          }}
                        >
                          {s.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
          Could not connect to backend — some features may be unavailable
        </div>
      )}

      {/* Completion banner */}
      {isComplete && completedSessionIds.length > 0 && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <IconChartBar className="h-4 w-4" />
              Evaluation complete — {completedSessionIds.length} session{completedSessionIds.length > 1 ? "s" : ""} finished
            </div>
            <div className="flex items-center gap-2">
              {completedSessionIds.length === 1 ? (
                <Button
                  size="sm"
                  onClick={() => navigate(`/results/${completedSessionIds[0]}`)}
                  className="gap-1.5"
                >
                  <IconChartBar className="h-3.5 w-3.5" />
                  View Results
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/results")}
                    className="gap-1.5"
                  >
                    <IconChartBar className="h-3.5 w-3.5" />
                    View All Results
                  </Button>
                  {completedSessionIds.map((sid, i) => (
                    <Button
                      key={sid}
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/results/${sid}`)}
                      className="text-xs"
                    >
                      Session {i + 1}
                    </Button>
                  ))}
                </>
              )}
              <Button size="sm" variant="ghost" onClick={handleNewRun} className="gap-1.5">
                <IconRefresh className="h-3.5 w-3.5" />
                New Run
              </Button>
            </div>
          </div>
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
      ) : !isComplete ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">
            Select a scenario and model(s), then click "Run Evaluation" to start.
          </p>
        </div>
      ) : null}

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
