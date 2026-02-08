import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import {
  IconUser,
  IconRobot,
  IconSettings,
  IconTool,
} from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToolCallCard } from "@/components/ToolCallCard";
import { cn } from "@/lib/utils";
import type { Message, SessionStatus } from "@/lib/types";

const ROLE_ICONS: Record<string, React.ElementType> = {
  user: IconUser,
  assistant: IconRobot,
  system: IconSettings,
  tool: IconTool,
};

const ROLE_LABELS: Record<string, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
  tool: "Tool",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-blue-100 text-blue-700",
  assistant: "bg-primary/10 text-primary",
  system: "bg-muted text-muted-foreground",
  tool: "bg-amber-100 text-amber-700",
};

interface ConversationPanelProps {
  messages: Message[];
  status?: SessionStatus;
  startedAt?: number;
  completedAt?: number;
  height?: string;
}

function formatDuration(startMs: number, endMs: number): string {
  const seconds = Math.round((endMs - startMs) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function ConversationPanel({
  messages,
  status,
  startedAt,
  completedAt,
  height = "h-[500px]",
}: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Build a map of tool call results: toolCallId -> message content
  const toolResults = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role === "tool" && msg.toolCallId) {
      toolResults.set(msg.toolCallId, msg.content);
    }
  }

  // Filter out tool-result messages (they are shown inline with ToolCallCard)
  const visibleMessages = messages.filter((m) => m.role !== "tool");

  const durationStr =
    startedAt && completedAt
      ? formatDuration(startedAt, completedAt)
      : startedAt
        ? "in progress..."
        : null;

  return (
    <div className="flex flex-col">
      {/* Session duration header */}
      {durationStr && (
        <div className="mb-3 text-sm text-muted-foreground">
          Session lasted for <span className="font-medium text-foreground">{durationStr}</span>
        </div>
      )}

      <ScrollArea className={height} ref={scrollRef}>
        <div className="space-y-1 pr-4">
          {visibleMessages.map((msg) => {
            const Icon = ROLE_ICONS[msg.role] ?? IconUser;
            return (
              <div key={msg._id}>
                {/* Message row */}
                <div className="flex items-start gap-3 rounded-md px-2 py-2">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      ROLE_COLORS[msg.role]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {ROLE_LABELS[msg.role]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Turn {msg.turnNumber}
                      </span>
                    </div>
                    {msg.role !== "system" ? (
                      <div className="prose prose-sm mt-0.5 max-w-none text-sm prose-headings:mb-1 prose-headings:mt-2 prose-headings:text-sm prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground italic">
                        {msg.content.length > 120
                          ? msg.content.slice(0, 120) + "..."
                          : msg.content}
                      </p>
                    )}
                  </div>
                </div>

                {/* Inline tool calls (expandable sub-entries) */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="ml-10 space-y-0.5">
                    {msg.toolCalls.map((tc) => (
                      <ToolCallCard
                        key={tc.id}
                        toolCall={tc}
                        result={toolResults.get(tc.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading skeleton when session is running */}
          {status === "running" && (
            <div className="flex items-start gap-3 px-2 py-2">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
