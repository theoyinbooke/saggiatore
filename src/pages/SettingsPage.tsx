import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconRefresh,
  IconX,
  IconSearch,
  IconAlertCircle,
  IconCpu,
  IconSettings2,
  IconTrash,
} from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  MAX_ENABLED_MODELS,
  CATEGORY_DISPLAY_NAMES,
  COMPLEXITY_COLORS,
} from "@/lib/constants";
import { getModelDisplayName } from "@/lib/models";
import type { ModelRegistryEntry } from "@/lib/types";

type Section = "models" | "general";

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function EnabledModelChip({
  model,
  onDisable,
}: {
  model: ModelRegistryEntry;
  onDisable: (modelId: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 shadow-sm">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: model.color }}
      />
      <span className="text-sm font-medium">{model.displayName}</span>
      <button
        onClick={() => onDisable(model.modelId)}
        className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

function ModelTable({
  models,
  enabledCount,
  onToggle,
  emptyMessage,
}: {
  models: ModelRegistryEntry[];
  enabledCount: number;
  onToggle: (modelId: string) => void;
  emptyMessage: string;
}) {
  if (models.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Model</TableHead>
          <TableHead>API Identifier</TableHead>
          <TableHead className="text-center">Tools</TableHead>
          <TableHead className="text-right">Context</TableHead>
          <TableHead className="text-center w-20">Enabled</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {models.map((model) => {
          const atMax = enabledCount >= MAX_ENABLED_MODELS && !model.enabled;

          return (
            <TableRow key={model._id}>
              <TableCell>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: model.color }}
                />
              </TableCell>
              <TableCell className="font-medium">
                {model.displayName}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {model.apiModel}
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={
                    model.supportsTools
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-amber-300 bg-amber-50 text-amber-700"
                  }
                >
                  {model.supportsTools ? "Tools" : "No Tools"}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {model.contextWindow
                  ? `${(model.contextWindow / 1000).toFixed(0)}k`
                  : "\u2014"}
              </TableCell>
              <TableCell className="text-center">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex justify-center">
                        <Switch
                          checked={model.enabled}
                          disabled={atMax}
                          onCheckedChange={() => onToggle(model.modelId)}
                        />
                      </span>
                    </TooltipTrigger>
                    {atMax && (
                      <TooltipContent side="left">
                        Max {MAX_ENABLED_MODELS} models reached
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/*  Models Section                                                     */
/* ------------------------------------------------------------------ */

function ModelsSection() {
  const rawModels = useQuery(api.modelRegistry.list);
  const models: ModelRegistryEntry[] =
    (rawModels as ModelRegistryEntry[] | undefined) ?? [];

  const fetchModels = useAction(api.modelDiscovery.fetchModels);
  const toggleModel = useMutation(api.modelRegistry.toggleModel);

  const [search, setSearch] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isLoading = rawModels === undefined;

  const enabledModels = models.filter((m) => m.enabled);
  const enabledCount = enabledModels.length;

  const openaiModels = models.filter((m) => m.provider === "openai");
  const openrouterModels = models.filter((m) => m.provider === "openrouter");
  const groqModels = models.filter((m) => m.provider === "groq");

  const filterModels = (list: ModelRegistryEntry[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.apiModel.toLowerCase().includes(q)
    );
  };

  const handleRefresh = async () => {
    setFetching(true);
    setFetchError(null);
    try {
      await fetchModels();
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Failed to fetch models"
      );
    } finally {
      setFetching(false);
    }
  };

  const handleToggle = async (modelId: string) => {
    try {
      await toggleModel({ modelId });
    } catch {
      // Silently handle — Convex will show the error in dev console
    }
  };

  return (
    <>
      {/* Enabled Models Strip */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Enabled Models ({enabledCount}/{MAX_ENABLED_MODELS})
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={fetching}
          >
            <IconRefresh
              className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
            />
            Refresh Models
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enabledModels.length > 0 ? (
            enabledModels.map((m) => (
              <EnabledModelChip
                key={m._id}
                model={m}
                onDisable={handleToggle}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No models enabled yet
            </p>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {fetchError && (
        <Alert variant="destructive" className="mb-4">
          <IconAlertCircle className="h-4 w-4" />
          <AlertTitle>Fetch Error</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {/* Model Browser Tabs */}
      <Tabs defaultValue="openai">
        <div className="mb-4 flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="openai">
              OpenAI ({openaiModels.length})
            </TabsTrigger>
            <TabsTrigger value="openrouter">
              OpenRouter ({openrouterModels.length})
            </TabsTrigger>
            <TabsTrigger value="groq">
              Groq ({groqModels.length})
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1">
            <IconSearch className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value="openai">
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <Card>
              <ScrollArea className="h-[420px]">
                <ModelTable
                  models={filterModels(openaiModels)}
                  enabledCount={enabledCount}
                  onToggle={handleToggle}
                  emptyMessage={
                    search
                      ? "No matching OpenAI models"
                      : "No OpenAI models found. Try refreshing."
                  }
                />
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="openrouter">
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <Card>
              <ScrollArea className="h-[420px]">
                <ModelTable
                  models={filterModels(openrouterModels)}
                  enabledCount={enabledCount}
                  onToggle={handleToggle}
                  emptyMessage={
                    search
                      ? "No matching OpenRouter models"
                      : "No OpenRouter models found. Try refreshing."
                  }
                />
              </ScrollArea>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groq">
          {isLoading ? (
            <SkeletonTable />
          ) : (
            <Card>
              <ScrollArea className="h-[420px]">
                <ModelTable
                  models={filterModels(groqModels)}
                  enabledCount={enabledCount}
                  onToggle={handleToggle}
                  emptyMessage={
                    search
                      ? "No matching Groq models"
                      : "No Groq models found. Try refreshing."
                  }
                />
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Ran Scenarios Manager                                              */
/* ------------------------------------------------------------------ */

function RanScenariosManager() {
  const ranScenarios = useQuery(api.settingsAdmin.listRanScenarios) ?? [];
  const deleteScenarioData = useMutation(api.settingsAdmin.deleteScenarioData);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmScenario, setConfirmScenario] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const handleDelete = async () => {
    if (!confirmScenario) return;
    setDeletingId(confirmScenario.id);
    try {
      await deleteScenarioData({
        scenarioId: confirmScenario.id as any,
      });
    } finally {
      setDeletingId(null);
      setConfirmScenario(null);
    }
  };

  if (ranScenarios.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No scenarios have been run yet.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scenario</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Complexity</TableHead>
            <TableHead className="text-center">Sessions</TableHead>
            <TableHead>Models</TableHead>
            <TableHead className="text-center">Evaluated</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranScenarios.map((scenario) => (
            <TableRow key={scenario._id}>
              <TableCell className="font-medium max-w-[200px] truncate">
                {scenario.title}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {CATEGORY_DISPLAY_NAMES[
                    scenario.category as keyof typeof CATEGORY_DISPLAY_NAMES
                  ] ?? scenario.category}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    COMPLEXITY_COLORS[scenario.complexity] ?? ""
                  }
                >
                  {scenario.complexity}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-sm">
                {scenario.completedSessions}/{scenario.totalSessions}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {getModelDisplayName(scenario.modelIds[0])}
                  </Badge>
                  {scenario.modelIds.length > 1 && (
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs cursor-default">
                            +{scenario.modelIds.length - 1}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px]">
                          <div className="flex flex-wrap gap-1">
                            {scenario.modelIds.slice(1).map((id) => (
                              <span key={id} className="text-xs">
                                {getModelDisplayName(id)}
                              </span>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant="outline"
                  className={
                    scenario.hasEvaluations
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-gray-300 bg-gray-50 text-gray-500"
                  }
                >
                  {scenario.hasEvaluations ? "Yes" : "No"}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === scenario._id}
                  onClick={() =>
                    setConfirmScenario({
                      id: scenario._id,
                      title: scenario.title,
                    })
                  }
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!confirmScenario}
        onOpenChange={(open) => {
          if (!open) setConfirmScenario(null);
        }}
        onConfirm={handleDelete}
        title="Delete Scenario Data"
        description={`This will delete all sessions, messages, and evaluations for "${confirmScenario?.title ?? ""}". The scenario definition will remain available for future runs. Leaderboard scores will be recalculated.`}
        confirmText="Delete Data"
        variant="destructive"
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  General Section                                                    */
/* ------------------------------------------------------------------ */

function GeneralSection() {
  const clearDemoResults = useMutation(api.seed.clearDemoResults);
  const [showClearResults, setShowClearResults] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleConfirmClearResults() {
    setClearing(true);
    try {
      await clearDemoResults();
    } finally {
      setClearing(false);
      setShowClearResults(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Clear Demo Results */}
      <Card>
        <CardHeader>
          <CardTitle>Clear Demo Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Remove all simulated evaluation sessions, messages, scores, and
            leaderboard entries. Reference data (personas, tools, scenarios) will
            be kept.
          </p>
          <Button
            variant="destructive"
            onClick={() => setShowClearResults(true)}
            disabled={clearing}
          >
            {clearing ? "Clearing..." : "Clear Demo Results"}
          </Button>
        </CardContent>
      </Card>

      {/* Ran Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Ran Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <RanScenariosManager />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showClearResults}
        onOpenChange={setShowClearResults}
        onConfirm={handleConfirmClearResults}
        title="Clear Demo Results"
        description="This will delete all evaluation sessions, messages, scores, and leaderboard entries. Personas, tools, and scenarios will be preserved. You can regenerate results by running batchRunner:populateEvaluations."
        confirmText="Clear Results"
        variant="destructive"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Settings Page                                                 */
/* ------------------------------------------------------------------ */

const SIDEBAR_ITEMS: { key: Section; label: string; icon: typeof IconCpu }[] = [
  { key: "models", label: "Models", icon: IconCpu },
  { key: "general", label: "General", icon: IconSettings2 },
];

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>("models");

  const rawModels = useQuery(api.modelRegistry.list);
  const models: ModelRegistryEntry[] =
    (rawModels as ModelRegistryEntry[] | undefined) ?? [];
  const enabledCount = models.filter((m) => m.enabled).length;

  const ranScenarios = useQuery(api.settingsAdmin.listRanScenarios) ?? [];

  const stats =
    activeSection === "models"
      ? [
          { label: "Total Models", value: models.length },
          { label: "Enabled", value: enabledCount },
        ]
      : [
          { label: "Ran Scenarios", value: ranScenarios.length },
        ];

  return (
    <div>
      <PageHeader title="Settings" stats={stats} />

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <nav className="flex flex-col gap-1">
            {SIDEBAR_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeSection === key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {activeSection === "models" && <ModelsSection />}
          {activeSection === "general" && <GeneralSection />}
        </div>
      </div>
    </div>
  );
}
