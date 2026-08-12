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
import { decideSuperAdmin, normalizePublishableKey, parseSuperAdminEmails } from "../app/superadmin.ts";

test("step instructions stay headline-length, with detail carried by notes", () => {
  for (const flow of defaults.flows) {
    for (const step of flow.steps) {
      assert.ok(
        step.text.length <= 140,
        `step "${step.text.slice(0, 40)}…" in ${flow.label} is ${step.text.length} chars; move detail into its note`,
      );
    }
  }
  assert.match(defaults.flows[1].steps[3].note, /direct-message the Program Director/);
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
  assert.equal(conflict.steps[1].text, "Wait for confirmation that coverage has been approved.");
  assert.match(conflict.steps[1].note, /direct-message the Program Director/);

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

test("resets v1 conflict steps when the retired offer-or-release step is present", () => {
  const migrated = migrateLegacySettings({
    conflictSteps: ["Anything", "Offer or release the shift using the appropriate Homebase feature.", "Whatever"],
  });
  assert.deepEqual(
    migrated.flows[1].steps.map((step) => step.text),
    defaults.flows[1].steps.map((step) => step.text),
  );
});

test("detects the offer-or-release sentinel on the raw array, before non-string filtering", () => {
  const migrated = migrateLegacySettings({
    conflictSteps: [null, "Offer or release the shift using the appropriate Homebase feature.", "Custom"],
  });
  assert.deepEqual(
    migrated.flows[1].steps.map((step) => step.text),
    defaults.flows[1].steps.map((step) => step.text),
  );
});

test("call steps carry the medical-privacy note in defaults and migrated profiles", () => {
  assert.match(defaults.flows[2].steps[3].note, /diagnosis or medical details/);
  const migrated = migrateLegacySettings({
    sameDaySteps: ["A", "B", "C", "Call the line.", "Wait."],
  });
  assert.match(migrated.flows[2].steps[3].note, /diagnosis or medical details/);
  assert.match(migrated.flows[0].steps[0].note, /diagnosis or medical details/);
});

test("a cleared flow icon round-trips instead of reverting to the bullet", () => {
  const cleared = { ...defaults, flows: defaults.flows.map((flow, i) => (i === 0 ? { ...flow, icon: "" } : flow)) };
  assert.equal(normalizeSettings(cleared).flows[0].icon, "");
});

test("corrupted v2 payloads are repaired as v2, not misread as v1", () => {
  const parsed = parseStoredSettings(JSON.stringify({ organization: "V2 Org", homeHeadline: "Custom headline", flows: null }));
  assert.equal(parsed.organization, "V2 Org");
  assert.equal(parsed.homeHeadline, "Custom headline");
  assert.equal(parsed.flows.length, 3);
});

test("duplicate ids from imported files are regenerated", () => {
  const normalized = normalizeSettings({
    flows: [
      { id: "dup", label: "A", steps: [{ id: "s", text: "x", action: "none", note: "" }] },
      { id: "dup", label: "B", steps: [{ id: "s", text: "y", action: "none", note: "" }] },
    ],
  });
  const ids = [normalized.flows[0].id, normalized.flows[1].id, normalized.flows[0].steps[0].id, normalized.flows[1].steps[0].id];
  assert.equal(new Set(ids).size, 4);
});

test("a cleared platform name is preserved rather than reverting to Homebase", () => {
  const normalized = normalizeSettings({ ...defaults, platformName: "" });
  assert.equal(normalized.platformName, "");
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

test("super-admin access fails closed when no allowlist is configured", () => {
  for (const setting of [undefined, null, "", "   ", ",,", 42]) {
    const decision = decideSuperAdmin("kevin@goswimexcel.com", setting);
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "not_configured");
  }
});

test("super-admin match ignores case and surrounding whitespace", () => {
  const setting = "  Kevin@GoSwimExcel.com  ";
  assert.deepEqual(decideSuperAdmin("kevin@goswimexcel.com", setting), {
    allowed: true,
    email: "kevin@goswimexcel.com",
  });
  assert.deepEqual(decideSuperAdmin("  KEVIN@goswimexcel.COM ", setting), {
    allowed: true,
    email: "kevin@goswimexcel.com",
  });
});

test("super-admin rejects any account outside the allowlist", () => {
  const setting = "kevin@goswimexcel.com";
  for (const email of ["someone@goswimexcel.com", "kevin@example.com", "", null, undefined, "kevin@goswimexcel.com.evil.com"]) {
    const decision = decideSuperAdmin(email, setting);
    assert.equal(decision.allowed, false, `expected ${String(email)} to be rejected`);
    assert.equal(decision.reason, "not_authorized");
  }
});

test("SUPER_ADMIN_EMAIL accepts a comma-separated list", () => {
  const setting = "kevin@goswimexcel.com, ops@goswimexcel.com";
  assert.deepEqual(parseSuperAdminEmails(setting), ["kevin@goswimexcel.com", "ops@goswimexcel.com"]);
  assert.equal(decideSuperAdmin("ops@goswimexcel.com", setting).allowed, true);
  assert.equal(decideSuperAdmin("other@goswimexcel.com", setting).allowed, false);
});

test("publishable keys are validated by shape, not length", () => {
  assert.equal(normalizePublishableKey("  pk_live_Y2xlcmsuZXhhbXBsZS5jb20k  "), "pk_live_Y2xlcmsuZXhhbXBsZS5jb20k");
  assert.equal(normalizePublishableKey("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"), "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k");
  for (const bad of ["", "   ", "pk_live_", "sk_live_Y2xlcmsuZXhhbXBsZQ", "not-a-key", undefined, null, 7]) {
    assert.equal(normalizePublishableKey(bad), undefined, `expected ${String(bad)} to be rejected`);
  }
});

test("the staff QR encodes modules in scannable orientation", async () => {
  const { qrPath } = await import("../app/qr.ts");
  const qrcode = (await import("qrcode-generator")).default;

  const url = "https://cantmakemyshift.example.com";
  const { path, moduleCount } = qrPath(url);

  // Rebuild the expected coordinate set independently: x is the column, y is
  // the row. A transposed path still renders a plausible-looking QR that no
  // phone can read, so orientation is asserted rather than eyeballed.
  const reference = qrcode(0, "M");
  reference.addData(url);
  reference.make();
  assert.equal(reference.getModuleCount(), moduleCount);

  const drawn = new Set(path.match(/M\d+ \d+/g));
  let expected = 0;
  for (let row = 0; row < moduleCount; row++) {
    for (let column = 0; column < moduleCount; column++) {
      if (!reference.isDark(row, column)) continue;
      expected += 1;
      assert.ok(drawn.has(`M${column} ${row}`), `missing dark module at row ${row}, column ${column}`);
    }
  }
  assert.equal(drawn.size, expected);

  // The top-left finder pattern is a solid 7x7 square; its presence in the
  // right corner proves the grid was not flipped.
  for (let i = 0; i < 7; i++) {
    assert.ok(drawn.has(`M${i} 0`), `finder pattern break at column ${i}`);
    assert.ok(drawn.has(`M0 ${i}`), `finder pattern break at row ${i}`);
  }
});
