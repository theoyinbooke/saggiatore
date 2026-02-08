import { useState } from "react";
import { IconAlertTriangle, IconSelector } from "@tabler/icons-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MAX_ENABLED_MODELS } from "@/lib/constants";
import type { ModelRegistryEntry } from "@/lib/types";

interface ModelMultiSelectProps {
  models: ModelRegistryEntry[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  maxSelections?: number;
  disabled?: boolean;
  className?: string;
}

export function ModelMultiSelect({
  models,
  selectedIds,
  onSelectionChange,
  maxSelections = MAX_ENABLED_MODELS,
  disabled = false,
  className,
}: ModelMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const atMax = selectedIds.length >= maxSelections;

  function toggle(modelId: string) {
    if (selectedIds.includes(modelId)) {
      onSelectionChange(selectedIds.filter((id) => id !== modelId));
    } else if (!atMax) {
      onSelectionChange([...selectedIds, modelId]);
    }
  }

  const selectedModels = selectedIds
    .map((id) => models.find((m) => m.modelId === id))
    .filter(Boolean) as ModelRegistryEntry[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "border-input bg-transparent flex h-8 w-72 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {selectedModels.length === 0 && (
              <span className="text-muted-foreground">Select models...</span>
            )}
            {selectedModels.length === 1 && (
              <>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedModels[0].color }}
                />
                <span className="truncate">{selectedModels[0].displayName}</span>
              </>
            )}
            {selectedModels.length >= 2 && (
              <>
                <div className="flex items-center -space-x-1">
                  {selectedModels.map((model) => (
                    <span
                      key={model.modelId}
                      className="size-2.5 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: model.color }}
                    />
                  ))}
                </div>
                <span className="truncate text-muted-foreground">
                  {selectedModels.length} models selected
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="text-muted-foreground text-[10px] tabular-nums">
              {selectedIds.length}/{maxSelections}
            </Badge>
            <IconSelector className="text-muted-foreground size-4" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList>
            <CommandEmpty>No models found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => {
                const selected = selectedIds.includes(model.modelId);
                const dimmed = atMax && !selected;

                return (
                  <CommandItem
                    key={model.modelId}
                    value={`${model.displayName} ${model.apiModel}`}
                    onSelect={() => toggle(model.modelId)}
                    data-checked={selected ? "true" : "false"}
                    className={dimmed ? "opacity-50 pointer-events-none" : ""}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: model.color }}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{model.displayName}</span>
                      <span className="text-muted-foreground text-xs">
                        {model.apiModel}
                      </span>
                    </div>
                    {!model.supportsTools && (
                      <IconAlertTriangle className="ml-auto size-4 shrink-0 text-amber-500" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
