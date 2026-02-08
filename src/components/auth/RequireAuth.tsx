import { useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignIn } from "@clerk/clerk-react";
import {
  IconScale,
  IconFlask,
  IconChartBar,
  IconShare,
  IconLock,
} from "@tabler/icons-react";

const VALUE_POINTS = [
  {
    icon: IconFlask,
    title: "Create custom evaluations",
    description:
      "Design your own test scenarios and run them against the AI models that matter to you.",
  },
  {
    icon: IconChartBar,
    title: "Track and compare results",
    description:
      "See how different models perform side-by-side with clear, detailed breakdowns.",
  },
  {
    icon: IconShare,
    title: "Share your findings",
    description:
      "Generate shareable links so your team or community can see your evaluation results.",
  },
  {
    icon: IconLock,
    title: "Your data, your space",
    description:
      "Everything you create is private to your account until you decide to share it.",
  },
];

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="grid min-h-[70vh] grid-cols-1 items-center gap-12 py-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — value proposition */}
          <div className="flex flex-col gap-8 px-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary">
                <IconScale size={28} />
                <span className="text-sm font-semibold uppercase tracking-wider">
                  My Saggiatore
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
                Your personal AI evaluation workspace
              </h1>
              <p className="max-w-md text-muted-foreground">
                Sign in to unlock tools that let you test, compare, and
                understand AI models on your own terms.
              </p>
            </div>

            <div className="flex flex-col gap-5">
              {VALUE_POINTS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Clerk sign-in */}
          <div className="flex items-center justify-center">
            <SignIn routing="hash" fallbackRedirectUrl={location.pathname} />
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}
