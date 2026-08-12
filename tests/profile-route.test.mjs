import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

/**
 * The profile endpoint is the only way to change what every staff phone shows,
 * so these exercise the guard itself: a write must be refused unless the caller
 * proved they are an allowlisted leadership account.
 *
 * Route handlers are plain functions taking a Request, so they run directly
 * with no server and no database.
 */
const ROUTE = "../app/api/profile/route.ts";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

function put(body = { settings: {} }, headers = {}) {
  return new Request("http://localhost/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("a write with no credentials is refused before touching storage", async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_not_a_real_key";
  process.env.SUPER_ADMIN_EMAIL = "kevin@example.com";
  process.env.DATABASE_URL = "";

  const { PUT } = await import(ROUTE);
  const response = await PUT(put());

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.saved, false);
  assert.equal(body.reason, "no_token");
});

test("a write with a forged token is refused, without revealing why", async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_not_a_real_key";
  process.env.SUPER_ADMIN_EMAIL = "kevin@example.com";

  const { PUT } = await import(ROUTE);
  const response = await PUT(put({ settings: {} }, { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.forged" }));

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.saved, false);
  // The message must not distinguish expired from forged, which would only help
  // someone probing the endpoint.
  assert.match(body.message, /Sign in again/);
  assert.doesNotMatch(JSON.stringify(body), /sk_test|kevin@example\.com/);
});

test("with Clerk unconfigured the endpoint fails closed rather than open", async () => {
  delete process.env.CLERK_SECRET_KEY;
  process.env.SUPER_ADMIN_EMAIL = "kevin@example.com";

  const { PUT } = await import(ROUTE);
  const response = await PUT(put({ settings: {} }, { Authorization: "Bearer anything" }));

  assert.equal(response.status, 503);
  assert.equal((await response.json()).saved, false);
});

test("reads degrade to the browser's own copy when no database is configured", async () => {
  process.env.DATABASE_URL = "";

  const { GET } = await import(ROUTE);
  const response = await GET();

  // Employees must never see an error page because storage is unconfigured.
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.configured, false);
  assert.equal(body.settings, null);
});

test("the profile response is never cached", async () => {
  process.env.DATABASE_URL = "";
  const { GET } = await import(ROUTE);
  const response = await GET();
  assert.equal(response.headers.get("cache-control"), "no-store");
});
