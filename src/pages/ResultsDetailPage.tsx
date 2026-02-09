import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConversationPanel } from "@/components/ConversationPanel";
import { EvaluationPanel } from "@/components/EvaluationPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_DISPLAY_NAMES, getScoreTailwind } from "@/lib/constants";
import { getModelDisplayName, getModelColor } from "@/lib/models";
import { formatDuration as formatDurationMs, formatDate as formatTimestamp } from "@/lib/utils";
import { IconArrowLeft, IconArrowsSort, IconSortAscending, IconSortDescending, IconChevronDown } from "@tabler/icons-react";
import type {
  Session,
  Message,
  Evaluation,
  Scenario,
  ScenarioCategory,
  ModelRegistryEntry,
} from "@/lib/types";

export function ResultsDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // If no sessionId, show session list
  if (!sessionId) {
    return <SessionListView />;
  }

  return <SessionDetailView sessionId={sessionId} />;
}

// ---- Session List View ----

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "secondary",
  completed: "default",
  failed: "destructive",
  timeout: "destructive",
  cancelled: "outline",
};

function fmtDuration(startMs?: number, endMs?: number): string {
  if (!startMs || !endMs) return "\u2014";
  return formatDurationMs(endMs - startMs);
}

function fmtDate(ts?: number): string {
  if (!ts) return "\u2014";
  return formatTimestamp(ts);
}

type SortKey = "score" | "turns" | "duration" | "date";
type SortDir = "asc" | "desc";

