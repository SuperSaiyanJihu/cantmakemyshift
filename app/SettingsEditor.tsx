"use client";

import { useState } from "react";
import { FLOW_ACCENTS, Flow, FlowAccent, FlowStep, Settings, StepAction, makeFlow, makeStep } from "./settings";

const accentLabels: Record<FlowAccent, string> = { red: "Red", blue: "Blue", amber: "Amber", green: "Green" };
const actionLabels: Record<StepAction, string> = {
  none: "No action button",
  call: "Call button (main phone number)",
  platform: "Open scheduling platform button",
};

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

// The textarea keeps the raw text (including trailing newlines and spaces the
// user is mid-typing) while pushing the cleaned list up on every change; the
// parent remounts the editor when the draft is replaced from outside.
function LinesField({ label, hint, initial, onChange }: { label: string; hint: string; initial: string[]; onChange: (next: string[]) => void }) {
  const [raw, setRaw] = useState(() => initial.join("\n"));
  return (
    <label>{label} <small>{hint}</small>
      <textarea value={raw} onChange={(e) => { setRaw(e.target.value); onChange(splitLines(e.target.value)); }} />
    </label>
  );
}

type Props = {
  draft: Settings;
  onChange: (next: Settings) => void;
};

export default function SettingsEditor({ draft, onChange }: Props) {
  const update = (patch: Partial<Settings>) => onChange({ ...draft, ...patch });
  const updateFlow = (flowId: string, patch: Partial<Flow>) =>
    update({ flows: draft.flows.map((flow) => (flow.id === flowId ? { ...flow, ...patch } : flow)) });
  const updateStep = (flow: Flow, stepId: string, patch: Partial<FlowStep>) =>
    updateFlow(flow.id, { steps: flow.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)) });

  return (
    <>
      <h2 className="settings-heading">Business basics</h2>
      <div className="form-grid">
        <label>Organization name<input value={draft.organization} onChange={(e) => update({ organization: e.target.value })} /></label>
        <label>Main phone number<input value={draft.phone} onChange={(e) => update({ phone: e.target.value })} /></label>
        <label>Scheduling platform name <small>Shown on step action buttons, e.g. “Homebase”</small><input value={draft.platformName} onChange={(e) => update({ platformName: e.target.value })} /></label>
        <label>Scheduling platform link<input value={draft.platformUrl} onChange={(e) => update({ platformUrl: e.target.value })} /></label>
        <label>Call step instruction <small>{"{phone}"} inserts the phone number</small><textarea className="compact" value={draft.callInstruction} onChange={(e) => update({ callInstruction: e.target.value })} /></label>
        <label>Platform step instruction <small>{"{platform}"} inserts the platform name</small><textarea className="compact" value={draft.platformInstruction} onChange={(e) => update({ platformInstruction: e.target.value })} /></label>
      </div>

      <h2 className="settings-heading">Home screen</h2>
      <div className="form-grid">
        <label className="wide">Headline <small>Line breaks are kept</small><textarea className="compact" value={draft.homeHeadline} onChange={(e) => update({ homeHeadline: e.target.value })} /></label>
        <label className="wide">Introduction<textarea className="compact" value={draft.homeLede} onChange={(e) => update({ homeLede: e.target.value })} /></label>
        <label>Boundary note title<input value={draft.boundaryTitle} onChange={(e) => update({ boundaryTitle: e.target.value })} /></label>
        <label>Boundary note text<textarea className="compact" value={draft.boundaryBody} onChange={(e) => update({ boundaryBody: e.target.value })} /></label>
      </div>

      <h2 className="settings-heading">Reason screen</h2>
      <div className="form-grid">
        <label>Title<input value={draft.reasonTitle} onChange={(e) => update({ reasonTitle: e.target.value })} /></label>
        <label>Subtitle<textarea className="compact" value={draft.reasonSubtitle} onChange={(e) => update({ reasonSubtitle: e.target.value })} /></label>
      </div>

      <h2 className="settings-heading">Emergency definition screen</h2>
      <div className="form-grid">
        <label className="wide">Title<input value={draft.emergencyInfoTitle} onChange={(e) => update({ emergencyInfoTitle: e.target.value })} /></label>
        <label className="wide">Emergency definition<textarea value={draft.emergencyDefinition} onChange={(e) => update({ emergencyDefinition: e.target.value })} /></label>
        <label>Examples column title<input value={draft.emergencyExamplesTitle} onChange={(e) => update({ emergencyExamplesTitle: e.target.value })} /></label>
        <label>Non-examples column title<input value={draft.nonEmergencyExamplesTitle} onChange={(e) => update({ nonEmergencyExamplesTitle: e.target.value })} /></label>
        <LinesField label="Emergency examples" hint="One per line" initial={draft.emergencyExamples} onChange={(next) => update({ emergencyExamples: next })} />
        <LinesField label="Non-emergency examples" hint="One per line" initial={draft.nonEmergencyExamples} onChange={(next) => update({ nonEmergencyExamples: next })} />
        <label className="wide">Review notice<textarea className="compact" value={draft.emergencyNotice} onChange={(e) => update({ emergencyNotice: e.target.value })} /></label>
      </div>

      <h2 className="settings-heading">Completion screen</h2>
      <div className="form-grid">
        <label>Reminder that nothing was submitted<textarea className="compact" value={draft.completeLede} onChange={(e) => update({ completeLede: e.target.value })} /></label>
        <label>Closing reminder<textarea className="compact" value={draft.completeReminder} onChange={(e) => update({ completeReminder: e.target.value })} /></label>
      </div>

      <h2 className="settings-heading">Workflows</h2>
      <p className="subtle">Each workflow is one option on the reason screen, with its own steps. Every step can show a call button, a scheduling-platform button, or no button.</p>
      {draft.flows.map((flow, flowIndex) => {
        const flowName = flow.label || "Untitled workflow";
        return (
          <div className="flow-card" key={flow.id}>
            <div className="flow-card-head">
              <span className="flow-title"><span className={`choice-icon small ${flow.accent}`} aria-hidden="true">{flow.icon || "•"}</span>{flowName}</span>
              <span className="mini-row">
                <button type="button" className="mini-button" aria-label={`Move the “${flowName}” workflow up`} disabled={flowIndex === 0} onClick={() => update({ flows: moveItem(draft.flows, flowIndex, -1) })}>↑</button>
                <button type="button" className="mini-button" aria-label={`Move the “${flowName}” workflow down`} disabled={flowIndex === draft.flows.length - 1} onClick={() => update({ flows: moveItem(draft.flows, flowIndex, 1) })}>↓</button>
                <button
                  type="button"
                  className="mini-button danger"
                  aria-label={`Remove the “${flowName}” workflow`}
                  onClick={() => {
                    if (window.confirm(`Remove the “${flowName}” workflow and its steps?`)) {
                      update({ flows: draft.flows.filter((item) => item.id !== flow.id) });
                    }
                  }}
                >Remove</button>
              </span>
            </div>
            <div className="form-grid tight">
              <label>Option title<input value={flow.label} onChange={(e) => updateFlow(flow.id, { label: e.target.value })} /></label>
              <label>Option subtitle<textarea className="compact" value={flow.description} onChange={(e) => updateFlow(flow.id, { description: e.target.value })} /></label>
              <label>Icon <small>1–2 characters</small><input maxLength={2} value={flow.icon} onChange={(e) => updateFlow(flow.id, { icon: e.target.value })} /></label>
              <label>Icon color<select value={flow.accent} onChange={(e) => updateFlow(flow.id, { accent: e.target.value as FlowAccent })}>{FLOW_ACCENTS.map((accent) => <option key={accent} value={accent}>{accentLabels[accent]}</option>)}</select></label>
              <label className="wide">Introduction shown above every step<textarea className="compact" value={flow.intro} onChange={(e) => updateFlow(flow.id, { intro: e.target.value })} /></label>
              <label className="wide">Warning shown below every step<textarea className="compact" value={flow.warning} onChange={(e) => updateFlow(flow.id, { warning: e.target.value })} /></label>
              <label className="wide">Completion message<textarea className="compact" value={flow.done} onChange={(e) => updateFlow(flow.id, { done: e.target.value })} /></label>
              <label className="check-row wide"><input type="checkbox" checked={flow.showEmergencyInfo} onChange={(e) => updateFlow(flow.id, { showEmergencyInfo: e.target.checked })} />Show the emergency definition screen before the steps</label>
            </div>
            {flow.steps.map((step, stepIndex) => (
              <div className="step-card" key={step.id}>
                <div className="step-card-head">
                  <span>Step {stepIndex + 1}</span>
                  <span className="mini-row">
                    <button type="button" className="mini-button" aria-label={`Move step ${stepIndex + 1} up in “${flowName}”`} disabled={stepIndex === 0} onClick={() => updateFlow(flow.id, { steps: moveItem(flow.steps, stepIndex, -1) })}>↑</button>
                    <button type="button" className="mini-button" aria-label={`Move step ${stepIndex + 1} down in “${flowName}”`} disabled={stepIndex === flow.steps.length - 1} onClick={() => updateFlow(flow.id, { steps: moveItem(flow.steps, stepIndex, 1) })}>↓</button>
                    <button
                      type="button"
                      className="mini-button danger"
                      aria-label={`Remove step ${stepIndex + 1} of “${flowName}”`}
                      onClick={() => {
                        if (window.confirm(`Remove step ${stepIndex + 1} of “${flowName}”?`)) {
                          updateFlow(flow.id, { steps: flow.steps.filter((item) => item.id !== step.id) });
                        }
                      }}
                    >Remove</button>
                  </span>
                </div>
                <div className="form-grid tight">
                  <label className="wide">Step instruction<textarea className="compact" value={step.text} onChange={(e) => updateStep(flow, step.id, { text: e.target.value })} /></label>
                  <label>Action button<select value={step.action} onChange={(e) => updateStep(flow, step.id, { action: e.target.value as StepAction })}>{(Object.keys(actionLabels) as StepAction[]).map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}</select></label>
                  <label>Optional note shown with this step<textarea className="compact" value={step.note} onChange={(e) => updateStep(flow, step.id, { note: e.target.value })} /></label>
                </div>
              </div>
            ))}
            <button type="button" className="mini-button add-step" onClick={() => updateFlow(flow.id, { steps: [...flow.steps, makeStep({ text: "Describe the next required action." })] })}>+ Add step</button>
          </div>
        );
      })}
      <button type="button" className="secondary add-flow" onClick={() => update({ flows: [...draft.flows, makeFlow()] })}>+ Add workflow</button>
    </>
  );
}
