import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconPlus, IconCheck } from "@tabler/icons-react";
import { useUser } from "@clerk/clerk-react";
import type { CustomEvaluation } from "@/lib/types";
import EvaluationCard from "@/components/my/EvaluationCard";
import CreateEvaluationModal from "@/pages/my/MyCreatePage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { getGalileoKey } from "@/lib/galileoKey";
import OnboardingGuide from "@/components/my/OnboardingGuide";

export default function MyDashboardPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const deleteEval = useMutation(api.customEvaluations.deleteEvaluation);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(() => !!getGalileoKey());

  // Always call hooks unconditionally — skip the query when there's no key
  const rawEvaluations = useQuery(
    api.customEvaluations.listByUser,
    hasKey && user ? { userId: user.id } : "skip"
  );

  function handleDelete(id: string) {
    setDeleteTarget(id);
  }

  function handleConfirmDelete() {
    if (deleteTarget) {
      deleteEval({ id: deleteTarget as never });
      setDeleteTarget(null);
    }
  }

  // Show onboarding when no API key is configured
  if (!hasKey) {
    return <OnboardingGuide onKeySubmitted={() => setHasKey(true)} />;
  }

  // Show a stable loading state while the query resolves,
  // instead of flashing empty state then switching to real data.
  if (rawEvaluations === undefined) {
    return (
      <div>
        <PageHeader title="My Evaluations" stats={[]} />
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          Loading evaluations…
        </div>
      </div>
    );
  }

  const evaluations: CustomEvaluation[] = rawEvaluations as CustomEvaluation[];

  const completedCount = evaluations.filter(
    (e) => e.status === "completed"
  ).length;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="[&>div]:mb-0">
          <PageHeader
            title="My Evaluations"
            stats={[
              { label: "Total", value: evaluations.length },
              { label: "Completed", value: completedCount },
            ]}
          />
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <IconPlus className="h-4 w-4" />
          New Evaluation
        </Button>
      </div>

      {evaluations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <IconCheck className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-lg font-medium">
              Your API key is configured
            </p>
            <p className="max-w-sm text-center text-sm text-muted-foreground">
              You're all set! Create your first evaluation to start
              benchmarking models.
            </p>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <IconPlus className="h-4 w-4" />
              Create Your First Evaluation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {evaluations.map((evaluation) => (
            <EvaluationCard
              key={evaluation._id}
              evaluation={evaluation}
              onClick={() => navigate(`/my/eval/${evaluation._id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateEvaluationModal open={showCreate} onOpenChange={setShowCreate} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
        title="Delete Evaluation"
        description="This evaluation and all its data will be permanently deleted. This cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
