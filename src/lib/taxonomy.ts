export type WorkingToolId =
  | "24-Inch Gauge"
  | "Common Gavel"
  | "The Plumb"
  | "The Square"
  | "The Level"
  | "The Trowel";

export type SreFailureModeId =
  | "Configuration Drift"
  | "Cascading Failure"
  | "Alert Fatigue & Signal Loss"
  | "Single Point of Failure (SPOF) / Untested Failover"
  | "Blame Culture vs. Root-Cause Isolation"
  | "Technical & Institutional Debt"
  | "Structural Friction";

export const DEFAULT_CRAFT_WORKING_TOOL: WorkingToolId = "The Square";
export const DEFAULT_CRAFT_FAILURE_MODE: SreFailureModeId = "Structural Friction";
export const RAW_FAILURE_SHORT_CODES = [
  "CFG-DRIFT",
  "CASCADE-01",
  "SIG-LOSS",
  "SPOF-FAIL",
  "BLAME-ISO",
  "INST-DEBT",
] as const;

export type DomainSectorId =
  | "Public Policy & Governance"
  | "Infrastructure & Supply Chain"
  | "Technology & Cyber"
  | "Economics & Markets"
  | "Institutional Leadership";

export interface WorkingToolSpec {
  id: WorkingToolId;
  shortName: string;
  numeral: string;
  moralLens: string;
  moralDefinition: string;
  sreEquivalent: string;
  sreDefinition: string;
  diagnosticQuestionPattern: string;
  jevClassifierCriteria: string;
  pairedFailureMode: SreFailureModeId;
  engravingCaption: string;
}

export interface SreFailureModeSpec {
  id: SreFailureModeId;
  craftTitle: string;
  craftShortLabel: string;
  shortCode: string;
  severity: "nominal" | "warning" | "critical";
  summary: string;
  systemsDefinition: string;
  civicManifestation: string;
  defaultPairedTool: WorkingToolId;
}

