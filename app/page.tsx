"use client";

import { useEffect, useMemo, useState } from "react";

type Route = "home" | "reason" | "emergency-info" | "workflow" | "complete" | "settings";
type FlowId = "emergency" | "conflict" | "same-day";

type Settings = {
  organization: string;
  phone: string;
  homebaseUrl: string;
  emergencyDefinition: string;
  emergencyExamples: string[];
  nonEmergencyExamples: string[];
  emergencySteps: string[];
  conflictSteps: string[];
  sameDaySteps: string[];
};

const defaults: Settings = {
  organization: "Excel Aquatics",
  phone: "518-250-9363",
  homebaseUrl: "https://app.joinhomebase.com/",
  emergencyDefinition:
    "An emergency is a sudden, serious, and unexpected situation that makes it unsafe, unreasonable, or impossible for you to work your scheduled shift or complete the normal coverage process.",
  emergencyExamples: [
    "Sudden illness that prevents you from safely working",
    "Serious injury or medical emergency",
    "Family emergency requiring immediate attention",
    "Car accident",
    "An unexpected situation involving immediate safety or urgent care",
  ],
  nonEmergencyExamples: [
    "Forgetting the shift or making other plans",
    "Transportation issues that could reasonably be addressed",
    "Homework, studying, or a social event",
    "A routine appointment",
    "Wanting additional time off or failing to request it in advance",
  ],
  emergencySteps: [
    "Call the main line and leave a voicemail explaining that you cannot make your shift.",
    "Direct-message the supervisor assigned to your shift in Homebase.",
    "Post a general message in the Homebase staff chat.",
  ],
  conflictSteps: [
    "Open the shift coverage feature in Homebase.",
    "Offer or release the shift using the appropriate Homebase feature.",
    "Direct-message eligible staff members to request coverage.",
    "Direct-message the shift supervisor and explain the conflict.",
    "Wait for confirmation that coverage has been approved.",
  ],
  sameDaySteps: [
    "Use the Homebase shift coverage feature.",
    "Direct-message available staff members and request coverage.",
    "Direct-message the shift supervisor.",
    "Call the main line and leave a voicemail explaining the unusual circumstances.",
    "Wait for leadership to respond or assist.",
  ],
};

const flowCopy = {
  emergency: {
    eyebrow: "Illness or emergency",
    intro: "Follow every step below. Do not include a diagnosis or medical details.",
    warning: "This app does not submit your absence. You must complete each step by phone and in Homebase.",
    done: "You have completed the required emergency or illness call-out directions.",
  },
  conflict: {
    eyebrow: "Other scheduling conflict",
    intro: "For non-emergency conflicts, you are responsible for attempting to find coverage. Telling a manager does not automatically remove your responsibility for the shift.",
    warning: "Your shift remains your responsibility until coverage is confirmed or leadership tells you otherwise.",
    done: "You have reviewed the required coverage directions.",
  },
  "same-day": {
    eyebrow: "Unusual same-day conflict",
    intro: "Use this only for a serious, unexpected same-day situation that does not meet the emergency definition. You must still attempt to find coverage.",
    warning: "An unusual conflict is not automatically an emergency. You must still make a reasonable effort to find coverage.",
    done: "You have reviewed the unusual same-day conflict directions.",
  },
};

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

type BusinessProfileFile = {
  type: "cant-make-my-shift-business-profile";
  version: 1;
  settings: Settings;
};

