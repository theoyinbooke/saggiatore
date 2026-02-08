import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconPlayerPlay, IconLoader2, IconLock } from "@tabler/icons-react";
import { MODEL_OPTIONS } from "@/lib/models";
import type { ModelRegistryEntry } from "@/lib/types";
import { getGalileoKey, setGalileoKey } from "@/lib/galileoKey";

interface CreateEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateEvaluationModal({
  open,
  onOpenChange,
}: CreateEvaluationModalProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const rawEnabledModels = useQuery(api.modelRegistry.listEnabled);

  const modelOptions = rawEnabledModels
    ? (rawEnabledModels as ModelRegistryEntry[]).map((m) => ({
        id: m.modelId,
        label: m.displayName,
        provider: m.provider === "openai" ? "OpenAI" : m.provider === "groq" ? "Groq" : "OpenRouter",
        color: m.color,
      }))
    : MODEL_OPTIONS.map((m) => ({ ...m, color: undefined as string | undefined }));

  const [description, setDescription] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const savedGalileoKey = getGalileoKey();
  const hasSettingsKey = !!savedGalileoKey;
  const [apiKey, setApiKey] = useState(savedGalileoKey ?? "");
  const [saveKey, setSaveKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (rawEnabledModels) {
      const enabledIds = new Set((rawEnabledModels as ModelRegistryEntry[]).map((m) => m.modelId));
      setSelectedModels((prev) => prev.filter((id) => enabledIds.has(id)));
    }
  }, [rawEnabledModels]);

  // Reset form state when modal closes
  useEffect(() => {
    if (!open) {
      setDescription("");
      setSelectedModels([]);
      setIsSubmitting(false);
      setSaveKey(false);
    }
  }, [open]);

  const createEval = useMutation(api.customEvaluations.create);
  const generateConfig = useAction(api.customGenerator.generateEvaluationConfig);

  function toggleModel(modelId: string) {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (saveKey && apiKey.trim()) {
        setGalileoKey(apiKey.trim());
      }

      const evalId = await createEval({
        userId: user!.id,
        title: "New Evaluation",
        useCaseDescription: description,
        selectedModelIds: selectedModels,
      });

      // Fire-and-forget — the action runs server-side and updates status
      generateConfig({
        evaluationId: evalId,
        galileoApiKey: apiKey.trim() || undefined,
      });

      onOpenChange(false);
      navigate(`/my/eval/${evalId}`);
    } catch (err) {
      console.error("Failed to create evaluation:", err);
      setIsSubmitting(false);
    }
  }

  const canSubmit = description.length >= 50 && selectedModels.length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Evaluation</DialogTitle>
          <DialogDescription>
            Describe your use case and select models to evaluate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Use case description */}
          <div className="space-y-2">
            <Label htmlFor="description">Describe your use case</Label>
            <Textarea
              id="description"
              placeholder="Describe the LLM agent you want to evaluate..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={50}
              maxLength={2000}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/2000 characters
              {description.length > 0 && description.length < 50 && (
                <span className="ml-2 text-destructive">
                  Minimum 50 characters required
                </span>
              )}
            </p>
          </div>

          {/* Model selection */}
          <div className="space-y-3">
            <Label>Select Models</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {modelOptions.map((model) => (
                <label
                  key={model.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedModels.includes(model.id)}
                    onCheckedChange={() => toggleModel(model.id)}
                  />
                  <div className="flex items-center gap-2">
                    {model.color && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: model.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{model.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {model.provider}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {modelOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No models enabled.{" "}
                <Link to="/settings" className="text-primary underline">
                  Enable models in Settings
                </Link>
                .
              </p>
            )}
          </div>

          {/* Galileo API Key */}
          <div className="space-y-2">
            <Label htmlFor="galileo-key">
              Galileo API Key (optional)
            </Label>
            <div className="relative">
              <Input
                id="galileo-key"
                type="password"
                placeholder="Enter your Galileo API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                readOnly={hasSettingsKey}
                className={hasSettingsKey ? "pr-9 opacity-60" : ""}
              />
              {hasSettingsKey && (
                <IconLock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
            </div>
            {hasSettingsKey ? (
              <p className="text-xs text-muted-foreground">
                Using API key from{" "}
                <Link to="/my/settings" className="text-primary underline">
                  Settings
                </Link>
              </p>
            ) : (
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={saveKey}
                  onCheckedChange={(checked) => setSaveKey(checked === true)}
                />
                <span className="text-sm text-muted-foreground">
                  Save API key for future evaluations
                </span>
              </label>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full gap-1.5"
          >
            {isSubmitting ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconPlayerPlay className="h-4 w-4" />
            )}
            {isSubmitting ? "Creating..." : "Generate & Run Evaluation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
