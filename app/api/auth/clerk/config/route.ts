import { normalizePublishableKey, parseSuperAdminEmails } from "../../../../superadmin";

export const dynamic = "force-dynamic";

/**
 * Public browser configuration for the leadership sign-in.
 *
 * Served at request time rather than inlined at build time so the same build
 * can be deployed against different Clerk instances, and so a missing key is a
 * legible diagnostic instead of a blank screen. Only the publishable key and
 * readiness booleans are exposed here — never the secret key or the allowlist.
 */
export function GET() {
  // CLERK_PUBLISHABLE_KEY is read first because it is a genuine runtime lookup.
  // A NEXT_PUBLIC_* name is inlined into the bundle at build time by the
  // framework, which would defeat the point of serving it per request; it stays
  // supported only as a fallback for deployments already configured that way.
  const publishableKey =
    normalizePublishableKey(process.env.CLERK_PUBLISHABLE_KEY) ??
    normalizePublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const hasSecretKey = !!process.env.CLERK_SECRET_KEY?.trim();
  const hasSuperAdmin = parseSuperAdminEmails(process.env.SUPER_ADMIN_EMAIL).length > 0;

  return Response.json(
    {
      publishableKey: publishableKey ?? null,
      ready: !!publishableKey && hasSecretKey && hasSuperAdmin,
      missing: [
        ...(publishableKey ? [] : ["CLERK_PUBLISHABLE_KEY"]),
        ...(hasSecretKey ? [] : ["CLERK_SECRET_KEY"]),
        ...(hasSuperAdmin ? [] : ["SUPER_ADMIN_EMAIL"]),
      ],
    },
    { headers: { "cache-control": "no-store" } },
  );
}
