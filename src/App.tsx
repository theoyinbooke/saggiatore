import { lazy, Suspense, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { BottomDock } from "@/components/layout/BottomDock";
import MyBottomDock from "@/components/layout/MyBottomDock";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { PersonaExplorerPage } from "@/pages/PersonaExplorerPage";
import { ScenarioRunnerPage } from "@/pages/ScenarioRunnerPage";
import { ResultsDetailPage } from "@/pages/ResultsDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAdmin } from "@/components/auth/RequireAdmin";

const BlogPage = lazy(() =>
  import("@/pages/BlogPage").then((m) => ({ default: m.BlogPage }))
);

const MyDashboardPage = lazy(() => import("@/pages/my/MyDashboardPage"));
const CreateEvaluationModal = lazy(() => import("@/pages/my/MyCreatePage"));
const MyEvalDetailPage = lazy(() => import("@/pages/my/MyEvalDetailPage"));
const SharedViewPage = lazy(() => import("@/pages/my/SharedViewPage"));
const MySettingsPage = lazy(() => import("@/pages/my/MySettingsPage"));

const suspenseFallback = (
  <div className="flex items-center justify-center py-24 text-muted-foreground">
    Loading...
  </div>
);

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">Page not found</p>
      <Link
        to="/"
        className="mt-6 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Back to Leaderboard
      </Link>
    </div>
  );
}

export function App() {
  const location = useLocation();
  const isMyMode = location.pathname.startsWith("/my");
  const isSharedView = location.pathname.startsWith("/shared");
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {!isSharedView && <TopBar />}
      <main className={isSharedView ? "" : "mx-auto max-w-6xl px-6 pt-8 pb-24"}>
        <Routes>
          <Route path="/" element={<LeaderboardPage />} />
          <Route path="/personas" element={<PersonaExplorerPage />} />
          <Route path="/runner" element={<RequireAdmin><ScenarioRunnerPage /></RequireAdmin>} />
          <Route path="/results" element={<ResultsDetailPage />} />
          <Route path="/results/:sessionId" element={<ResultsDetailPage />} />
          <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
          <Route
            path="/blog"
            element={
              <Suspense fallback={suspenseFallback}>
                <BlogPage />
              </Suspense>
            }
          />
          <Route
            path="/my"
            element={
              <RequireAuth>
                <Suspense fallback={suspenseFallback}>
                  <MyDashboardPage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/my/eval/:evalId"
            element={
              <RequireAuth>
                <Suspense fallback={suspenseFallback}>
                  <MyEvalDetailPage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/my/blog"
            element={
              <Suspense fallback={suspenseFallback}>
                <BlogPage />
              </Suspense>
            }
          />
          <Route
            path="/my/settings"
            element={
              <RequireAuth>
                <Suspense fallback={suspenseFallback}>
                  <MySettingsPage />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/shared/:shareId"
            element={
              <Suspense fallback={suspenseFallback}>
                <SharedViewPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!isSharedView &&
        (isMyMode ? (
          <MyBottomDock onCreateClick={() => setShowCreate(true)} />
        ) : (
          <BottomDock />
        ))}
      {isMyMode && (
        <Suspense fallback={null}>
          <CreateEvaluationModal
            open={showCreate}
            onOpenChange={setShowCreate}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
