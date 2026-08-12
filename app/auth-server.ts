import { createClerkClient, verifyToken } from "@clerk/backend";
import { decideSuperAdmin, type SuperAdminDecision } from "./superadmin.ts";

export type AuthOutcome =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 503; reason: string; message: string };

/**
 * Resolves the caller's Clerk session token into a super-admin decision.
 *
 * Shared by every route that guards leadership data, so authorization can only
 * ever be changed in one place. Verification is server-side by construction:
 * the secret key and the allowlist are never sent to the browser.
 */
export async function authorizeSuperAdmin(request: Request): Promise<AuthOutcome> {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    return {
      ok: false,
      status: 503,
      reason: "not_configured",
      message: "CLERK_SECRET_KEY is not configured.",
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return { ok: false, status: 401, reason: "no_token", message: "Sign in again to continue." };
  }

  let email: string | undefined;
  try {
    const payload = await verifyToken(token, { secretKey });
    const clerkUserId = payload.sub;
    if (!clerkUserId) throw new Error("Clerk token missing subject");

    const user = await createClerkClient({ secretKey }).users.getUser(clerkUserId);
    // Only the account's own primary address, and only once Clerk has verified
    // it. Anyone can attach an arbitrary unverified address to an account, so
    // trusting one would let any account on the shared staff Clerk instance
    // claim a leadership address.
    const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);
    email = primary?.verification?.status === "verified" ? primary.emailAddress : undefined;
  } catch {
    // Never echo the verification error: it distinguishes an expired token from
    // a forged one, which only helps someone probing the endpoint.
    return { ok: false, status: 401, reason: "invalid_token", message: "Sign in again to continue." };
  }

  const decision: SuperAdminDecision = decideSuperAdmin(email, process.env.SUPER_ADMIN_EMAIL);
  if (!decision.allowed) {
    return decision.reason === "not_configured"
      ? {
          ok: false,
          status: 503,
          reason: "not_configured",
          message: "SUPER_ADMIN_EMAIL is not configured, so no one can be authorized yet.",
        }
      : {
          ok: false,
          status: 403,
          reason: "not_authorized",
          message: "This account is not authorized to edit the business profile.",
        };
  }

  return { ok: true, email: decision.email };
}
