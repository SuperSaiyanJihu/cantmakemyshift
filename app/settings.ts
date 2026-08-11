export type StepAction = "none" | "call" | "platform";

export type FlowStep = {
  id: string;
  text: string;
  action: StepAction;
  note: string;
};

export const FLOW_ACCENTS = ["red", "blue", "amber", "green"] as const;
export type FlowAccent = (typeof FLOW_ACCENTS)[number];

export type Flow = {
  id: string;
  label: string;
  description: string;
  icon: string;
  accent: FlowAccent;
  intro: string;
  warning: string;
  done: string;
  showEmergencyInfo: boolean;
  steps: FlowStep[];
};

export type Settings = {
  organization: string;
  phone: string;
  platformName: string;
  platformUrl: string;
  homeHeadline: string;
  homeLede: string;
  boundaryTitle: string;
  boundaryBody: string;
  reasonTitle: string;
  reasonSubtitle: string;
  emergencyInfoTitle: string;
  emergencyDefinition: string;
  emergencyExamples: string[];
  nonEmergencyExamples: string[];
  emergencyNotice: string;
  completeLede: string;
  completeReminder: string;
  flows: Flow[];
};

export const STORAGE_KEY = "cant-make-my-shift-settings";
export const PROFILE_FILE_TYPE = "cant-make-my-shift-business-profile";

export type BusinessProfileFile = {
  type: typeof PROFILE_FILE_TYPE;
  version: number;
  settings: Settings;
};

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function makeStep(partial?: Partial<Omit<FlowStep, "id">>): FlowStep {
  return { id: newId(), text: "", action: "none", note: "", ...partial };
}

export function makeFlow(partial?: Partial<Omit<Flow, "id">>): Flow {
  return {
    id: newId(),
    label: "New workflow",
    description: "Describe when an employee should choose this option.",
    icon: "•",
    accent: "green",
    intro: "Follow every step below.",
    warning: "Your shift remains your responsibility until leadership tells you otherwise.",
    done: "You have reviewed the required directions.",
    showEmergencyInfo: false,
    steps: [makeStep({ text: "Describe the first required action." })],
    ...partial,
  };
}