export const WORKING_TOOLS: WorkingToolSpec[] = [
  {
    id: "24-Inch Gauge",
    shortName: "24-Inch Gauge",
    numeral: "I",
    moralLens: "Time allocation, prioritization, and wise stewardship of effort",
    moralDefinition:
      "An instrument used by operative masons to measure and lay out their work; symbolically dividing the twenty-four hours of the day into structured allocations for duty, service, and refreshment so that finite human attention is never squandered on the trivial.",
    sreEquivalent: "Budgeting crew hours, cutting busywork, & guarding reserves",
    sreDefinition:
      "Measuring a shop's finite time and attention. When an organization spends ninety percent of its day chasing noisy interruptions instead of fixing known hazards on the shop floor, its reserves are exhausted before the real emergency even begins.",
    diagnosticQuestionPattern:
      "Where did the crew spend its time and money compared to where the real hazard lived?",
    jevClassifierCriteria:
      "Assign highest probability when the core tension involves misallocated finite resources, neglected capacity planning, reactive firefighting over structural stewardship, or exhausting attention budgets on low-impact theater.",
    pairedFailureMode: "Alert Fatigue & Signal Loss",
    engravingCaption: "Fig. I — The Twenty-Four Inch Divided Rule (Copperplate Plate IV)",
  },
  {
    id: "Common Gavel",
    shortName: "Common Gavel",
    numeral: "II",
    moralLens: "Stripping away vanity, defensive spin, and rough edges",
    moralDefinition:
      "Used by operative masons to break off the rough and superfluous corners of stones, the better to fit them for the builder's use; morally divesting the mind and conscience of partisan vanity, defensive posture, and emotional reactivity.",
    sreEquivalent: "Honest shop-floor reviews, finding the real flaw, & trimming clutter",
    sreDefinition:
      "Separating an honest human slip-up from a flawed shop design. Chipping away defensive excuses, finger-pointing, and needless complexity so the true cause of a breakdown can be laid bare and fixed at the root.",
    diagnosticQuestionPattern:
      "What partisan spin or finger-pointing needs to be chipped away to see the actual flaw?",
    jevClassifierCriteria:
      "Assign highest probability when the event centers on scapegoating an individual operator, defensive PR spin obscuring a technical or policy failure, scope creep, or emotional punditry masking a straightforward root cause.",
    pairedFailureMode: "Blame Culture vs. Root-Cause Isolation",
    engravingCaption: "Fig. II — The Operative Stone-Hammer or Setting Maul (Plate V)",
  },
  {
    id: "The Plumb",
    shortName: "The Plumb",
    numeral: "III",
    moralLens: "Upright conduct and standing straight under pressure",
    moralDefinition:
      "An instrument used to try perpendiculars; demonstrating whether a wall rises true to gravity or leans dangerously toward collapse under unseen load. It demands unyielding uprightness when commercial or political incentives urge a quiet compromise.",
    sreEquivalent: "Holding the line on safety standards, honest reporting, & tested backups",
    sreDefinition:
      "Refusing to doctor the gauge readings, silence a warning bell, or lower safety margins just to meet a deadline. Standing straight by the building code when money or politics pushes for a quiet shortcut.",
    diagnosticQuestionPattern:
      "Did the builders hold the line on safety and honesty when pressure mounted to cut corners?",
    jevClassifierCriteria:
      "Assign highest probability when actors faced pressure to bypass safety gates, suppress inconvenient telemetry, dilute regulatory or engineering standards, or prioritize short-term optics over vertical integrity.",
    pairedFailureMode: "Single Point of Failure (SPOF) / Untested Failover",
    engravingCaption: "Fig. III — The Arch-Plumb & Perpendicular Line (Plate VII)",
  },
  {
    id: "The Square",
    shortName: "The Square",
    numeral: "IV",
    moralLens: "Fair dealing and squaring daily actions with written promises",
    moralDefinition:
      "A right-angled instrument of ninety degrees used to test whether dressed ashlar stones will join without gap or fracture. It measures whether an institution's actual conduct in the field forms a true right angle with its chartered promises.",
    sreEquivalent: "Matching field work to the blueprint, catching drift, & open books",
    sreDefinition:
      "Checking on the job site that the actual work matches the written blueprint and public promise. Catching the quiet, unmeasured drift between what an institution says on paper and what it actually does under load.",
    diagnosticQuestionPattern:
      "How far did day-to-day actions on the ground drift from the written rules and public promises?",
    jevClassifierCriteria:
      "Assign highest probability when there is measurable divergence between an institution's stated charter/contract/spec and its actual production execution, undocumented workarounds, or broken public covenants.",
    pairedFailureMode: "Configuration Drift",
    engravingCaption: "Fig. IV — The Master's Right-Angled Try-Square (Plate VIII)",
  },
  {
    id: "The Level",
    shortName: "The Level",
    numeral: "V",
    moralLens: "Shared footing, equal standards, and accountability across ranks",
    moralDefinition:
      "An instrument used to lay horizontals and prove that all surfaces rest upon an equal plane. It reminds leadership and citizenry alike that hierarchy confers stewardship, not immunity from the laws of consequence.",
    sreEquivalent: "Shared accountability, equal footing, & paying down deferred maintenance",
    sreDefinition:
      "Making sure the leaders who approve a risky shortcut stand on the same floor and bear the same cost when it gives way—rather than pocketing short-term savings while passing the hazard onto frontline workers and the public.",
    diagnosticQuestionPattern:
      "Are the decision-makers who approved the shortcut bearing the same risk as the people on the ground?",
    jevClassifierCriteria:
      "Assign highest probability when a failure exposes asymmetric accountability—where system architects, executives, or regulators are insulated from the downstream consequences borne by citizens, operators, or customers.",
    pairedFailureMode: "Technical & Institutional Debt",
    engravingCaption: "Fig. V — The Horizontal Spirit & Plumb Level (Plate IX)",
  },
  {
    id: "The Trowel",
    shortName: "The Trowel",
    numeral: "VI",
    moralLens: "Spreading the cement that binds separate crews into one work",
    moralDefinition:
      "Used by operative masons to spread the mortar which unites an entire edifice into one common mass of stone; representing the institutional trust, transparent protocols, and mutual goodwill that prevent independent components from shearing apart under stress.",
    sreEquivalent: "Clear handoffs between crews, solid joints, & mutual trust",
    sreDefinition:
      "Spreading strong mortar between separate work crews—through clear handoffs, honest communication, and well-built firebreaks—so a crack in one wall does not bring down the whole building.",
    diagnosticQuestionPattern:
      "Where did communication break down between separate crews, and what mortar will hold the repair together?",
    jevClassifierCriteria:
      "Assign highest probability when an incident stems from fractured communication between agencies or teams, broken interface contracts, siloed telemetry, or the erosion of public and inter-institutional trust.",
    pairedFailureMode: "Cascading Failure",
    engravingCaption: "Fig. VI — The Operative Mason's Finishing Trowel (Plate XI)",
  },
];

