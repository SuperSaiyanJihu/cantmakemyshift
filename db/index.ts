import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Next.js reloads modules in development, and each reload would otherwise open
 * a fresh pool until Postgres refuses new connections.
 */
const globalForDb = globalThis as unknown as { __cmmsDb?: Database };

/**
 * Returns the database, or null when none is configured.
 *
 * Null is a supported state rather than an error: without DATABASE_URL the app
 * still works, with each browser keeping its own profile as before. Callers
 * decide what a missing database means for them, so a misconfigured deployment
 * degrades instead of showing employees an error page.
 */
export function getDb(): Database | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (globalForDb.__cmmsDb) return globalForDb.__cmmsDb;

  const client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    // Railway's internal networking terminates TLS at the proxy; the public
    // proxy URL needs TLS without a client cert.
    ssl: url.includes("sslmode=disable") ? false : "prefer",
  });
  const db = drizzle(client, { schema });
  globalForDb.__cmmsDb = db;
  return db;
}

export { schema };
