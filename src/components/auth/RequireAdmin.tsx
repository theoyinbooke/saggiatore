import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignIn, useUser } from "@clerk/clerk-react";

function AdminGate({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-lg font-medium text-muted-foreground">
          Admin access required
        </p>
        <p className="text-sm text-muted-foreground">
          You don't have permission to access this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
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
            Sign in to continue
          </p>
          <SignIn routing="hash" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <AdminGate>{children}</AdminGate>
      </Authenticated>
    </>
  );
}