export const SRE_FAILURE_MODES: SreFailureModeSpec[] = [
  {
    id: "Configuration Drift",
    craftTitle: "Drifting Off-Square (Configuration Drift)",
    craftShortLabel: "Drifting Off-Square",
    shortCode: "CFG-DRIFT",
    severity: "warning",
    summary:
      "Drifting Off-Square (Configuration Drift): When day-to-day actions quietly wander away from the written rules without anyone calling a halt to re-measure.",
    systemsDefinition:
      "Happens when quick field workarounds, unrecorded favors, and temporary shortcuts pile up over time until the actual work on the shop floor no longer matches the blueprint.",
    civicManifestation:
      "Agencies, companies, or courts operating by unwritten backroom habits that quietly contradict their public rules until an inspection or breakdown exposes the gap.",
    defaultPairedTool: "The Square",
  },
  {
    id: "Cascading Failure",
    craftTitle: "Chain-Reaction Breakdown (Cascading Failure)",
    craftShortLabel: "Chain-Reaction Breakdown",
    shortCode: "CASCADE-01",
    severity: "critical",
    summary:
      "Chain-Reaction Breakdown (Cascading Failure): When one cracked timber or missed handoff overloads the next support in line because no firebreaks were built between them.",
    systemsDefinition:
      "When a single overloaded joint or stalled work crew throws its full weight onto neighboring supports without shutoff valves or firebreaks to contain the damage.",
    civicManifestation:
      "A local supply bottleneck, credit squeeze, or communication breakdown spreading rapidly across neighboring shops and towns that had no independent reserves.",
    defaultPairedTool: "The Trowel",
  },
  {
    id: "Alert Fatigue & Signal Loss",
    craftTitle: "Crying Wolf / Drowning in Noise (Alert Fatigue)",
    craftShortLabel: "Crying Wolf / Drowning in Noise",
    shortCode: "SIG-LOSS",
    severity: "warning",
    summary:
      "Crying Wolf / Drowning in Noise (Alert Fatigue): When a shop is flooded with so many false alarms and petty warnings that the crew stops listening right before a real hazard hits.",
    systemsDefinition:
      "When overly touchy bells ring all day over harmless vibrations, training workers to ignore or unplug the warning horn right before a genuine structural crack gives way.",
    civicManifestation:
      "Round-the-clock partisan shouting and sensational headlines exhausting public attention while serious, documented warnings sit unread in public records.",
    defaultPairedTool: "24-Inch Gauge",
  },
  {
    id: "Single Point of Failure (SPOF) / Untested Failover",
    craftTitle: "One Weak Link / Untested Backup (Single Point of Failure)",
    craftShortLabel: "One Weak Link / Untested Backup",
    shortCode: "SPOF-FAIL",
    severity: "critical",
    summary:
      "One Weak Link / Untested Backup (Single Point of Failure): Betting the whole structure on a single load-bearing pin—or trusting an emergency backup plan that has never been tested under real weight.",
    systemsDefinition:
      "Hanging an entire operation on a single supplier, bridge, or keyholder while relying on a spare generator or backup plan that has only ever existed on paper.",
    civicManifestation:
      "Critical public utilities, supply lines, or safety checks that look redundant on a chart but seize up the moment an emergency puts them under real load.",
    defaultPairedTool: "The Plumb",
  },
  {
    id: "Blame Culture vs. Root-Cause Isolation",
    craftTitle: "Scapegoating vs. Fixing the Trap (Blame Culture)",
    craftShortLabel: "Scapegoating vs. Fixing the Trap",
    shortCode: "BLAME-ISO",
    severity: "warning",
    summary:
      "Scapegoating vs. Fixing the Trap (Blame Culture): Firing the last worker who touched the lever instead of fixing the broken guardrails that set them up to fail.",
    systemsDefinition:
      "Treating a worker's slip-up as the end of the inquiry instead of the starting clue. Punishing the last person on shift guarantees the next worker will walk into the exact same trap.",
    civicManifestation:
      "Public hearings and press releases that sacrifice a low-level clerk to satisfy the crowd while leaving broken rules and bad incentives untouched.",
    defaultPairedTool: "Common Gavel",
  },
  {
    id: "Technical & Institutional Debt",
    craftTitle: "Deferred Maintenance (Institutional Debt)",
    craftShortLabel: "Deferred Maintenance",
    shortCode: "INST-DEBT",
    severity: "critical",
    summary:
      "Deferred Maintenance (Institutional Debt): Taking an easy shortcut today that weakens the foundation tomorrow, until the overdue repairs cost more than the original build.",
    systemsDefinition:
      "Putting off routine upkeep and patching worn timbers with baling wire to hit a short-term deadline, letting hidden rot spread until everyday work becomes unsafe.",
    civicManifestation:
      "Decades of skipped bridge repairs, hollowed-out oversight, and postponed bills piling up until a routine storm triggers a major collapse.",
    defaultPairedTool: "The Level",
  },
];

