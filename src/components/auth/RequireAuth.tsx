import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignIn } from "@clerk/clerk-react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center gap-6 py-24">
          <p className="text-lg font-medium text-muted-foreground">
            Sign in to access My Saggiatore
          </p>
          <SignIn routing="hash" />
        </div>
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}
