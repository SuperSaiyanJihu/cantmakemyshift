import { authorizeSuperAdmin } from "../../auth-server.ts";
import { normalizeSettings } from "../../settings.ts";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * Loads the database only when one is configured.
 *
 * The import is deferred so that a deployment without DATABASE_URL never pulls
 * in the Postgres driver at all, and so these handlers can be exercised
 * directly in tests without a database present.
 */
async function loadProfileStore() {
  if (!process.env.DATABASE_URL?.trim()) return null;

  const [{ getDb }, { DEFAULT_PROFILE_SLUG, businessProfiles }, { eq }] = await Promise.all([
    import("../../../db/index.ts"),
    import("../../../db/schema.ts"),
    import("drizzle-orm"),
  ]);

  const db = getDb();
  if (!db) return null;
  return { db, slug: DEFAULT_PROFILE_SLUG, table: businessProfiles, eq };
}

/**
 * The shared business profile.
 *
 * Readable by anyone: employees are anonymous by design, and these are the
 * directions they are told to follow. Nothing private lives here — leadership
 * writes it precisely so that staff can read it.
 */
export async function GET() {
  const store = await loadProfileStore();
  if (!store) {
    // No database configured: the browser keeps using its own stored profile.
    return Response.json({ configured: false, settings: null }, { headers: NO_STORE });
  }

  try {
    const [row] = await store.db
      .select()
      .from(store.table)
      .where(store.eq(store.table.slug, store.slug))
      .limit(1);

    return Response.json(
      {
        configured: true,
        settings: row ? normalizeSettings(row.settings) : null,
        updatedAt: row?.updatedAt ?? null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[profile] read failed:", error);
    // Never fail the employee's screen because storage is unhappy; they fall
    // back to the copy already in their browser.
    return Response.json({ configured: false, settings: null }, { status: 200, headers: NO_STORE });
  }
}

/**
 * Replace the shared profile. Leadership only.
 *
 * Authorization is re-checked here rather than trusted from the client: the
 * editor's own gate decides what to *render*, but this decides what can be
 * *written*.
 */
export async function PUT(request: Request) {
  const outcome = await authorizeSuperAdmin(request);
  if (!outcome.ok) {
    return Response.json(
      { saved: false, reason: outcome.reason, message: outcome.message },
      { status: outcome.status, headers: NO_STORE },
    );
  }

  const store = await loadProfileStore();
  if (!store) {
    return Response.json(
      {
        saved: false,
        reason: "no_database",
        message: "DATABASE_URL is not configured, so there is nowhere to save a shared profile.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { saved: false, reason: "bad_request", message: "That did not look like a business profile." },
      { status: 400, headers: NO_STORE },
    );
  }

  // Normalizing before storage means a malformed or hostile payload cannot
  // reach an employee's screen: unknown fields are dropped, missing ones get
  // defaults, and every value lands in the shape the app renders.
  const settings = normalizeSettings((body as { settings?: unknown })?.settings ?? body);

  try {
    await store.db
      .insert(store.table)
      .values({
        slug: store.slug,
        settings,
        updatedAt: new Date(),
        updatedBy: outcome.email,
      })
      .onConflictDoUpdate({
        target: store.table.slug,
        set: { settings, updatedAt: new Date(), updatedBy: outcome.email },
      });

    return Response.json({ saved: true, settings }, { headers: NO_STORE });
  } catch (error) {
    console.error("[profile] write failed:", error);
    return Response.json(
      { saved: false, reason: "write_failed", message: "The profile could not be saved. Please try again." },
      { status: 500, headers: NO_STORE },
    );
  }
}
