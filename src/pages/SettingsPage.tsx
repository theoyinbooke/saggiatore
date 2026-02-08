import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
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
} from "@tabler/icons-react";
import { MAX_ENABLED_MODELS } from "@/lib/constants";
import type { ModelRegistryEntry } from "@/lib/types";

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

export function SettingsPage() {
  const rawModels = useQuery(api.modelRegistry.list);
  const models: ModelRegistryEntry[] = (rawModels as ModelRegistryEntry[] | undefined) ?? [];

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
    <div>
      <PageHeader
        title="Settings"
        stats={[
          { label: "Total Models", value: models.length },
          { label: "Enabled", value: enabledCount },
        ]}
      />

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
    </div>
  );
}