export const SHORT_FAILURE_LABELS: Record<SreFailureModeId, string> = {
  "Configuration Drift": "Drifting Off-Square",
  "Cascading Failure": "Chain-Reaction Breakdown",
  "Alert Fatigue & Signal Loss": "Crying Wolf / Drowning in Noise",
  "Single Point of Failure (SPOF) / Untested Failover":
    "One Weak Link / Untested Backup",
  "Blame Culture vs. Root-Cause Isolation": "Scapegoating vs. Fixing the Trap",
  "Technical & Institutional Debt": "Deferred Maintenance",
  "Structural Friction": "Structural Friction",
};

export const DOMAIN_SECTORS: DomainSectorId[] = [
  "Public Policy & Governance",
  "Infrastructure & Supply Chain",
  "Technology & Cyber",
  "Economics & Markets",
  "Institutional Leadership",
];

export const STRUCTURAL_FRICTION_FALLBACK_SPEC: SreFailureModeSpec = {
  id: "Structural Friction",
  craftTitle: "Structural Friction (Drifting Off-Square)",
  craftShortLabel: "Structural Friction",
  shortCode: "",
  severity: "warning",
  summary:
    "Drifting Off-Square (Structural Friction): When day-to-day actions quietly wander away from the written rules, creating strain across the work before a full inspection is called.",
  systemsDefinition:
    "Happens when unmapped handoffs, informal workarounds, or competing pressures cause different parts of a shop or institution to pull against one another.",
  civicManifestation:
    "Public institutions, utilities, or governing bodies experiencing operational strain between their stated mission and field reality.",
  defaultPairedTool: "The Square",
};

const WORKING_TOOL_ALIAS_MAP: Record<string, WorkingToolId> = {
  "24-inch gauge": "24-Inch Gauge",
  twenty_four_inch_gauge: "24-Inch Gauge",
  "common gavel": "Common Gavel",
  common_gavel: "Common Gavel",
  "the plumb": "The Plumb",
  plumb: "The Plumb",
  "the square": "The Square",
  square: "The Square",
  "the level": "The Level",
  level: "The Level",
  "the trowel": "The Trowel",
  trowel: "The Trowel",
};

