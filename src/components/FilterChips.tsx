import { Badge } from "@/components/ui/badge";
import { IconX } from "@tabler/icons-react";

export interface FilterValue {
  category: string;
  value: string;
  label: string;
}

interface FilterChipsProps {
  filters: FilterValue[];
  onRemove: (filter: FilterValue) => void;
  onClearAll?: () => void;
}

export function FilterChips({ filters, onRemove, onClearAll }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Badge
          key={`${filter.category}-${filter.value}`}
          variant="outline"
          className="gap-1 pl-2 pr-1 py-1 text-xs"
        >
          <span className="text-muted-foreground">{filter.category}</span>
          <span className="font-medium">{filter.label}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(filter);
            }}
            className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
          >
            <IconX className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
