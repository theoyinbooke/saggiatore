import { ScoreRing } from "@/components/ScoreRing";
import { CATEGORY_DISPLAY_NAMES } from "@/lib/constants";
import { getModelDisplayName } from "@/lib/models";
import type { LeaderboardEntry, ScenarioCategory } from "@/lib/types";

interface CategoryBreakdownProps {
  entries: LeaderboardEntry[];
  filterCategory?: ScenarioCategory | null;
}

const CATEGORIES: ScenarioCategory[] = [
  "visa_application",
  "status_change",
  "family_immigration",
  "deportation_defense",
  "humanitarian",
];

export function CategoryBreakdown({ entries, filterCategory }: CategoryBreakdownProps) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No data available.
      </p>
    );
  }

  const displayedCategories = (filterCategory
    ? CATEGORIES.filter((c) => c === filterCategory)
    : CATEGORIES
  ).filter((cat) => entries.some((e) => (e.categoryScores[cat] ?? 0) > 0));

  if (displayedCategories.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No category scores available.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {displayedCategories.map((cat) => (
        <div key={cat}>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {CATEGORY_DISPLAY_NAMES[cat]}
          </p>
          <div className="flex items-center gap-6">
            {entries.map((entry) => (
              <div key={entry._id} className="flex items-center gap-2">
                <ScoreRing score={entry.categoryScores[cat] ?? 0} />
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
