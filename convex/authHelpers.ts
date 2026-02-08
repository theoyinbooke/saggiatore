import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx | ActionCtx;

export async function requireAuth(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  return identity;
}

export async function requireAdmin(ctx: Ctx) {
  const identity = await requireAuth(ctx);
  // Clerk JWT custom claim: role from user.publicMetadata.role
  const role = (identity as Record<string, unknown>).role;
  if (role !== "admin") {
    throw new Error("Admin access required");
  }
  return identity;
}

export function getUserIdFromIdentity(identity: { subject: string }) {
  return identity.subject;
}
