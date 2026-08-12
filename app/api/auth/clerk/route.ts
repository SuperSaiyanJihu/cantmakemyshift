import { authorizeSuperAdmin } from "../../../auth-server.ts";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Exchange a Clerk session token for a super-admin decision.
 *
 * Mirrors Performance Pulse's `POST /api/auth/clerk`: the browser sends its
 * Clerk session token and the server answers whether that person may edit the
 * business profile. The editor uses this to decide what to render; every write
 * is separately re-checked server-side, so a tampered answer here grants
 * nothing.
 */
export async function POST(request: Request) {
  const outcome = await authorizeSuperAdmin(request);

  if (!outcome.ok) {
    return Response.json(
      { allowed: false, reason: outcome.reason, message: outcome.message },
      { status: outcome.status, headers: NO_STORE },
    );
  }

  return Response.json({ allowed: true, email: outcome.email }, { headers: NO_STORE });
}
