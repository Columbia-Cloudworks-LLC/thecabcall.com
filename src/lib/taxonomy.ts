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
    moralLens: "Time allocation, prioritization, and resource stewardship",
    moralDefinition:
      "An instrument used by operative masons to measure and lay out their work; symbolically dividing the twenty-four hours of the day into structured allocations for duty, service, and refreshment so that finite human attention is never squandered on the trivial.",
    sreEquivalent: "Capacity planning, toil reduction, & error budgets",
    sreDefinition:
      "Quantifying finite engineering and institutional bandwidth. When an organization spends 90% of its cycles fighting reactive interrupts instead of retiring systemic risk, its error budget is exhausted before the primary incident even begins.",
    diagnosticQuestionPattern:
      "Where was attention spent versus where the real systemic risk lived?",
    jevClassifierCriteria:
      "Assign highest probability when the core tension involves misallocated finite resources, neglected capacity planning, reactive firefighting over structural stewardship, or exhausting attention budgets on low-impact theater.",
    pairedFailureMode: "Alert Fatigue & Signal Loss",
    engravingCaption: "Fig. I — The Twenty-Four Inch Divided Rule (Copperplate Plate IV)",
  },
  {
    id: "Common Gavel",
    shortName: "Common Gavel",
    numeral: "II",
    moralLens: "Stripping away vices, superfluities, and ego",
    moralDefinition:
      "Used by operative masons to break off the rough and superfluous corners of stones, the better to fit them for the builder's use; morally divesting the mind and conscience of partisan vanity, defensive posture, and emotional reactivity.",
    sreEquivalent: "Blameless post-mortems, root-cause isolation, & scope pruning",
    sreDefinition:
      "Separating human operator error from underlying architectural defects. Removing defensive PR narratives, political scapegoating, and superfluous complexity so the raw causal chain of an outage can be inspected without distortion.",
    diagnosticQuestionPattern:
      "What emotional noise or political theater needs to be chipped away to see the raw failure?",
    jevClassifierCriteria:
      "Assign highest probability when the event centers on scapegoating an individual operator, defensive PR spin obscuring a technical or policy failure, scope creep, or emotional punditry masking a straightforward root cause.",
    pairedFailureMode: "Blame Culture vs. Root-Cause Isolation",
    engravingCaption: "Fig. II — The Operative Stone-Hammer or Setting Maul (Plate V)",
  },
  {
    id: "The Plumb",
    shortName: "The Plumb",
    numeral: "III",
    moralLens: "Upright conduct and integrity under pressure",
    moralDefinition:
      "An instrument used to try perpendiculars; demonstrating whether a wall rises true to gravity or leans dangerously toward collapse under unseen load. It demands unyielding uprightness when commercial or political incentives urge a quiet compromise.",
    sreEquivalent: "Adherence to SLAs/SLOs, compliance rigor, & operational honesty",
    sreDefinition:
      "Refusing to falsify telemetry, silence a failing health check, or lower safety thresholds just to ship on schedule. Maintaining vertical alignment with stated reliability standards when executive or market pressure peaks.",
    diagnosticQuestionPattern:
      "Did the actors hold the line when incentives pushed them to cut corners?",
    jevClassifierCriteria:
      "Assign highest probability when actors faced pressure to bypass safety gates, suppress inconvenient telemetry, dilute regulatory or engineering standards, or prioritize short-term optics over vertical integrity.",
    pairedFailureMode: "Single Point of Failure (SPOF) / Untested Failover",
    engravingCaption: "Fig. III — The Arch-Plumb & Perpendicular Line (Plate VII)",
  },
  {
    id: "The Square",
    shortName: "The Square",
    numeral: "IV",
    moralLens: "Morality, fair dealing, and squaring actions with stated values",
    moralDefinition:
      "A right-angled instrument of ninety degrees used to test whether dressed ashlar stones will join without gap or fracture. It measures whether an institution's actual conduct in the field forms a true right angle with its chartered promises.",
    sreEquivalent: "Spec vs. production reality, configuration drift, & auditability",
    sreDefinition:
      "Continuous verification that the live production environment matches the declarative specification. Detecting silent, unmonitored divergence between written policy/contracts and how the system actually executes under load.",
    diagnosticQuestionPattern:
      "How far did actual execution drift from the stated policy or social contract?",
    jevClassifierCriteria:
      "Assign highest probability when there is measurable divergence between an institution's stated charter/contract/spec and its actual production execution, undocumented workarounds, or broken public covenants.",
    pairedFailureMode: "Configuration Drift",
    engravingCaption: "Fig. IV — The Master's Right-Angled Try-Square (Plate VIII)",
  },
  {
    id: "The Level",
    shortName: "The Level",
    numeral: "V",
    moralLens: "Equality, shared mortality, and accountability across hierarchies",
    moralDefinition:
      "An instrument used to lay horizontals and prove that all surfaces rest upon an equal plane. It reminds leadership and citizenry alike that hierarchy confers stewardship, not immunity from the laws of consequence.",
    sreEquivalent: "Shared on-call burden, democratization of data, & flat incident command",
    sreDefinition:
      "Ensuring that those who architect and approve high-risk systems carry the pager when those systems fail. Preventing asymmetric risk where executives capture the upside of velocity while externalizing outage costs onto end users or frontline staff.",
    diagnosticQuestionPattern:
      "Are the people who designed the fragile system bearing the same cost as the end users?",
    jevClassifierCriteria:
      "Assign highest probability when a failure exposes asymmetric accountability—where system architects, executives, or regulators are insulated from the downstream consequences borne by citizens, operators, or customers.",
    pairedFailureMode: "Technical & Institutional Debt",
    engravingCaption: "Fig. V — The Horizontal Spirit & Plumb Level (Plate IX)",
  },
  {
    id: "The Trowel",
    shortName: "The Trowel",
    numeral: "VI",
    moralLens: "Spreading the cement of affection and uniting disparate parts",
    moralDefinition:
      "Used by operative masons to spread the mortar which unites an entire edifice into one common mass of stone; representing the institutional trust, transparent protocols, and mutual goodwill that prevent independent components from shearing apart under stress.",
    sreEquivalent: "Cross-team incident response, API contracts, & institutional trust",
    sreDefinition:
      "Maintaining well-defined interface contracts, clear handoff protocols, and high-trust communication channels across organizational silos so a localized fault does not cascade across boundaries.",
    diagnosticQuestionPattern:
      "What connective tissue broke down between silos, and what binds the recovery together?",
    jevClassifierCriteria:
      "Assign highest probability when an incident stems from fractured communication between agencies or teams, broken interface contracts, siloed telemetry, or the erosion of public and inter-institutional trust.",
    pairedFailureMode: "Cascading Failure",
    engravingCaption: "Fig. VI — The Operative Mason's Finishing Trowel (Plate XI)",
  },
];

