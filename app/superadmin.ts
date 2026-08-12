/**
 * Super-admin authorization for the leadership settings screen.
 *
 * Identity comes from the Clerk application shared across the staff products,
 * so the same sign-in that opens Performance Pulse opens this editor. Clerk
 * proves *who* someone is; this module decides whether that person may edit the
 * business profile. Performance Pulse resolves the same decision against
 * SUPER_ADMIN_EMAIL plus a database `super_admin` role — this app has no
 * database, so the env allowlist is the whole answer.
 */

export type SuperAdminDecision =
  | { allowed: true; email: string }
  | { allowed: false; reason: "not_configured" | "not_authorized" };

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * SUPER_ADMIN_EMAIL accepts one address (as in Performance Pulse) or a
 * comma-separated list, so leadership can be more than one person without a
 * user table to hold the extras.
 */
export function parseSuperAdminEmails(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

export function decideSuperAdmin(email: unknown, superAdminEmailSetting: unknown): SuperAdminDecision {
  const allowlist = parseSuperAdminEmails(superAdminEmailSetting);
  // Fail closed: with no allowlist configured nobody is a super admin, so a
  // misconfigured deployment cannot silently leave the editor wide open.
  if (allowlist.length === 0) return { allowed: false, reason: "not_configured" };

  const candidate = normalizeEmail(email);
  if (!candidate || !allowlist.includes(candidate)) return { allowed: false, reason: "not_authorized" };

  return { allowed: true, email: candidate };
}

/**
 * A Clerk publishable key is the prefix followed by base64 of the instance's
 * frontend API host, so its length tracks that host's length and cannot be used
 * as a validity floor. Check the shape instead, which still catches an empty or
 * truncated value reaching ClerkProvider and unmounting the screen.
 */
export function normalizePublishableKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  return /^(?:pk_test_|pk_live_)[A-Za-z0-9_=$-]{8,}$/.test(key) ? key : undefined;
}