export const defaults: Settings = {
  organization: "Excel Aquatics",
  phone: "518-250-9363",
  platformName: "Homebase",
  platformUrl: "https://app.joinhomebase.com/",
  homeHeadline: "Can’t make\nyour shift?",
  homeLede: "Get the right instructions in two quick steps. This app does not report your absence for you.",
  boundaryTitle: "This is an instruction tool.",
  boundaryBody: "It does not replace Homebase, contact coworkers, or approve an absence.",
  reasonTitle: "Why can’t you make your shift?",
  reasonSubtitle: "Choose the option that best fits. Leadership reviews the circumstances.",
  emergencyInfoTitle: "What counts as an emergency?",
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
  emergencyNotice: "Leadership will review the circumstances. Selecting “emergency” does not automatically excuse the absence.",
  completeLede: "This app did not submit an absence or notify anyone for you.",
  completeReminder: "You are responsible for completing every action and following leadership’s response.",
  flows: [
    {
      id: "emergency",
      label: "Illness or emergency",
      description: "Sudden illness, injury, urgent care, or immediate safety",
      icon: "+",
      accent: "red",
      intro: "Follow every step below. Do not include a diagnosis or medical details.",
      warning: "This app does not submit your absence. You must complete each step by phone and in Homebase.",
      done: "You have completed the required emergency or illness call-out directions.",
      showEmergencyInfo: true,
      steps: [
        {
          id: "emergency-1",
          text: "Call the main line and leave a voicemail explaining that you cannot make your shift.",
          action: "call",
          note: "Do not include a diagnosis or medical details.",
        },
        {
          id: "emergency-2",
          text: "Direct-message the supervisor assigned to your shift in Homebase.",
          action: "platform",
          note: "",
        },
        {
          id: "emergency-3",
          text: "Post a general message in the Homebase staff chat.",
          action: "platform",
          note: "",
        },
      ],
    },
    {
      id: "conflict",
      label: "Other scheduling conflict",
      description: "A non-emergency conflict where you need coverage",
      icon: "↔",
      accent: "blue",
      intro:
        "For non-emergency conflicts, you are responsible for attempting to find coverage. Telling a manager does not automatically remove your responsibility for the shift.",
      warning: "Your shift remains your responsibility until coverage is confirmed or leadership tells you otherwise.",
      done: "You have reviewed the required coverage directions.",
      showEmergencyInfo: false,
      steps: [
        {
          id: "conflict-1",
          text: "Open Homebase, tap Schedule, and select My Shifts Only.",
          action: "platform",
          note: "",
        },
        {
          id: "conflict-2",
          text: "Find your shift, tap Find Cover, then Request Cover. Choose all eligible teammates or specific eligible teammates, and tap Submit.",
          action: "platform",
          note: "",
        },
        {
          id: "conflict-3",
          text: "Direct-message eligible staff members to request coverage.",
          action: "platform",
          note: "",
        },
        {
          id: "conflict-4",
          text: "Wait for confirmation that coverage has been approved. If coverage is not found by 7 days before the shift—or as soon as possible when the shift is less than 7 days away—direct-message the Program Director in Homebase. Explain the difficulty finding coverage, list everyone you contacted, and identify who responded.",
          action: "platform",
          note: "",
        },
      ],
    },
    {
      id: "same-day",
      label: "Unusual same-day conflict",
      description: "Serious and unexpected, but not an emergency",
      icon: "!",
      accent: "amber",
      intro:
        "Use this only for a serious, unexpected same-day situation that does not meet the emergency definition. You must still attempt to find coverage.",
      warning: "An unusual conflict is not automatically an emergency. You must still make a reasonable effort to find coverage.",
      done: "You have reviewed the unusual same-day conflict directions.",
      showEmergencyInfo: false,
      steps: [
        {
          id: "same-day-1",
          text: "Use the Homebase shift coverage feature.",
          action: "platform",
          note: "Example: Your full-time employer unexpectedly requires you to work, and missing it may threaten your primary employment.",
        },
        {
          id: "same-day-2",
          text: "Direct-message available staff members and request coverage.",
          action: "platform",
          note: "",
        },
        {
          id: "same-day-3",
          text: "Direct-message the shift supervisor.",
          action: "platform",
          note: "",
        },
        {
          id: "same-day-4",
          text: "Call the main line and leave a voicemail explaining the unusual circumstances.",
          action: "call",
          note: "",
        },
        {
          id: "same-day-5",
          text: "Wait for leadership to respond or assist.",
          action: "none",
          note: "",
        },
      ],
    },
  ],
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeStep(raw: unknown): FlowStep {
  const step = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const action = step.action === "call" || step.action === "platform" || step.action === "none" ? step.action : "none";
  return {
    id: asString(step.id, "") || newId(),
    text: asString(step.text, ""),
    action,
    note: asString(step.note, ""),
  };
}

function normalizeFlow(raw: unknown): Flow {
  const flow = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const accent = FLOW_ACCENTS.includes(flow.accent as FlowAccent) ? (flow.accent as FlowAccent) : "green";
  return {
    id: asString(flow.id, "") || newId(),
    label: asString(flow.label, "Untitled workflow"),
    description: asString(flow.description, ""),
    icon: asString(flow.icon, "•") || "•",
    accent,
    intro: asString(flow.intro, ""),
    warning: asString(flow.warning, ""),
    done: asString(flow.done, "You have reviewed the required directions."),
    showEmergencyInfo: flow.showEmergencyInfo === true,
    steps: Array.isArray(flow.steps) ? flow.steps.map(normalizeStep) : [],
  };
}

export function normalizeSettings(raw: unknown): Settings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    organization: asString(value.organization, defaults.organization),
    phone: asString(value.phone, defaults.phone),
    platformName: asString(value.platformName, defaults.platformName) || defaults.platformName,
    platformUrl: asString(value.platformUrl, defaults.platformUrl),
    homeHeadline: asString(value.homeHeadline, defaults.homeHeadline),
    homeLede: asString(value.homeLede, defaults.homeLede),
    boundaryTitle: asString(value.boundaryTitle, defaults.boundaryTitle),
    boundaryBody: asString(value.boundaryBody, defaults.boundaryBody),
    reasonTitle: asString(value.reasonTitle, defaults.reasonTitle),
    reasonSubtitle: asString(value.reasonSubtitle, defaults.reasonSubtitle),
    emergencyInfoTitle: asString(value.emergencyInfoTitle, defaults.emergencyInfoTitle),
    emergencyDefinition: asString(value.emergencyDefinition, defaults.emergencyDefinition),
    emergencyExamples: asStringArray(value.emergencyExamples, defaults.emergencyExamples),
    nonEmergencyExamples: asStringArray(value.nonEmergencyExamples, defaults.nonEmergencyExamples),
    emergencyNotice: asString(value.emergencyNotice, defaults.emergencyNotice),
    completeLede: asString(value.completeLede, defaults.completeLede),
    completeReminder: asString(value.completeReminder, defaults.completeReminder),
    flows: Array.isArray(value.flows) ? value.flows.map(normalizeFlow) : defaults.flows.map((flow) => cloneFlow(flow)),
  };
}