export const SRE_FAILURE_MODES: SreFailureModeSpec[] = [
  {
    id: "Configuration Drift",
    shortCode: "CFG-DRIFT",
    severity: "warning",
    summary:
      "Slow, unmonitored divergence between how a system is supposed to work and how it actually runs in production.",
    systemsDefinition:
      "Occurs when ad-hoc hotfixes, manual overrides, and undocumented exceptions accumulate over time without reconciliation against the canonical specification.",
    civicManifestation:
      "Agencies, corporations, or courts operating under informal norms that quietly contradict statutory language or public charters until an audit or crisis exposes the gap.",
    defaultPairedTool: "The Square",
  },
  {
    id: "Cascading Failure",
    shortCode: "CASCADE-01",
    severity: "critical",
    summary:
      "A localized failure knocking out downstream dependencies due to tight coupling or lack of circuit breakers.",
    systemsDefinition:
      "When one degraded node overwhelms adjacent services via retry storms, shared resource exhaustion, or missing bulkhead isolation.",
    civicManifestation:
      "A regional supply-chain disruption, liquidity shock, or inter-agency communication breakdown propagating rapidly across sectors that lacked independent buffers.",
    defaultPairedTool: "The Trowel",
  },
  {
    id: "Alert Fatigue & Signal Loss",
    shortCode: "SIG-LOSS",
    severity: "warning",
    summary:
      "Drowning in low-priority noise until a critical structural warning is ignored.",
    systemsDefinition:
      "When poorly tuned thresholds flood operators with thousands of non-actionable pages, conditioning teams to mute or ignore the telemetry stream right before a genuine catastrophe.",
    civicManifestation:
      "24-hour outrage cycles and sensationalist media jitter consuming public attention while high-consequence structural warnings sit unexamined in public filings.",
    defaultPairedTool: "24-Inch Gauge",
  },
  {
    id: "Single Point of Failure (SPOF) / Untested Failover",
    shortCode: "SPOF-FAIL",
    severity: "critical",
    summary:
      "Relying on one fragile bottleneck or assuming a backup plan works without ever running a game-day drill.",
    systemsDefinition:
      "Architectural dependence on a single component, vendor, or human gatekeeper, paired with nominal redundancy that has never been validated under realistic production load.",
    civicManifestation:
      "Critical public infrastructure, grid interconnects, or statutory oversight mechanisms that exist on paper but fail immediately when called upon during an active stress event.",
    defaultPairedTool: "The Plumb",
  },
  {
    id: "Blame Culture vs. Root-Cause Isolation",
    shortCode: "BLAME-ISO",
    severity: "warning",
    summary:
      "Punishing the operator who pressed the button instead of fixing the flawed system that allowed the error.",
    systemsDefinition:
      "Treating human error as the conclusion of an investigation rather than the starting point. Firing the last person to touch the keyboard guarantees the next operator will hit the exact same trap.",
    civicManifestation:
      "Public hearings and corporate press releases that sacrifice a frontline official to appease headlines while leaving defective incentives and guardrails untouched.",
    defaultPairedTool: "Common Gavel",
  },
  {
    id: "Technical & Institutional Debt",
    shortCode: "INST-DEBT",
    severity: "critical",
    summary:
      "Deferring necessary maintenance for short-term velocity until the interest payments cause an outage.",
    systemsDefinition:
      "Trading long-term resilience for immediate feature delivery or cost reduction, accumulating fragile legacy dependencies until routine operations become hazardous.",
    civicManifestation:
      "Decades of deferred physical infrastructure upkeep, underfunded oversight, or kicked fiscal cans compounding into acute systemic instability.",
    defaultPairedTool: "The Level",
  },
];

