import assert from "node:assert/strict";
import test from "node:test";

import {
  defaults,
  migrateLegacySettings,
  normalizeSettings,
  parseStoredSettings,
  profileFileFor,
  settingsFromProfileFile,
} from "../app/settings.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the call-out home screen with default profile copy", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Can’t Make My Shift/);
  assert.match(html, /Excel Aquatics/);
  assert.match(html, /Call-out directions/);
  assert.match(html, /Can’t make\s*your shift\?/);
  assert.match(html, /This is an instruction tool\./);
  assert.match(html, /Business profile &amp; leadership settings/);
});

test("default profile keeps the original workflows and step actions", () => {
  assert.equal(defaults.flows.length, 3);
  const [emergency, conflict, sameDay] = defaults.flows;

  assert.equal(emergency.showEmergencyInfo, true);
  assert.equal(emergency.steps[0].action, "call");
  assert.ok(emergency.steps.slice(1).every((step) => step.action === "platform"));

  assert.ok(conflict.steps.every((step) => step.action === "platform"));

  assert.equal(sameDay.steps[3].action, "call");
  assert.equal(sameDay.steps[4].action, "none");
  assert.ok(sameDay.steps.slice(0, 3).every((step) => step.action === "platform"));
});

test("migrates v1 settings, preserving customized steps and hardcoded action positions", () => {
  const migrated = migrateLegacySettings({
    organization: "Test Pool Co",
    phone: "555-000-1111",
    homebaseUrl: "https://example.com/schedule",
    emergencyExamples: ["Custom example"],
    emergencySteps: ["Call the office.", "Message the manager."],
    conflictSteps: ["Request cover in the app.", "Wait for confirmation that coverage has been approved."],
    sameDaySteps: ["Use shift cover.", "DM staff.", "DM the supervisor.", "Call the office.", "Wait for leadership."],
  });

  assert.equal(migrated.organization, "Test Pool Co");
  assert.equal(migrated.phone, "555-000-1111");
  assert.equal(migrated.platformUrl, "https://example.com/schedule");
  assert.equal(migrated.platformName, "Homebase");
  assert.deepEqual(migrated.emergencyExamples, ["Custom example"]);

  const [emergency, conflict, sameDay] = migrated.flows;
  assert.deepEqual(emergency.steps.map((step) => step.action), ["call", "platform"]);
  assert.deepEqual(emergency.steps.map((step) => step.text), ["Call the office.", "Message the manager."]);

  assert.deepEqual(conflict.steps.map((step) => step.action), ["platform", "platform"]);
  assert.match(conflict.steps[1].text, /direct-message the Program Director/);

  assert.deepEqual(sameDay.steps.map((step) => step.action), ["platform", "platform", "platform", "call", "none"]);
});

test("drops the retired supervisor-DM step when migrating v1 conflict workflows", () => {
  const migrated = migrateLegacySettings({
    conflictSteps: [
      "Request cover in the app.",
      "Direct-message the shift supervisor and explain the conflict.",
      "Wait for approval.",
    ],
  });
  assert.deepEqual(migrated.flows[1].steps.map((step) => step.text), ["Request cover in the app.", "Wait for approval."]);
});

test("parseStoredSettings handles v1, v2, and invalid payloads", () => {
  const legacy = parseStoredSettings(JSON.stringify({ organization: "Legacy Org", emergencySteps: ["Call in."] }));
  assert.equal(legacy.organization, "Legacy Org");
  assert.equal(legacy.flows[0].steps[0].text, "Call in.");

  const v2 = parseStoredSettings(JSON.stringify(defaults));
  assert.equal(v2.flows.length, 3);
  assert.equal(v2.flows[0].steps[0].action, "call");

  assert.equal(parseStoredSettings("not json"), null);
  assert.equal(parseStoredSettings("42"), null);
});

test("normalizeSettings repairs malformed flows and steps", () => {
  const normalized = normalizeSettings({
    flows: [{ label: "Only flow", accent: "purple", steps: [{ text: "Do something", action: "teleport" }, "garbage"] }],
  });
  assert.equal(normalized.flows.length, 1);
  assert.equal(normalized.flows[0].accent, "green");
  assert.ok(normalized.flows[0].id);
  assert.equal(normalized.flows[0].steps.length, 2);
  assert.equal(normalized.flows[0].steps[0].action, "none");
  assert.equal(normalized.flows[0].steps[1].text, "");
});

test("profile files round-trip and v1 exports still import", () => {
  const roundTripped = settingsFromProfileFile(JSON.stringify(profileFileFor(defaults)));
  assert.equal(roundTripped.flows.length, 3);
  assert.equal(roundTripped.flows[2].steps[3].action, "call");

  const legacyProfile = settingsFromProfileFile(
    JSON.stringify({
      type: "cant-make-my-shift-business-profile",
      version: 1,
      settings: { organization: "Old Export", emergencySteps: ["Call the front desk."] },
    }),
  );
  assert.equal(legacyProfile.organization, "Old Export");
  assert.equal(legacyProfile.flows[0].steps[0].action, "call");

  assert.throws(() => settingsFromProfileFile(JSON.stringify({ type: "something-else", settings: {} })));
  assert.throws(() => settingsFromProfileFile("not json"));
});
