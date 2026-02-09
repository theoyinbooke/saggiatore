import { useState, useMemo } from "react";
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
import type { LeaderboardEntry, Scenario, Tool } from "@/lib/types";

export function LeaderboardPage() {
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

  const [activeMetric, setActiveMetric] = useState<MetricKey | "overall">(
    "overall"
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("all");
  const [scenarioFilterOpen, setScenarioFilterOpen] = useState(false);

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

  // Compute stats
  const totalEvals = entries.reduce((sum, e) => sum + e.totalEvaluations, 0);
  const avgScore =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.overallScore, 0) / entries.length
      : 0;

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
        stats={[
          { label: "Models", value: entries.length },
          { label: "Scenarios", value: evaluatedScenarios.length },
          { label: "Evaluations", value: totalEvals },
          { label: "Avg Score", value: avgScore > 0 ? (avgScore * 100).toFixed(0) : "\u2014" },
        ]}
        action={
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
        }
      />

      <Tabs
        value={activeMetric}
        onValueChange={(v) => setActiveMetric(v as MetricKey | "overall")}
        className="mb-6"
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
    </div>
  );
}
