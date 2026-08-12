import { createClerkClient, verifyToken } from "@clerk/backend";
import { decideSuperAdmin } from "../../../superadmin";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Exchange a Clerk session token for a super-admin decision.
 *
 * Mirrors Performance Pulse's `POST /api/auth/clerk`: the browser sends its
 * Clerk session token, the server verifies it against the shared Clerk
 * application, resolves the account's primary email, and answers whether that
 * person may edit the business profile. Verification happens here, never in the
 * browser, so the allowlist and the secret key stay server-side.
 */
export async function POST(request: Request) {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    return Response.json(
      { allowed: false, reason: "not_configured", message: "CLERK_SECRET_KEY is not configured." },
      { status: 503, headers: NO_STORE },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return Response.json(
      { allowed: false, reason: "no_token", message: "Sign in again to continue." },
      { status: 401, headers: NO_STORE },
    );
  }

  let email: string | undefined;
  try {
    const payload = await verifyToken(token, { secretKey });
    const clerkUserId = payload.sub;
    if (!clerkUserId) throw new Error("Clerk token missing subject");

    const user = await createClerkClient({ secretKey }).users.getUser(clerkUserId);
    const primary =
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
    email = primary?.emailAddress;
  } catch {
    // Never echo the verification error: it distinguishes an expired token from
    // a forged one, which only helps someone probing the endpoint.
    return Response.json(
      { allowed: false, reason: "invalid_token", message: "Sign in again to continue." },
      { status: 401, headers: NO_STORE },
    );
  }

  const decision = decideSuperAdmin(email, process.env.SUPER_ADMIN_EMAIL);
  if (!decision.allowed) {
    const message =
      decision.reason === "not_configured"
        ? "SUPER_ADMIN_EMAIL is not configured, so no one can be authorized yet."
        : "This account is not authorized to edit the business profile.";
    return Response.json(
      { allowed: false, reason: decision.reason, message },
      { status: decision.reason === "not_configured" ? 503 : 403, headers: NO_STORE },
    );
  }

  return Response.json({ allowed: true, email: decision.email }, { headers: NO_STORE });
}
