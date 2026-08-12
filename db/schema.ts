import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The business profile every device reads.
 *
 * Keyed by slug even though there is exactly one row today ("default"). A
 * second organization later is then another row and a lookup change, rather
 * than a schema migration on live data.
 */
export const businessProfiles = pgTable("business_profiles", {
  slug: text("slug").primaryKey(),
  /** A whole `Settings` object; the app validates it on read and on write. */
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  /** Which leadership account last saved, for answering "who changed this?". */
  updatedBy: text("updated_by"),
});

export const DEFAULT_PROFILE_SLUG = "default";
