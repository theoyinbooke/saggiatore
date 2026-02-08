import { useState } from "react";
import { IconTool, IconChevronDown } from "@tabler/icons-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/lib/types";

interface ToolCallCardProps {
  toolCall: ToolCall;
  result?: string;
}

export function ToolCallCard({ toolCall, result }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);

  let formattedArgs: string;
  try {
    formattedArgs = JSON.stringify(JSON.parse(toolCall.arguments), null, 2);
  } catch {
    formattedArgs = toolCall.arguments;
  }

  let formattedResult: string | undefined;
  if (result) {
    try {
      formattedResult = JSON.stringify(JSON.parse(result), null, 2);
    } catch {
      formattedResult = result;
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
        <IconTool className="h-4 w-4 shrink-0" />
        <span className="font-mono text-xs">{toolCall.name}</span>
        <IconChevronDown
          className={cn(
            "ml-auto h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 border-l-2 border-muted pl-4 pb-2 space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Arguments
            </p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono">
              {formattedArgs}
            </pre>
          </div>
          {formattedResult && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Result
              </p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs font-mono">
                {formattedResult}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
