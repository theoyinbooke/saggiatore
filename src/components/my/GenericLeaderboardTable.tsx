import { useState } from "react";
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
import { formatScore } from "@/lib/utils";
import type { CustomLeaderboardEntry, GeneratedMetric } from "@/lib/types";
import { IconArrowUp, IconArrowDown } from "@tabler/icons-react";

interface GenericLeaderboardTableProps {
  entries: CustomLeaderboardEntry[];
  metrics: GeneratedMetric[];
  onSelectModel?: (modelId: string) => void;
}

type SortColumn = "overall" | string;
type SortDirection = "asc" | "desc";

export default function GenericLeaderboardTable({
  entries,
  metrics,
  onSelectModel,
}: GenericLeaderboardTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("overall");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  }

  const sorted = [...entries].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    if (sortColumn === "overall") {
      aVal = a.overallScore;
      bVal = b.overallScore;
    } else {
      aVal = a.metricScores[sortColumn] ?? 0;
      bVal = b.metricScores[sortColumn] ?? 0;
    }

    return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
  });

  const SortIcon = sortDirection === "desc" ? IconArrowDown : IconArrowUp;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Model</TableHead>
          <TableHead
            className="text-center cursor-pointer select-none"
            onClick={() => handleSort("overall")}
          >
            <span className="inline-flex items-center gap-1">
              Score
              {sortColumn === "overall" && <SortIcon className="h-3 w-3" />}
            </span>
          </TableHead>
          {metrics.map((m) => (
            <TableHead
              key={m.key}
              className="text-right cursor-pointer select-none"
              onClick={() => handleSort(m.key)}
            >
              <span className="inline-flex items-center gap-1 justify-end">
                {m.displayName}
                {sortColumn === m.key && <SortIcon className="h-3 w-3" />}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry, i) => (
          <TableRow
            key={entry._id}
            className={onSelectModel ? "cursor-pointer" : ""}
            onClick={() => onSelectModel?.(entry.modelId)}
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
            <TableCell className={`text-center font-semibold font-mono text-sm ${getScoreTailwind(entry.overallScore)}`}>
              {Math.round(entry.overallScore * 100)}
            </TableCell>
            {metrics.map((m) => {
              const value = entry.metricScores[m.key] ?? 0;
              return (
                <TableCell
                  key={m.key}
                  className={`text-right font-mono text-xs ${getScoreTailwind(value)}`}
                >
                  {formatScore(value)}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
        {sorted.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={3 + metrics.length}
              className="text-center text-muted-foreground py-8"
            >
              No leaderboard data yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