export function cloneFlow(flow: Flow): Flow {
  return { ...flow, steps: flow.steps.map((step) => ({ ...step })) };
}

export function cloneSettings(settings: Settings): Settings {
  return {
    ...settings,
    emergencyExamples: [...settings.emergencyExamples],
    nonEmergencyExamples: [...settings.nonEmergencyExamples],
    flows: settings.flows.map(cloneFlow),
  };
}

// Shape stored by the previous version of the app (one steps array per fixed flow).
type LegacySettings = {
  organization?: unknown;
  phone?: unknown;
  homebaseUrl?: unknown;
  emergencyDefinition?: unknown;
  emergencyExamples?: unknown;
  nonEmergencyExamples?: unknown;
  emergencySteps?: unknown;
  conflictSteps?: unknown;
  sameDaySteps?: unknown;
};

const legacyConflictDefaults = defaults.flows[1].steps.map((step) => step.text);

function applyLegacyConflictPatches(steps: string[]): string[] {
  let patched = steps;
  if (patched[1] === "Offer or release the shift using the appropriate Homebase feature.") {
    patched = [...legacyConflictDefaults];
  }
  return patched
    .filter((item) => item !== "Direct-message the shift supervisor and explain the conflict.")
    .map((item) =>
      item === "Wait for confirmation that coverage has been approved."
        ? legacyConflictDefaults[legacyConflictDefaults.length - 1]
        : item,
    );
}

export function isLegacySettings(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return !Array.isArray((raw as Record<string, unknown>).flows);
}

// Converts a v1 profile into the v2 shape, attaching the same step actions the
// old app hardcoded by position (emergency: call then platform; same-day:
// platform ×3, call, then no action; conflict: platform throughout).
export function migrateLegacySettings(raw: unknown): Settings {
  const legacy = (raw && typeof raw === "object" ? raw : {}) as LegacySettings;
  const base = cloneSettings(defaults);

  base.organization = asString(legacy.organization, base.organization);
  base.phone = asString(legacy.phone, base.phone);
  base.platformUrl = asString(legacy.homebaseUrl, base.platformUrl);
  base.emergencyDefinition = asString(legacy.emergencyDefinition, base.emergencyDefinition);
  base.emergencyExamples = asStringArray(legacy.emergencyExamples, base.emergencyExamples);
  base.nonEmergencyExamples = asStringArray(legacy.nonEmergencyExamples, base.nonEmergencyExamples);

  const emergencySteps = asStringArray(legacy.emergencySteps, defaults.flows[0].steps.map((step) => step.text));
  const conflictSteps = applyLegacyConflictPatches(asStringArray(legacy.conflictSteps, legacyConflictDefaults));
  const sameDaySteps = asStringArray(legacy.sameDaySteps, defaults.flows[2].steps.map((step) => step.text));

  base.flows[0].steps = emergencySteps.map((text, index) =>
    makeStep({
      text,
      action: index === 0 ? "call" : "platform",
      note: index === 0 ? "Do not include a diagnosis or medical details." : "",
    }),
  );
  base.flows[1].steps = conflictSteps.map((text) => makeStep({ text, action: "platform" }));
  base.flows[2].steps = sameDaySteps.map((text, index) =>
    makeStep({
      text,
      action: index === 3 ? "call" : index < 3 ? "platform" : "none",
      note: index === 0 ? "Example: Your full-time employer unexpectedly requires you to work, and missing it may threaten your primary employment." : "",
    }),
  );

  return base;
}

export function parseStoredSettings(json: string): Settings | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== "object") return null;
    return isLegacySettings(raw) ? migrateLegacySettings(raw) : normalizeSettings(raw);
  } catch {
    return null;
  }
}

export function settingsFromProfileFile(text: string): Settings {
  const profile = JSON.parse(text) as Partial<BusinessProfileFile>;
  if (profile.type !== PROFILE_FILE_TYPE || !profile.settings || typeof profile.settings !== "object") {
    throw new Error("Invalid profile");
  }
  return isLegacySettings(profile.settings) ? migrateLegacySettings(profile.settings) : normalizeSettings(profile.settings);
}

export function profileFileFor(settings: Settings): BusinessProfileFile {
  return { type: PROFILE_FILE_TYPE, version: 2, settings };
}
