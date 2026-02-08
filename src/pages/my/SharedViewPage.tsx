import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { IconScale } from "@tabler/icons-react";
import type { CustomEvaluation, CustomLeaderboardEntry } from "@/lib/types";
import GenericLeaderboardTable from "@/components/my/GenericLeaderboardTable";
import GenericCategoryBreakdown from "@/components/my/GenericCategoryBreakdown";

export default function SharedViewPage() {
  const { shareId } = useParams<{ shareId: string }>();

  const rawEvaluation = useQuery(
    api.customEvaluations.getByShareId,
    shareId ? { shareId } : "skip"
  );
  const evaluation: CustomEvaluation | undefined =
    rawEvaluation as CustomEvaluation | undefined;

  const rawLeaderboard = useQuery(
    api.customLeaderboard.getByEvaluation,
    evaluation?._id
      ? { evaluationId: evaluation._id as never }
      : "skip"
  );
  const leaderboard: CustomLeaderboardEntry[] =
    (rawLeaderboard as CustomLeaderboardEntry[] | undefined) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Clean header */}
      <header className="flex items-center gap-2 px-6 py-4">
        <IconScale className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight">
          Shared Evaluation
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {!evaluation ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              Evaluation not found
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This shared evaluation may have been removed or the link is
              invalid.
            </p>
          </div>
        ) : evaluation.status !== "completed" ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              This evaluation is still in progress
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Check back later to see the results.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight">
                {evaluation.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {evaluation.useCaseDescription}
              </p>
            </div>

            {leaderboard.length > 0 && evaluation.generatedConfig && (
              <>
                <GenericLeaderboardTable
                  entries={leaderboard}
                  metrics={evaluation.generatedConfig.metrics}
                />
                <GenericCategoryBreakdown
                  entries={leaderboard}
                  categories={evaluation.generatedConfig.categories}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 text-center text-sm text-muted-foreground">
        Powered by{" "}
        <Link
          to="/"
          className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Saggiatore
        </Link>
      </footer>
    </div>
  );
}