export const DOMAIN_SECTORS: DomainSectorId[] = [
  "Public Policy & Governance",
  "Infrastructure & Supply Chain",
  "Technology & Cyber",
  "Economics & Markets",
  "Institutional Leadership",
];

export const STRUCTURAL_FRICTION_FALLBACK_SPEC: SreFailureModeSpec = {
  id: "Structural Friction",
  shortCode: "",
  severity: "warning",
  summary:
    "Underlying operational or institutional strain where formal design and field execution pull against one another.",
  systemsDefinition:
    "Occurs when unmapped dependencies, informal workarounds, or competing operational pressures introduce friction across system boundaries.",
  civicManifestation:
    "Public institutions, infrastructure operators, or governing bodies experiencing structural strain awaiting full inspection.",
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
  "cascading failure": "Cascading Failure",
  cascading_failure: "Cascading Failure",
  "cascade-01": "Cascading Failure",
  "alert fatigue & signal loss": "Alert Fatigue & Signal Loss",
  "alert fatigue": "Alert Fatigue & Signal Loss",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  "sig-loss": "Alert Fatigue & Signal Loss",
  "single point of failure (spof) / untested failover":
    "Single Point of Failure (SPOF) / Untested Failover",
  "single point of failure":
    "Single Point of Failure (SPOF) / Untested Failover",
  "untested failover": "Single Point of Failure (SPOF) / Untested Failover",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  "spof-fail": "Single Point of Failure (SPOF) / Untested Failover",
  "blame culture vs. root-cause isolation":
    "Blame Culture vs. Root-Cause Isolation",
  "blame culture": "Blame Culture vs. Root-Cause Isolation",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  "blame-iso": "Blame Culture vs. Root-Cause Isolation",
  "technical & institutional debt": "Technical & Institutional Debt",
  "institutional debt": "Technical & Institutional Debt",
  capacity_exhaustion: "Technical & Institutional Debt",
  "inst-debt": "Technical & Institutional Debt",
  "structural friction": "Structural Friction",
  structural_friction: "Structural Friction",
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

export function getWorkingToolSpec(id: string | null | undefined): WorkingToolSpec {
  const mapped = mapWorkingToolToCraftLexicon(id);
  return (
    WORKING_TOOLS.find((t) => t.id === mapped) || WORKING_TOOLS[3] // Default to The Square
  );
}

export function getSreFailureModeSpec(
  id: string | null | undefined
): SreFailureModeSpec {
  const mapped = mapFailureModeToCraftLexicon(id);
  return (
    SRE_FAILURE_MODES.find((f) => f.id === mapped) ||
    STRUCTURAL_FRICTION_FALLBACK_SPEC
  );
}

