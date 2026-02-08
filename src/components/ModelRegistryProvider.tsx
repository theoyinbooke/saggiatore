import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { setModelCache } from "@/lib/models";
import type { ModelConfig } from "@/lib/models";
import type { ModelRegistryEntry } from "@/lib/types";

export function ModelRegistryProvider({ children }: { children: React.ReactNode }) {
  const models: ModelRegistryEntry[] = (useQuery(api.modelRegistry.list) as ModelRegistryEntry[] | undefined) ?? [];

  useEffect(() => {
    if (models) {
      setModelCache(
        models.map((m): ModelConfig => ({
          id: m.modelId,
          displayName: m.displayName,
          provider: m.provider as "openai" | "openrouter" | "groq",
          apiModel: m.apiModel,
          envKey: m.envKey,
          color: m.color,
          badgeVariant: m.provider === "openai" ? "default" : "secondary",
        }))
      );
    }
  }, [models]);

  return <>{children}</>;
}