function SessionListView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Filters
  const initialModel = searchParams.get("model") ?? "all";
  const [filterModel, setFilterModel] = useState(initialModel);
  const [filterStatus, setFilterStatus] = useState("all");
  const [modelFilterOpen, setModelFilterOpen] = useState(false);

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rawSessions = useQuery(api.sessions.list);
  const sessions: Session[] = (rawSessions as Session[] | undefined) ?? [];

  const rawScenarios = useQuery(api.scenarios.list);
  const scenarios: Scenario[] = (rawScenarios as Scenario[] | undefined) ?? [];

  const rawEvaluations = useQuery(api.evaluations.listRecent);
  const evaluations: Evaluation[] = (rawEvaluations as Evaluation[] | undefined) ?? [];

  const rawAllModels = useQuery(api.modelRegistry.list);
  const allModels: ModelRegistryEntry[] = useMemo(() => {
    const raw = (rawAllModels as ModelRegistryEntry[] | undefined) ?? [];
    // Only include models that have at least one session
    const modelsWithSessions = new Set(sessions.map((s) => s.modelId));
    const seen = new Set<string>();
    return raw.filter((m) => {
      if (!modelsWithSessions.has(m.modelId)) return false;
      if (seen.has(m.modelId)) return false;
      seen.add(m.modelId);
      return true;
    });
  }, [rawAllModels, sessions]);

  const scenarioMap = new Map(scenarios.map((s) => [s._id, s]));
  const evalMap = new Map(evaluations.map((e) => [e.sessionId, e]));

  // Unique statuses for filter dropdown
  const statuses = useMemo(
    () => [...new Set(sessions.map((s) => s.status))].sort(),
    [sessions]
  );

  // Filter + sort
  const displaySessions = useMemo(() => {
    let filtered = sessions;

    if (filterModel !== "all") {
      filtered = filtered.filter((s) => s.modelId === filterModel);
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "score": {
          const sa = evalMap.get(a._id)?.overallScore ?? -1;
          const sb = evalMap.get(b._id)?.overallScore ?? -1;
          cmp = sa - sb;
          break;
        }
        case "turns":
          cmp = a.totalTurns - b.totalTurns;
          break;
        case "duration": {
          const da = (a.completedAt ?? 0) - (a.startedAt ?? 0);
          const db = (b.completedAt ?? 0) - (b.startedAt ?? 0);
          cmp = da - db;
          break;
        }
        case "date":
          cmp = (a.startedAt ?? 0) - (b.startedAt ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sessions, filterModel, filterStatus, sortKey, sortDir, evalMap]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <IconArrowsSort className="ml-1 inline h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <IconSortAscending className="ml-1 inline h-3.5 w-3.5" />
      : <IconSortDescending className="ml-1 inline h-3.5 w-3.5" />;
  }

  return (
    <div>
      <PageHeader
        title="Results"
        stats={[{ label: "Sessions", value: displaySessions.length }]}
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <Popover open={modelFilterOpen} onOpenChange={setModelFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="border-input bg-background flex h-9 w-56 items-center justify-between rounded-md border px-3 text-sm shadow-xs hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">
                  {filterModel === "all"
                    ? "All Models"
                    : allModels.find((m) => m.modelId === filterModel)?.displayName ?? filterModel}
                </span>
                <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search models..." />
                <CommandList>
                  <CommandEmpty>No models found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      data-checked={filterModel === "all"}
                      onSelect={() => {
                        setFilterModel("all");
                        setModelFilterOpen(false);
                      }}
                    >
                      All Models
                    </CommandItem>
                    {allModels.map((m) => (
                      <CommandItem
                        key={m.modelId}
                        value={m.displayName}
                        data-checked={filterModel === m.modelId}
                        onSelect={() => {
                          setFilterModel(m.modelId);
                          setModelFilterOpen(false);
                        }}
                      >
                        {m.displayName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {displaySessions.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          {sessions.length === 0
            ? "No evaluation sessions yet. Run a scenario to see results."
            : "No sessions match the current filters."}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="max-w-[140px] sm:max-w-none">Scenario</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("score")}>
                  Score <SortIcon column="score" />
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer select-none text-right" onClick={() => handleSort("turns")}>
                  Turns <SortIcon column="turns" />
                </TableHead>
                <TableHead className="hidden md:table-cell cursor-pointer select-none text-right" onClick={() => handleSort("duration")}>
                  Duration <SortIcon column="duration" />
                </TableHead>
                <TableHead className="hidden lg:table-cell cursor-pointer select-none text-right" onClick={() => handleSort("date")}>
                  Date <SortIcon column="date" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displaySessions.map((session) => {
                const scenario = scenarioMap.get(session.scenarioId);
                const evaluation = evalMap.get(session._id);
                const score = evaluation
                  ? Math.round(evaluation.overallScore * 100)
                  : null;

                return (
                  <TableRow
                    key={session._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/results/${session._id}`)}
                  >
                    <TableCell className="max-w-[140px] sm:max-w-[240px] truncate font-medium">
                      {scenario?.title ?? "Unknown scenario"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: getModelColor(session.modelId) }}
                      >
                        {getModelDisplayName(session.modelId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={STATUS_VARIANTS[session.status]}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {score !== null ? (
                        <span className={`font-medium ${getScoreTailwind(score / 100)}`}>
                          {score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {session.totalTurns}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">
                      {fmtDuration(session.startedAt, session.completedAt)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-right text-muted-foreground">
                      {fmtDate(session.startedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ---- Session Detail View ----

function SessionDetailView({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();

  // Placeholder IDs (e.g. "mock-session-1") are not valid Convex document IDs.
  // Skip Convex queries for placeholder IDs to avoid ArgumentValidationError.
  const isMockId = sessionId.startsWith("mock-");

  // Convex queries (skip for placeholder session IDs)
  const rawSession = useQuery(
    api.sessions.getById,
    isMockId ? "skip" : { id: sessionId as never }
  );
  const session: Session | undefined = rawSession as Session | undefined;

  const rawMessages = useQuery(
    api.messages.bySession,
    isMockId ? "skip" : { sessionId: sessionId as never }
  );
  const messages: Message[] = (rawMessages as Message[] | undefined) ?? [];

  const rawEvaluation = useQuery(
    api.evaluations.bySession,
    isMockId ? "skip" : { sessionId: sessionId as never }
  );
  const evaluation: Evaluation | undefined = rawEvaluation as Evaluation | undefined;

  // Try to get scenario info
  const scenarioId = session?.scenarioId;
  const skipScenario = !scenarioId || String(scenarioId).startsWith("mock-");
  const rawScenario = useQuery(
    api.scenarios.getById,
    skipScenario ? "skip" : { id: scenarioId as never }
  );
  const scenario: Scenario | undefined = rawScenario as Scenario | undefined;

  // Determine if queries have resolved (rawSession is null when Convex returns no result, undefined when loading)
  // For placeholder IDs, queries are skipped so treat as resolved immediately.
  const queriesResolved = isMockId || rawSession !== undefined;

  // Session not found (queries resolved but no session in DB or mocks)
  if (queriesResolved && !session) {
    return (
      <div>
        <PageHeader title="Results" />
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">Session not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The session "{sessionId}" does not exist or has been removed.
          </p>
          <button
            onClick={() => navigate("/results")}
            className="mt-4 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Back to Results
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!session) {
    return (
      <div>
        <PageHeader title="Results" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <Link
        to="/results"
        className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Results
      </Link>

      <PageHeader title={scenario?.title ?? "Session Detail"} />

      {/* Session metadata */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          style={{ borderColor: getModelColor(session.modelId) }}
        >
          {getModelDisplayName(session.modelId)}
        </Badge>
        {scenario && (
          <Badge variant="secondary">
            {CATEGORY_DISPLAY_NAMES[scenario.category as ScenarioCategory] ??
              scenario.category}
          </Badge>
        )}
        <Badge
          variant={
            session.status === "completed"
              ? "default"
              : session.status === "failed" || session.status === "timeout"
                ? "destructive"
                : "outline"
          }
        >
          {session.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {session.totalTurns} turns
        </span>
      </div>

      {/* Evaluation Panel */}
      {evaluation && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <EvaluationPanel evaluation={evaluation} />
          </CardContent>
        </Card>
      )}

      {/* Conversation Replay */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length > 0 ? (
            <ConversationPanel
              messages={messages}
              status={session.status}
              startedAt={session.startedAt}
              completedAt={session.completedAt}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages recorded for this session.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
