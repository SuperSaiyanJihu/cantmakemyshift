"use client";

import { useEffect, useMemo, useState } from "react";
import SettingsEditor from "./SettingsEditor";
import {
  Flow,
  STORAGE_KEY,
  Settings,
  cloneSettings,
  defaults,
  parseStoredSettings,
  profileFileFor,
  settingsFromProfileFile,
} from "./settings";

type Route = "home" | "reason" | "emergency-info" | "workflow" | "complete" | "settings";

// Renders an instruction template, substituting {phone} (bolded) and {platform}.
function renderInstruction(template: string, phone: string, platformName: string) {
  const platform = platformName || "your scheduling platform";
  return template.split(/(\{phone\}|\{platform\})/).map((part, index) => {
    if (part === "{phone}") return <strong key={index}>{phone}</strong>;
    if (part === "{platform}") return <span key={index}>{platform}</span>;
    return <span key={index}>{part}</span>;
  });
}

export default function Home() {
  const [route, setRoute] = useState<Route>("home");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [settings, setSettings] = useState<Settings>(() => cloneSettings(defaults));
  const [draft, setDraft] = useState<Settings>(() => cloneSettings(defaults));
  // Remounts the editor whenever the draft is replaced from outside the form
  // (initial load, import, restore, discard) so its field-local state resets.
  const [draftVersion, setDraftVersion] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = parseStoredSettings(stored);
    if (!parsed) return;
    // Stored profiles can only be read after hydration; a lazy initializer would mismatch the server-rendered defaults.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(parsed);
    setDraft(cloneSettings(parsed));
    setDraftVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    document.title = settings.organization ? `Can’t Make My Shift | ${settings.organization}` : "Can’t Make My Shift";
  }, [settings.organization]);

  const flow = useMemo(() => settings.flows.find((item) => item.id === flowId) ?? null, [settings, flowId]);
  const steps = flow?.steps ?? [];
  const current = route === "workflow" ? steps[step] : undefined;

  function restart() {
    setRoute("home");
    setFlowId(null);
    setStep(0);
    setChecked([]);
  }

  function enterSteps(nextFlow: Flow) {
    setRoute(nextFlow.steps.length ? "workflow" : "complete");
  }

  function begin(nextFlow: Flow) {
    setFlowId(nextFlow.id);
    setStep(0);
    setChecked([]);
    if (nextFlow.showEmergencyInfo) return setRoute("emergency-info");
    enterSteps(nextFlow);
  }

  function goBack() {
    if (route === "reason" || route === "settings") return restart();
    if (route === "emergency-info") return setRoute("reason");
    if (route === "complete") return steps.length ? setRoute("workflow") : restart();
    if (route === "workflow" && step > 0) return setStep(step - 1);
    setRoute(flow?.showEmergencyInfo ? "emergency-info" : "reason");
  }

  function persist(next: Settings) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      window.alert("Your changes are applied for this visit, but the browser refused to store them (storage may be full or blocked). They will not survive a reload.");
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function saveSettings() {
    setSettings(draft);
    persist(draft);
  }

  function discardDraft() {
    if (window.confirm("Discard your unsaved changes and go back to the last saved profile?")) {
      setDraft(cloneSettings(settings));
      setDraftVersion((version) => version + 1);
    }
  }

  function exportProfile() {
    const blob = new Blob([JSON.stringify(profileFileFor(draft), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business"}-callout-profile.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importProfile(file?: File) {
    if (!file) return;
    let next: Settings;
    try {
      next = settingsFromProfileFile(await file.text());
    } catch {
      window.alert("That file is not a valid Can’t Make My Shift business profile.");
      return;
    }
    setDraft(cloneSettings(next));
    setSettings(next);
    setDraftVersion((version) => version + 1);
    persist(next);
  }

  function restoreDefaults() {
    if (!window.confirm("Replace the current business profile with the Excel Aquatics defaults? This deletes your saved customizations.")) return;
    const next = cloneSettings(defaults);
    setDraft(next);
    setSettings(cloneSettings(defaults));
    setDraftVersion((version) => version + 1);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  const progress = route === "workflow" && steps.length ? Math.round(((step + 1) / steps.length) * 100) : 0;

  return (
    <main className="app-shell">
      <div className="app-card">
        <header className="topbar">
          <button className="brand" onClick={restart} aria-label="Restart workflow">
            <span className="brand-mark" aria-hidden="true">C</span>
            <span><strong>Can’t Make My Shift</strong><small>{settings.organization}</small></span>
          </button>
          {route !== "home" && <button className="text-button" onClick={restart}>Restart</button>}
        </header>

        {route === "home" && (
          <section className="screen home-screen">
            <div className="status-pill"><span /> Call-out directions</div>
            <h1 style={{ whiteSpace: "pre-line" }}>{settings.homeHeadline}</h1>
            <p className="lede">{settings.homeLede}</p>
            <button className="primary hero-button" onClick={() => setRoute("reason")}>
              I Can’t Make My Shift <span aria-hidden="true">→</span>
            </button>
            <div className="boundary-note">
              <strong>{settings.boundaryTitle}</strong>
              <span>{settings.boundaryBody}</span>
            </div>
            <button className="settings-link" onClick={() => setRoute("settings")}>Business profile & leadership settings</button>
          </section>
        )}

        {route === "reason" && (
          <section className="screen">
            <button className="back-link" onClick={goBack}>← Back</button>
            <p className="step-label">Step 1 of 2</p>
            <h1>{settings.reasonTitle}</h1>
            <p className="subtle">{settings.reasonSubtitle}</p>
            <div className="choice-stack">
              {settings.flows.map((item) => (
                <button className="choice" key={item.id} onClick={() => begin(item)}>
                  <span className={`choice-icon ${item.accent}`}>{item.icon || "•"}</span>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  <b>→</b>
                </button>
              ))}
              {settings.flows.length === 0 && (
                <div className="notice"><strong>No workflows are configured.</strong> Add one under Business profile & leadership settings.</div>
              )}
            </div>
          </section>
        )}

        {route === "emergency-info" && flow && (
          <section className="screen">
            <button className="back-link" onClick={goBack}>← Back</button>
            <p className="step-label">Before you begin</p>
            <h1>{settings.emergencyInfoTitle}</h1>
            <div className="definition">{settings.emergencyDefinition}</div>
            <div className="example-grid">
              <div><h2><span className="dot good" /> {settings.emergencyExamplesTitle}</h2><ul>{settings.emergencyExamples.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
              <div><h2><span className="dot no" /> {settings.nonEmergencyExamplesTitle}</h2><ul>{settings.nonEmergencyExamples.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
            </div>
            <div className="notice">{settings.emergencyNotice}</div>
            <button className="primary" onClick={() => enterSteps(flow)}>I understand — show me the steps</button>
          </section>
        )}

        {route === "workflow" && flow && current && (
          <section className="screen workflow-screen">
            <button className="back-link" onClick={goBack}>← Back</button>
            <div className="progress-row"><span>{flow.label}</span><b>{step + 1} of {steps.length}</b></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <p className="workflow-intro">{flow.intro}</p>
            <div className="step-number">{String(step + 1).padStart(2, "0")}</div>
            {/* Long instructions would otherwise fill the screen at display size. */}
            <h1 className={current.text.length > 140 ? "long-step" : undefined}>{current.text}</h1>
            {current.note && <div className="step-note">{current.note}</div>}
            {current.action === "call" && <p className="instruction">{renderInstruction(settings.callInstruction, settings.phone, settings.platformName)}</p>}
            {current.action === "platform" && <p className="instruction">{renderInstruction(settings.platformInstruction, settings.phone, settings.platformName)}</p>}
            <div className="action-row">
              {current.action === "call" && <a className="action-button call" href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>☎ Call Now</a>}
              {current.action === "platform" && <a className="action-button homebase" href={settings.platformUrl} target="_blank" rel="noreferrer">Open {settings.platformName || "scheduling platform"} ↗</a>}
            </div>
            <label className="confirmation">
              <input type="checkbox" checked={!!checked[step]} onChange={(event) => setChecked((state) => { const next = [...state]; next[step] = event.target.checked; return next; })} />
              <span><strong>I completed this step</strong><small>Only check this after you have done it.</small></span>
            </label>
            <div className="warning-bar">{flow.warning}</div>
            <button className="primary" disabled={!checked[step]} onClick={() => step === steps.length - 1 ? setRoute("complete") : setStep(step + 1)}>{step === steps.length - 1 ? "Finish" : "Next step"} →</button>
          </section>
        )}

        {route === "complete" && flow && (
          <section className="screen complete-screen">
            <div className="complete-mark">✓</div>
            <p className="step-label">Directions complete</p>
            <h1>{flow.done}</h1>
            <p className="lede">{settings.completeLede}</p>
            {steps.length > 0 && (
              <div className="checklist"><h2>Your confirmation</h2>{steps.map((item) => <div key={item.id}><span>✓</span>{item.text}</div>)}</div>
            )}
            <div className="notice"><strong>Remember:</strong> {settings.completeReminder}</div>
            <button className="primary" onClick={restart}>Return to start</button>
          </section>
        )}

        {route === "settings" && (
          <section className="screen settings-screen">
            <button className="back-link" onClick={goBack}>← Employee view</button>
            <p className="step-label">Business profile</p>
            <h1>Make the directions yours.</h1>
            <p className="subtle">Every screen, workflow, and step below is editable. Save to apply your changes on this device, or export the profile to reuse the same directions elsewhere—no employee accounts required.</p>
            <div className="profile-summary"><span className="brand-mark" aria-hidden="true">{draft.organization.charAt(0) || "B"}</span><span><strong>{draft.organization || "New business"}</strong><small>Editing this profile — save to apply</small></span></div>
            <SettingsEditor key={draftVersion} draft={draft} onChange={setDraft} />
            <button className="primary" onClick={saveSettings}>{saved ? "Saved ✓" : "Save settings"}</button>
            <button className="secondary" onClick={discardDraft}>Discard unsaved changes</button>
            <div className="profile-actions">
              <button className="secondary" onClick={exportProfile}>Export business profile</button>
              <label className="secondary import-button">Import business profile<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; importProfile(file); }} /></label>
            </div>
            <button className="secondary" onClick={restoreDefaults}>Restore Excel Aquatics defaults</button>
          </section>
        )}
      </div>
    </main>
  );
}
