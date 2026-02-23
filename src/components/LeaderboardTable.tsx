import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getModelDisplayName, getModelColor } from "@/lib/models";
import { getScoreTailwind } from "@/lib/constants";
import type { LeaderboardEntry, EvaluationMetrics, ScenarioCategory } from "@/lib/types";
import type { MetricKey } from "@/lib/constants";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  sortMetric?: MetricKey | "overall";
  filterCategory?: ScenarioCategory | null;
  linkToResults?: boolean;
}

/** Resolve the primary score for an entry given the active filters. */
function getPrimaryScore(
  entry: LeaderboardEntry,
  sortMetric: MetricKey | "overall",
  filterCategory: ScenarioCategory | null
): number {
  // When a scenario/category filter is active, the Score column reflects that category
  if (filterCategory) {
    return entry.categoryScores[filterCategory] ?? 0;
  }
  if (sortMetric === "overall") return entry.overallScore;
  return entry.metrics[sortMetric as keyof EvaluationMetrics] ?? 0;
}

export function LeaderboardTable({
  entries,
  sortMetric = "overall",
  filterCategory = null,
  linkToResults = true,
}: LeaderboardTableProps) {
  const navigate = useNavigate();

  // Sort entries by the resolved primary score
  const sorted = [...entries].sort(
    (a, b) =>
      getPrimaryScore(b, sortMetric, filterCategory) -
      getPrimaryScore(a, sortMetric, filterCategory)
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Model</TableHead>
          <TableHead className="text-center">Score</TableHead>
          <TableHead className="text-center">Evals</TableHead>
          <TableHead className="text-right">Tool Acc.</TableHead>
          <TableHead className="text-right">Empathy</TableHead>
          <TableHead className="text-right">Factual</TableHead>
          <TableHead className="text-right">Complete</TableHead>
          <TableHead className="text-right">Safety</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry, i) => {
          const score = getPrimaryScore(entry, sortMetric, filterCategory);

          return (
            <TableRow
              key={entry._id}
              className={linkToResults ? "cursor-pointer" : undefined}
              onClick={
                linkToResults
                  ? () => navigate(`/results?model=${entry.modelId}`)
                  : undefined
              }
            >
              <TableCell className="font-medium">{i + 1}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  style={{ borderColor: getModelColor(entry.modelId) }}
                >
                  {getModelDisplayName(entry.modelId)}
                </Badge>
              </TableCell>
              <TableCell className={`text-center font-semibold font-mono text-sm ${getScoreTailwind(score)}`}>
                {Math.round(score * 100)}
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {entry.totalEvaluations}
              </TableCell>
              <MetricCell value={entry.metrics.toolAccuracy} />
              <MetricCell value={entry.metrics.empathy} />
              <MetricCell value={entry.metrics.factualCorrectness} />
              <MetricCell value={entry.metrics.completeness} />
              <MetricCell value={entry.metrics.safetyCompliance} />
            </TableRow>
          );
        })}
        {sorted.length === 0 && (
          <TableRow>
            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
              No leaderboard data yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function MetricCell({ value }: { value: number }) {
  return (
    <TableCell className={`text-right font-mono text-xs ${getScoreTailwind(value)}`}>
      {(value * 100).toFixed(0)}
    </TableCell>
  );
}
