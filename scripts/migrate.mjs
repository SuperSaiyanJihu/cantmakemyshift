import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies pending migrations, then exits. Run as the deploy's pre-deploy step
 * so a release can never serve code that expects a table the database does not
 * have yet.
 *
 * Uses drizzle-orm's own migrator rather than the drizzle-kit CLI: drizzle-kit
 * is a dev dependency, and a deploy that depends on dev dependencies surviving
 * into the runtime image breaks the first time the platform prunes them.
 */
const url = process.env.DATABASE_URL?.trim();

// A deployment without a database is a supported state: the app falls back to
// each browser's own stored profile. Failing here would take down the employee
// call-out flow over a feature that is not configured.
if (!url) {
  console.log("DATABASE_URL is not set — skipping migrations.");
  process.exit(0);
}

const client = postgres(url, {
  max: 1,
  ssl: url.includes("sslmode=disable") ? false : "prefer",
});

try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
} finally {
  await client.end({ timeout: 5 });
}
