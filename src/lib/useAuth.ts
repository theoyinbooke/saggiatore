import { useUser } from "@clerk/clerk-react";

export function useUserId(): string | null {
  const { user } = useUser();
  return user?.id ?? null;
}

export function useIsAdmin(): boolean {
  const { user } = useUser();
  return user?.publicMetadata?.role === "admin";
}
