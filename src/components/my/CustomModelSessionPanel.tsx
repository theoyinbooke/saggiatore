import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ConversationPanel } from "@/components/ConversationPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getModelDisplayName, getModelColor } from "@/lib/models";
import type { CustomSession, Message, SessionStatus } from "@/lib/types";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "secondary",
  completed: "default",
  failed: "destructive",
  timeout: "destructive",
  cancelled: "outline",
};

interface CustomModelSessionPanelProps {
  session: CustomSession;
  completedCount?: number;
  totalCount?: number;
  panelHeight?: string;
}

export function CustomModelSessionPanel({
  session,
  completedCount,
  totalCount,
  panelHeight,
}: CustomModelSessionPanelProps) {
  const rawMessages = useQuery(
    api.customMessages.bySessionPublic,
    { sessionId: session._id as never }
  );
  const messages: Message[] = (rawMessages as Message[] | undefined) ?? [];

  const isRunning = session.status === "running" || session.status === "pending";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: getModelColor(session.modelId) }}
            />
            {getModelDisplayName(session.modelId)}
          </CardTitle>
          <div className="flex items-center gap-2">
            {completedCount !== undefined && totalCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalCount}
              </span>
            )}
            <Badge variant={STATUS_VARIANTS[session.status] ?? "outline"}>
              {session.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {messages.length > 0 ? (
          <ConversationPanel
            messages={messages}
            status={session.status as SessionStatus}
            startedAt={session.startedAt}
            completedAt={session.completedAt}
            height={panelHeight}
          />
        ) : isRunning ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Waiting for messages...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
