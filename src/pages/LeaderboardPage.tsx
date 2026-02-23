import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { CategoryBreakdown } from "@/components/CategoryBreakdown";
import { ScenarioContextViewer } from "@/components/ScenarioContextViewer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { IconChevronDown, IconTrophy } from "@tabler/icons-react";
import { type MetricKey, CATEGORY_DISPLAY_NAMES, type ScenarioCategory } from "@/lib/constants";
import type { LeaderboardEntry, PythonRun, Scenario, Tool } from "@/lib/types";

type SourceTab = "web" | "python";

export function LeaderboardPage() {
  const [sourceTab, setSourceTab] = useState<SourceTab>("web");
  const [activeMetric, setActiveMetric] = useState<MetricKey | "overall">("overall");

  const rawLeaderboard = useQuery(api.leaderboard.list);
  const fullEntries: LeaderboardEntry[] = (rawLeaderboard as LeaderboardEntry[] | undefined) ?? [];

  const rawScenarios = useQuery(api.scenarios.list);
  const scenarios: Scenario[] = (rawScenarios as Scenario[] | undefined) ?? [];

  const rawEvaluatedIds = useQuery(api.scenarios.evaluatedScenarioIds);
  const evaluatedScenarioIds = rawEvaluatedIds ?? [];

  const evaluatedScenarios = useMemo(
    () => scenarios.filter((s) => evaluatedScenarioIds.includes(s._id)),
    [scenarios, evaluatedScenarioIds]
  );

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("all");
  const [scenarioFilterOpen, setScenarioFilterOpen] = useState(false);
  const [selectedPythonRunId, setSelectedPythonRunId] = useState<string>("latest");
  const [pythonRunFilterOpen, setPythonRunFilterOpen] = useState(false);

  const rawPythonRuns = useQuery(api.pythonSdkIngest.listRuns, { limit: 50 });
  const pythonRuns: PythonRun[] = (rawPythonRuns as PythonRun[] | undefined) ?? [];
  const effectivePythonRunId =
    selectedPythonRunId === "latest"
      ? (pythonRuns[0]?.runId ?? null)
      : selectedPythonRunId;

  const rawPythonLeaderboard = useQuery(
    api.pythonSdkIngest.leaderboardByRun,
    effectivePythonRunId ? { runId: effectivePythonRunId } : "skip"
  );
  const pythonEntries: LeaderboardEntry[] = useMemo(() => {
    const rows = (rawPythonLeaderboard as Record<string, unknown>[] | undefined) ?? [];
    return rows.map((row) => ({
      _id: String(row._id),
      modelId: String(row.modelId),
      overallScore: Number(row.overallScore ?? 0),
      totalEvaluations: Number(row.totalEvaluations ?? 0),
      metrics: row.metrics as LeaderboardEntry["metrics"],
      categoryScores: row.categoryScores as LeaderboardEntry["categoryScores"],
      lastUpdated: Number(row.updatedAt ?? Date.now()),
    }));
  }, [rawPythonLeaderboard]);

  const selectedPythonRun = useMemo(
    () =>
      effectivePythonRunId
        ? pythonRuns.find((r) => r.runId === effectivePythonRunId) ?? null
        : null,
    [effectivePythonRunId, pythonRuns]
  );

  // Fetch scenario-filtered leaderboard when a specific scenario is selected
  const rawScenarioLeaderboard = useQuery(
    api.leaderboard.byScenario,
    selectedScenarioId !== "all" ? { scenarioId: selectedScenarioId as any } : "skip"
  );

  // Derive entries: scenario query > full leaderboard (category-filtered by LeaderboardTable)
  const entries: LeaderboardEntry[] = useMemo(() => {
    if (selectedScenarioId === "all") return fullEntries;
    if (rawScenarioLeaderboard != null && rawScenarioLeaderboard.length > 0)
      return rawScenarioLeaderboard as LeaderboardEntry[];
    // byScenario returned empty or still loading — show full leaderboard
    // LeaderboardTable uses filterCategory to display category-specific scores
    return fullEntries;
  }, [selectedScenarioId, fullEntries, rawScenarioLeaderboard]);

  // Group scenarios by category for the dropdown
  const scenariosByCategory = useMemo(() => {
    const grouped: Record<string, Scenario[]> = {};
    for (const s of evaluatedScenarios) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    return grouped;
  }, [evaluatedScenarios]);

  // Determine the active category filter from the selected scenario
  const filterCategory: ScenarioCategory | null = useMemo(() => {
    if (selectedScenarioId === "all") return null;
    const scenario = scenarios.find((s) => s._id === selectedScenarioId);
    return scenario ? (scenario.category as ScenarioCategory) : null;
  }, [selectedScenarioId, scenarios]);

  // Selected scenario object
  const selectedScenario = useMemo(
    () => (selectedScenarioId !== "all" ? scenarios.find((s) => s._id === selectedScenarioId) ?? null : null),
    [selectedScenarioId, scenarios]
  );

  // Fetch persona for the selected scenario
  const rawPersona = useQuery(
    api.personas.getById,
    selectedScenario?.personaId ? { id: selectedScenario.personaId as any } : "skip"
  );
  const scenarioPersona = useMemo(() => {
    if (rawPersona != null) return rawPersona as any;
    return null;
  }, [rawPersona, selectedScenario]);

  // Fetch all tools and filter to scenario's expectedTools
  const rawTools = useQuery(api.tools.list);
  const scenarioTools: Tool[] = useMemo(() => {
    if (!selectedScenario) return [];
    const allTools: Tool[] = (rawTools as Tool[] | undefined) ?? [];
    return allTools.filter((t) => selectedScenario.expectedTools.includes(t.name));
  }, [rawTools, selectedScenario]);

  const webTotalEvals = entries.reduce((sum, e) => sum + e.totalEvaluations, 0);
  const webAvgScore =
    entries.length > 0 ? entries.reduce((sum, e) => sum + e.overallScore, 0) / entries.length : 0;
  const pythonAvgScore =
    pythonEntries.length > 0
      ? pythonEntries.reduce((sum, e) => sum + e.overallScore, 0) / pythonEntries.length
      : 0;

  const stats =
    sourceTab === "web"
      ? [
          { label: "Models", value: entries.length },
          { label: "Scenarios", value: evaluatedScenarios.length },
          { label: "Evaluations", value: webTotalEvals },
          { label: "Avg Score", value: webAvgScore > 0 ? (webAvgScore * 100).toFixed(0) : "\u2014" },
        ]
      : [
          { label: "Models", value: pythonEntries.length },
          { label: "Scenarios", value: selectedPythonRun?.scenarioCount ?? 0 },
          { label: "Completed", value: selectedPythonRun?.completedSessions ?? 0 },
          { label: "Avg Score", value: pythonAvgScore > 0 ? (pythonAvgScore * 100).toFixed(0) : "\u2014" },
        ];

  return (
    <div>
      {/* Leaderboard summary banner */}
      <div className="mb-6 flex items-center gap-3 rounded-lg bg-red-600 px-4 py-2.5 text-white shadow-sm">
        <IconTrophy className="h-5 w-5 shrink-0 text-red-200" />
        <p className="text-sm font-medium leading-snug">
          Compare AI model performance across real-world customer service scenarios — ranked by accuracy, empathy, safety, and more.
        </p>
      </div>

      <PageHeader
        title="Leaderboard"
        stats={stats}
        action={
          sourceTab === "web" ? (
            <>
              <Popover open={scenarioFilterOpen} onOpenChange={setScenarioFilterOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="border-input bg-background flex h-9 w-64 items-center justify-between rounded-md border px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">
                      {selectedScenarioId === "all"
                        ? "All Scenarios"
                        : scenarios.find((s) => s._id === selectedScenarioId)?.title ?? selectedScenarioId}
                    </span>
                    <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search scenarios..." />
                    <CommandList>
                      <CommandEmpty>No scenarios found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all-scenarios"
                          data-checked={selectedScenarioId === "all"}
                          onSelect={() => {
                            setSelectedScenarioId("all");
                            setScenarioFilterOpen(false);
                          }}
                        >
                          All Scenarios
                        </CommandItem>
                      </CommandGroup>
                      {Object.entries(scenariosByCategory).map(([cat, items]) => (
                        <CommandGroup key={cat} heading={CATEGORY_DISPLAY_NAMES[cat as ScenarioCategory] ?? cat}>
                          {items.map((s) => (
                            <CommandItem
                              key={s._id}
                              value={s.title}
                              data-checked={selectedScenarioId === s._id}
                              onSelect={() => {
                                setSelectedScenarioId(s._id);
                                setScenarioFilterOpen(false);
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
              {filterCategory && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {CATEGORY_DISPLAY_NAMES[filterCategory]}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Popover open={pythonRunFilterOpen} onOpenChange={setPythonRunFilterOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="border-input bg-background flex h-9 w-72 items-center justify-between rounded-md border px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="truncate">
                      {selectedPythonRun
                        ? `${selectedPythonRun.runId} (${selectedPythonRun.status})`
                        : "Latest Python Run"}
                    </span>
                    <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search runs..." />
                    <CommandList>
                      <CommandEmpty>No Python runs found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="latest"
                          data-checked={selectedPythonRunId === "latest"}
                          onSelect={() => {
                            setSelectedPythonRunId("latest");
                            setPythonRunFilterOpen(false);
                          }}
                        >
                          Latest Run
                        </CommandItem>
                        {pythonRuns.map((run) => (
                          <CommandItem
                            key={run._id}
                            value={run.runId}
                            data-checked={effectivePythonRunId === run.runId}
                            onSelect={() => {
                              setSelectedPythonRunId(run.runId);
                              setPythonRunFilterOpen(false);
                            }}
                          >
                            {run.runId} ({run.status})
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedPythonRun?.galileoEnabled ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">Galileo enabled</span>
              ) : (
                <span className="text-xs text-muted-foreground whitespace-nowrap">Galileo disabled</span>
              )}
            </div>
          )
        }
      />

      <Tabs
        value={sourceTab}
        onValueChange={(v) => setSourceTab(v as SourceTab)}
        className="mb-6"
      >
        <TabsList variant="line">
          <TabsTrigger value="web">Web SDK</TabsTrigger>
          <TabsTrigger value="python">Python SDK</TabsTrigger>
        </TabsList>

        <TabsContent value="web" className="space-y-6">
          <Tabs
            value={activeMetric}
            onValueChange={(v) => setActiveMetric(v as MetricKey | "overall")}
          >
            <TabsList variant="line">
              <TabsTrigger value="overall">Overall</TabsTrigger>
              <TabsTrigger value="toolAccuracy">Tool Use</TabsTrigger>
              <TabsTrigger value="empathy">Empathy</TabsTrigger>
              <TabsTrigger value="factualCorrectness">Factual</TabsTrigger>
              <TabsTrigger value="completeness">Complete</TabsTrigger>
              <TabsTrigger value="safetyCompliance">Safety</TabsTrigger>
            </TabsList>
            <TabsContent value={activeMetric}>
              <LeaderboardTable
                entries={entries}
                sortMetric={activeMetric}
                filterCategory={filterCategory}
              />
            </TabsContent>
          </Tabs>

          <h3 className="mb-3 text-lg font-semibold">Category Breakdown</h3>
          <CategoryBreakdown entries={entries} filterCategory={filterCategory} />

          {selectedScenario && (
            <ScenarioContextViewer
              scenario={selectedScenario}
              persona={scenarioPersona}
              tools={scenarioTools}
            />
          )}
        </TabsContent>

        <TabsContent value="python" className="space-y-6">
          {pythonRuns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No Python SDK runs have been synced yet.
            </p>
          ) : (
            <>
              <Tabs
                value={activeMetric}
                onValueChange={(v) => setActiveMetric(v as MetricKey | "overall")}
              >
                <TabsList variant="line">
                  <TabsTrigger value="overall">Overall</TabsTrigger>
                  <TabsTrigger value="toolAccuracy">Tool Use</TabsTrigger>
                  <TabsTrigger value="empathy">Empathy</TabsTrigger>
                  <TabsTrigger value="factualCorrectness">Factual</TabsTrigger>
                  <TabsTrigger value="completeness">Complete</TabsTrigger>
                  <TabsTrigger value="safetyCompliance">Safety</TabsTrigger>
                </TabsList>
                <TabsContent value={activeMetric}>
                  <LeaderboardTable
                    entries={pythonEntries}
                    sortMetric={activeMetric}
                    linkToResults={false}
                  />
                </TabsContent>
              </Tabs>

              <h3 className="mb-3 text-lg font-semibold">Category Breakdown</h3>
              <CategoryBreakdown entries={pythonEntries} />

              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                <p>
                  Run: <span className="font-medium text-foreground">{selectedPythonRun?.runId ?? "—"}</span>
                </p>
                <p>
                  Status: <span className="font-medium text-foreground">{selectedPythonRun?.status ?? "—"}</span>
                </p>
                <p>
                  Last Updated:{" "}
                  <span className="font-medium text-foreground">
                    {selectedPythonRun ? new Date(selectedPythonRun.updatedAt).toLocaleString() : "—"}
                  </span>
                </p>
                {selectedPythonRun?.lastError ? (
                  <p className="mt-1 text-red-600">Error: {selectedPythonRun.lastError}</p>
                ) : null}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