export default function Home() {
  const [route, setRoute] = useState<Route>("home");
  const [flow, setFlow] = useState<FlowId | null>(null);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [draft, setDraft] = useState<Settings>(defaults);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("cant-make-my-shift-settings");
    if (!stored) return;
    try {
      const parsed = { ...defaults, ...JSON.parse(stored) };
      setSettings(parsed);
      setDraft(parsed);
    } catch {}
  }, []);

  const steps = useMemo(() => {
    if (flow === "emergency") return settings.emergencySteps;
    if (flow === "conflict") return settings.conflictSteps;
    if (flow === "same-day") return settings.sameDaySteps;
    return [];
  }, [flow, settings]);

  function restart() {
    setRoute("home");
    setFlow(null);
    setStep(0);
    setChecked([]);
  }

  function begin(nextFlow: FlowId) {
    setFlow(nextFlow);
    setStep(0);
    setChecked([]);
    setRoute(nextFlow === "emergency" ? "emergency-info" : "workflow");
  }

  function goBack() {
    if (route === "reason" || route === "settings") return restart();
    if (route === "emergency-info") return setRoute("reason");
    if (route === "complete") return setRoute("workflow");
    if (route === "workflow" && step > 0) return setStep(step - 1);
    setRoute(flow === "emergency" ? "emergency-info" : "reason");
  }

  function saveSettings() {
    setSettings(draft);
    window.localStorage.setItem("cant-make-my-shift-settings", JSON.stringify(draft));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function exportProfile() {
    const profile: BusinessProfileFile = { type: "cant-make-my-shift-business-profile", version: 1, settings: draft };
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.organization.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business"}-callout-profile.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importProfile(file?: File) {
    if (!file) return;
    try {
      const profile = JSON.parse(await file.text()) as Partial<BusinessProfileFile>;
      if (profile.type !== "cant-make-my-shift-business-profile" || !profile.settings) throw new Error("Invalid profile");
      const next = { ...defaults, ...profile.settings };
      setDraft(next);
      setSettings(next);
      window.localStorage.setItem("cant-make-my-shift-settings", JSON.stringify(next));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch {
      window.alert("That file is not a valid Can’t Make My Shift business profile.");
    }
  }

  const progress = route === "workflow" && steps.length ? Math.round(((step + 1) / steps.length) * 100) : 0;
  const isCallStep = flow === "emergency" ? step === 0 : flow === "same-day" ? step === 3 : false;
  const isHomebaseStep = route === "workflow" && !isCallStep && (flow !== "same-day" || step < 3);

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
            <h1>Can’t make<br />your shift?</h1>
            <p className="lede">Get the right instructions in two quick steps. This app does not report your absence for you.</p>
            <button className="primary hero-button" onClick={() => setRoute("reason")}>
              I Can’t Make My Shift <span aria-hidden="true">→</span>
            </button>
            <div className="boundary-note">
              <strong>This is an instruction tool.</strong>
              <span>It does not replace Homebase, contact coworkers, or approve an absence.</span>
            </div>
            <button className="settings-link" onClick={() => setRoute("settings")}>Business profile & leadership settings</button>
          </section>
        )}

        {route === "reason" && (
          <section className="screen">
            <button className="back-link" onClick={goBack}>← Back</button>
            <p className="step-label">Step 1 of 2</p>
            <h1>Why can’t you make your shift?</h1>
            <p className="subtle">Choose the option that best fits. Leadership reviews the circumstances.</p>
            <div className="choice-stack">
              <button className="choice" onClick={() => begin("emergency")}><span className="choice-icon red">+</span><span><strong>Illness or emergency</strong><small>Sudden illness, injury, urgent care, or immediate safety</small></span><b>→</b></button>
              <button className="choice" onClick={() => begin("conflict")}><span className="choice-icon blue">↔</span><span><strong>Other scheduling conflict</strong><small>A non-emergency conflict where you need coverage</small></span><b>→</b></button>
              <button className="choice" onClick={() => begin("same-day")}><span className="choice-icon amber">!</span><span><strong>Unusual same-day conflict</strong><small>Serious and unexpected, but not an emergency</small></span><b>→</b></button>
            </div>
          </section>
        )}

        {route === "emergency-info" && (
          <section className="screen">
            <button className="back-link" onClick={goBack}>← Back</button>
            <p className="step-label">Before you begin</p>
            <h1>What counts as an emergency?</h1>
            <div className="definition">{settings.emergencyDefinition}</div>
            <div className="example-grid">
              <div><h2><span className="dot good" /> May be an emergency</h2><ul>{settings.emergencyExamples.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h2><span className="dot no" /> Generally not an emergency</h2><ul>{settings.nonEmergencyExamples.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
            <div className="notice"><strong>Leadership will review the circumstances.</strong> Selecting “emergency” does not automatically excuse the absence.</div>
            <button className="primary" onClick={() => setRoute("workflow")}>I understand — show me the steps</button>
          </section>
        )}

        {route === "workflow" && flow && (
          <section className="screen workflow-screen">
            <button className="back-link" onClick={goBack}>← Back</button>
            <div className="progress-row"><span>{flowCopy[flow].eyebrow}</span><b>{step + 1} of {steps.length}</b></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <p className="workflow-intro">{flowCopy[flow].intro}</p>
            {flow === "same-day" && step === 0 && <div className="example-callout"><strong>Example</strong>Your full-time employer unexpectedly requires you to work, and missing it may threaten your primary employment.</div>}
            <div className="step-number">{String(step + 1).padStart(2, "0")}</div>
            <h1>{steps[step]}</h1>
            {isCallStep && <p className="instruction">Call <strong>{settings.phone}</strong>. Leave a voicemail explaining the situation. Do not include medical details.</p>}
            {isHomebaseStep && <p className="instruction">Complete this action in Homebase before continuing.</p>}
            <div className="action-row">
              {isCallStep && <a className="action-button call" href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>☎ Call Now</a>}
              {isHomebaseStep && <a className="action-button homebase" href={settings.homebaseUrl} target="_blank" rel="noreferrer">Open Homebase ↗</a>}
            </div>
            <label className="confirmation">
              <input type="checkbox" checked={!!checked[step]} onChange={(event) => setChecked((current) => { const next = [...current]; next[step] = event.target.checked; return next; })} />
              <span><strong>I completed this step</strong><small>Only check this after you have done it.</small></span>
            </label>
            <div className="warning-bar">{flowCopy[flow].warning}</div>
            <button className="primary" disabled={!checked[step]} onClick={() => step === steps.length - 1 ? setRoute("complete") : setStep(step + 1)}>{step === steps.length - 1 ? "Finish" : "Next step"} →</button>
          </section>
        )}

        {route === "complete" && flow && (
          <section className="screen complete-screen">
            <div className="complete-mark">✓</div>
            <p className="step-label">Directions complete</p>
            <h1>{flowCopy[flow].done}</h1>
            <p className="lede">This app did not submit an absence or notify anyone for you.</p>
            <div className="checklist"><h2>Your confirmation</h2>{steps.map((item) => <div key={item}><span>✓</span>{item}</div>)}</div>
            <div className="notice"><strong>Remember:</strong> You are responsible for completing every action and following leadership’s response.</div>
            <button className="primary" onClick={restart}>Return to start</button>
          </section>
        )}

        {route === "settings" && (
          <section className="screen settings-screen">
            <button className="back-link" onClick={goBack}>← Employee view</button>
            <p className="step-label">Business profile</p>
            <h1>Make the directions yours.</h1>
            <p className="subtle">Customize one active organization profile for this prototype. Export it to reuse the same directions on another device or deployment—no employee accounts required.</p>
            <div className="profile-summary"><span className="brand-mark" aria-hidden="true">{draft.organization.charAt(0) || "B"}</span><span><strong>{draft.organization || "New business"}</strong><small>Active business profile</small></span></div>
            <div className="form-grid">
              <label>Organization name<input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} /></label>
              <label>Main phone number<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></label>
              <label className="wide">Homebase link<input value={draft.homebaseUrl} onChange={(e) => setDraft({ ...draft, homebaseUrl: e.target.value })} /></label>
              <label className="wide">Emergency definition<textarea value={draft.emergencyDefinition} onChange={(e) => setDraft({ ...draft, emergencyDefinition: e.target.value })} /></label>
              <label>Emergency examples <small>One per line</small><textarea value={draft.emergencyExamples.join("\n")} onChange={(e) => setDraft({ ...draft, emergencyExamples: splitLines(e.target.value) })} /></label>
              <label>Non-emergency examples <small>One per line</small><textarea value={draft.nonEmergencyExamples.join("\n")} onChange={(e) => setDraft({ ...draft, nonEmergencyExamples: splitLines(e.target.value) })} /></label>
              <label className="wide">Emergency workflow <small>One step per line</small><textarea value={draft.emergencySteps.join("\n")} onChange={(e) => setDraft({ ...draft, emergencySteps: splitLines(e.target.value) })} /></label>
              <label className="wide">Other conflict workflow <small>One step per line</small><textarea value={draft.conflictSteps.join("\n")} onChange={(e) => setDraft({ ...draft, conflictSteps: splitLines(e.target.value) })} /></label>
              <label className="wide">Same-day workflow <small>One step per line</small><textarea value={draft.sameDaySteps.join("\n")} onChange={(e) => setDraft({ ...draft, sameDaySteps: splitLines(e.target.value) })} /></label>
            </div>
            <button className="primary" onClick={saveSettings}>{saved ? "Saved ✓" : "Save settings"}</button>
            <div className="profile-actions">
              <button className="secondary" onClick={exportProfile}>Export business profile</button>
              <label className="secondary import-button">Import business profile<input type="file" accept="application/json,.json" onChange={(event) => importProfile(event.target.files?.[0])} /></label>
            </div>
            <button className="secondary" onClick={() => { setDraft(defaults); setSettings(defaults); window.localStorage.removeItem("cant-make-my-shift-settings"); }}>Restore Excel Aquatics defaults</button>
          </section>
        )}
      </div>
    </main>
  );
}
