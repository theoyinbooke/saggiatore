import { ScoreRing } from "@/components/ScoreRing";
import { getModelDisplayName } from "@/lib/models";
import type { GeneratedCategory, CustomLeaderboardEntry } from "@/lib/types";

interface GenericCategoryBreakdownProps {
  categories: GeneratedCategory[];
  entries: CustomLeaderboardEntry[];
}

export default function GenericCategoryBreakdown({
  categories,
  entries,
}: GenericCategoryBreakdownProps) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No data available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.id}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {cat.displayName}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {entries.map((entry) => (
              <div key={entry._id} className="flex items-center gap-2">
                <ScoreRing score={entry.categoryScores[cat.id] ?? 0} />
                <span className="text-xs text-muted-foreground">
                  {getModelDisplayName(entry.modelId)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
