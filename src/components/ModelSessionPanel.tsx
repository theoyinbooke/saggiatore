import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ConversationPanel } from "@/components/ConversationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getModelDisplayName, getModelColor } from "@/lib/models";
import { IconPlayerStop } from "@tabler/icons-react";
import type { Message, Session, SessionStatus } from "@/lib/types";

const STATUS_VARIANTS: Record<SessionStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  running: "secondary",
  completed: "default",
  failed: "destructive",
  timeout: "destructive",
  cancelled: "outline",
};

interface ModelSessionPanelProps {
  modelId: string;
  sessionId: string;
  panelHeight?: string;
  onCancel?: () => void;
}

export function ModelSessionPanel({ modelId, sessionId, panelHeight, onCancel }: ModelSessionPanelProps) {
  const isMock = sessionId.startsWith("mock-");

  const rawSession = useQuery(
    api.sessions.getById,
    !isMock ? { id: sessionId as never } : "skip"
  );
  const session = rawSession as Session | undefined;

  const rawMessages = useQuery(
    api.messages.bySession,
    !isMock ? { sessionId: sessionId as never } : "skip"
  );
  const messages: Message[] = (rawMessages as Message[] | undefined) ?? [];

  const displayMessages = messages;
  const displaySession = session;

  const isRunning = displaySession?.status === "running" || displaySession?.status === "pending";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: getModelColor(modelId) }}
            />
            {getModelDisplayName(modelId)}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isRunning && onCancel && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={onCancel}
              >
                <IconPlayerStop className="size-3" />
                Cancel
              </Button>
            )}
            {displaySession && (
              <Badge variant={STATUS_VARIANTS[displaySession.status]}>
                {displaySession.status}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {displayMessages.length > 0 ? (
          <ConversationPanel
            messages={displayMessages}
            status={displaySession?.status}
            startedAt={displaySession?.startedAt}
            completedAt={displaySession?.completedAt}
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
