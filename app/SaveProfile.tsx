"use client";

import { useState } from "react";
import { useAdminSession } from "./AdminGate";
import type { Settings } from "./settings";

type SaveState = { kind: "idle" | "saving" | "shared" | "local"; message?: string };

/**
 * Saves the business profile.
 *
 * The point of saving is that every staff phone sees the change, so this writes
 * to the shared profile and only reports success when the server confirms it.
 * When there is no database it still saves on this device, and says so — the
 * difference matters too much to blur into a single "Saved" tick.
 */
export default function SaveProfile({
  draft,
  onSavedLocally,
}: {
  draft: Settings;
  onSavedLocally: (settings: Settings) => void;
}) {
  const session = useAdminSession();
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  async function save() {
    setState({ kind: "saving" });

    // No session should be impossible here (this only renders inside the gate),
    // but a local save is better than losing the edit.
    if (!session) {
      onSavedLocally(draft);
      setState({ kind: "local", message: "Saved on this device. Sign in again to share it with staff." });
      return;
    }

    try {
      const response = await session.authedFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: draft }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        saved?: boolean;
        reason?: string;
        message?: string;
      };

      if (response.ok && data.saved) {
        onSavedLocally(draft);
        setState({ kind: "shared" });
        window.setTimeout(() => setState({ kind: "idle" }), 2600);
        return;
      }

      if (data.reason === "no_database") {
        onSavedLocally(draft);
        setState({
          kind: "local",
          message: "Saved on this device only — no shared database is configured, so staff phones will not see this.",
        });
        return;
      }

      setState({ kind: "idle", message: data.message || "The profile could not be saved." });
    } catch {
      setState({ kind: "idle", message: "Could not reach the server, so nothing was saved." });
    }
  }

  return (
    <>
      <button className="primary" disabled={state.kind === "saving"} onClick={save}>
        {state.kind === "saving" ? "Saving…" : state.kind === "shared" ? "Saved for everyone ✓" : "Save settings"}
      </button>
      {state.message && (
        <div className={`notice gate-notice${state.kind === "local" ? "" : " save-error"}`}>
          <span>{state.message}</span>
        </div>
      )}
    </>
  );
}