const FAILURE_MODE_ALIAS_MAP: Record<string, SreFailureModeId> = {
  "configuration drift": "Configuration Drift",
  configuration_drift: "Configuration Drift",
  "cfg-drift": "Configuration Drift",
  "drifting off-square": "Configuration Drift",
  "drifting off-square (configuration drift)": "Configuration Drift",
  "cascading failure": "Cascading Failure",
  cascading_failure: "Cascading Failure",
  "cascade-01": "Cascading Failure",
  "chain-reaction breakdown": "Cascading Failure",
  "chain-reaction breakdown (cascading failure)": "Cascading Failure",
  "alert fatigue & signal loss": "Alert Fatigue & Signal Loss",
  "alert fatigue": "Alert Fatigue & Signal Loss",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  "sig-loss": "Alert Fatigue & Signal Loss",
  "crying wolf / drowning in noise": "Alert Fatigue & Signal Loss",
  "crying wolf": "Alert Fatigue & Signal Loss",
  "drowning in noise": "Alert Fatigue & Signal Loss",
  "crying wolf / drowning in noise (alert fatigue)":
    "Alert Fatigue & Signal Loss",
  "single point of failure (spof) / untested failover":
    "Single Point of Failure (SPOF) / Untested Failover",
  "single point of failure":
    "Single Point of Failure (SPOF) / Untested Failover",
  "untested failover": "Single Point of Failure (SPOF) / Untested Failover",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  "spof-fail": "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link / untested backup":
    "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link": "Single Point of Failure (SPOF) / Untested Failover",
  "untested backup": "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link / untested backup (single point of failure)":
    "Single Point of Failure (SPOF) / Untested Failover",
  "blame culture vs. root-cause isolation":
    "Blame Culture vs. Root-Cause Isolation",
  "blame culture": "Blame Culture vs. Root-Cause Isolation",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  "blame-iso": "Blame Culture vs. Root-Cause Isolation",
  "scapegoating vs. fixing the trap":
    "Blame Culture vs. Root-Cause Isolation",
  scapegoating: "Blame Culture vs. Root-Cause Isolation",
  "fixing the trap": "Blame Culture vs. Root-Cause Isolation",
  "scapegoating vs. fixing the trap (blame culture)":
    "Blame Culture vs. Root-Cause Isolation",
  "technical & institutional debt": "Technical & Institutional Debt",
  "institutional debt": "Technical & Institutional Debt",
  capacity_exhaustion: "Technical & Institutional Debt",
  "inst-debt": "Technical & Institutional Debt",
  "deferred maintenance": "Technical & Institutional Debt",
  "deferred maintenance (institutional debt)": "Technical & Institutional Debt",
  "structural friction": "Structural Friction",
  structural_friction: "Structural Friction",
  "structural friction (drifting off-square)": "Structural Friction",
};

export function stripRawFailureShortCodes(
  text: string | null | undefined
): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(
      /\s*(?:\(|\[)(?:CFG-DRIFT|CASCADE-01|SIG-LOSS|SPOF-FAIL|BLAME-ISO|INST-DEBT)(?:\)|\])/gi,
      ""
    )
    .replace(
      /\b(?:CFG-DRIFT|CASCADE-01|SIG-LOSS|SPOF-FAIL|BLAME-ISO|INST-DEBT)\b/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function mapWorkingToolToCraftLexicon(
  rawTool: string | null | undefined
): WorkingToolId {
  if (!rawTool || typeof rawTool !== "string") {
    return DEFAULT_CRAFT_WORKING_TOOL;
  }
  const normalized = stripRawFailureShortCodes(rawTool).toLowerCase();
  return WORKING_TOOL_ALIAS_MAP[normalized] || DEFAULT_CRAFT_WORKING_TOOL;
}

export function mapFailureModeToCraftLexicon(
  rawMode: string | null | undefined
): SreFailureModeId {
  if (!rawMode || typeof rawMode !== "string") {
    return DEFAULT_CRAFT_FAILURE_MODE;
  }
  const cleaned = stripRawFailureShortCodes(rawMode).toLowerCase();
  if (FAILURE_MODE_ALIAS_MAP[cleaned]) {
    return FAILURE_MODE_ALIAS_MAP[cleaned];
  }
  const rawLower = rawMode.trim().toLowerCase();
  return FAILURE_MODE_ALIAS_MAP[rawLower] || DEFAULT_CRAFT_FAILURE_MODE;
}

export function formatCraftLedgerEntry(
  rawCode: string | null | undefined
): string {
  if (!rawCode || typeof rawCode !== "string") {
    return "LEDGER ENTRY No. CAB-0000";
  }
  const stripped = rawCode
    .trim()
    .replace(/^(?:DISPATCH\s+FOLIO|INCIDENT\s+ID|LEDGER\s+ENTRY\s+No\.?)\s*:?\s*/i, "")
    .replace(/^#/, "")
    .trim();
  return `LEDGER ENTRY No. ${stripped || "CAB-0000"}`;
}

const GENERIC_SOURCE_PLACEHOLDERS = new Set([
  "source",
  "rss",
  "rss feed",
  "feed",
  "wire",
  "news",
  "dispatch",
  "unknown",
  "n/a",
  "none",
  "default",
  "live telemetry input",
  "custom admin dispatch",
  "dry-run sample",
  "the cab call",
]);

/**
 * Formats a feed identifier (e.g. "NYT > Top Stories", "NPR Top News", "PBS NewsHour Nation",
 * "WSJ US Business", "ARS TECHNICA", "REUTERS") into a concise, reader-friendly publication name
 * for action button labels ("Read Original {SourceName} Article"), safely defaulting to "Source"
 * when empty or generic.
 */
export function formatFriendlySourceName(
  sourceFeed: string | null | undefined
): string {
  if (!sourceFeed || typeof sourceFeed !== "string") {
    return "Source";
  }

  const trimmed = sourceFeed.trim();
  if (!trimmed || GENERIC_SOURCE_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return "Source";
  }

  if (/\b(?:nyt|new\s+york\s+times)\b/i.test(trimmed)) {
    return "NYT";
  }
  if (/\bnpr\b/i.test(trimmed)) {
    return "NPR";
  }
  if (/\b(?:wsj|wall\s+street\s+journal)\b/i.test(trimmed)) {
    return "WSJ";
  }
  if (/\bpbs\b/i.test(trimmed)) {
    return "PBS";
  }
  if (/\bars\s+technica\b/i.test(trimmed)) {
    return "Ars Technica";
  }
  if (/\breuters\b/i.test(trimmed)) {
    return "Reuters";
  }
  if (/\b(?:ap\s+news|associated\s+press)\b|^ap$/i.test(trimmed)) {
    return "AP";
  }
  if (/\bhacker\s+news\b/i.test(trimmed)) {
    return "Hacker News";
  }
  if (/\bfederal\s+register\b/i.test(trimmed)) {
    return "Federal Register";
  }
  if (/\bbloomberg\b/i.test(trimmed)) {
    return "Bloomberg";
  }
  if (/\bbbc\b/i.test(trimmed)) {
    return "BBC";
  }
  if (/\bwashington\s+post\b/i.test(trimmed)) {
    return "Washington Post";
  }
  if (/\bpropublica\b/i.test(trimmed)) {
    return "ProPublica";
  }

  const primarySegment = trimmed
    .split(/\s*(?:>|\||—|–|\s-\s)\s*/)[0]
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(?:top\s+stories|top\s+news|homepage|home\s+page|rss\s+feed|rss|feed|nation|us\s+business|world\s+news)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

  if (
    !primarySegment ||
    GENERIC_SOURCE_PLACEHOLDERS.has(primarySegment.toLowerCase())
  ) {
    return "Source";
  }

  if (
    primarySegment === primarySegment.toUpperCase() &&
    primarySegment.length > 4
  ) {
    return primarySegment
      .toLowerCase()
      .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  }

  return primarySegment;
}

export function getWorkingToolSpec(id: string | null | undefined): WorkingToolSpec {
  try {
    const mapped = mapWorkingToolToCraftLexicon(id);
    return (
      WORKING_TOOLS.find((t) => t.id === mapped) || WORKING_TOOLS[3] // Default to The Square
    );
  } catch {
    return WORKING_TOOLS[3];
  }
}

export function getSreFailureModeSpec(
  id: string | null | undefined
): SreFailureModeSpec {
  try {
    const mapped = mapFailureModeToCraftLexicon(id);
    return (
      SRE_FAILURE_MODES.find((f) => f.id === mapped) ||
      STRUCTURAL_FRICTION_FALLBACK_SPEC
    );
  } catch {
    return STRUCTURAL_FRICTION_FALLBACK_SPEC;
  }
}

