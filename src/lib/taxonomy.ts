export type WorkingToolId =
  | "24-Inch Gauge"
  | "Common Gavel"
  | "The Plumb"
  | "The Square"
  | "The Level"
  | "The Trowel";

export type WorkingToolSlug =
  | "24-inch-gauge"
  | "common-gavel"
  | "the-plumb"
  | "the-square"
  | "the-level"
  | "the-trowel";

export type SreFailureModeId =
  | "Configuration Drift"
  | "Cascading Failure"
  | "Alert Fatigue & Signal Loss"
  | "Single Point of Failure (SPOF) / Untested Failover"
  | "Blame Culture vs. Root-Cause Isolation"
  | "Technical & Institutional Debt"
  | "Structural Friction";

export type SreFailureModeSlug =
  | "configuration-drift"
  | "cascading-failure"
  | "alert-fatigue"
  | "single-point-of-failure"
  | "blame-culture"
  | "institutional-debt";

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

export type DomainSectorSlug =
  | "public-policy-governance"
  | "infrastructure-supply-chain"
  | "technology-cyber"
  | "economics-markets"
  | "institutional-leadership";

export interface DomainSectorSpec {
  id: DomainSectorId;
  slug: DomainSectorSlug;
  shortLabel: string;
  description: string;
}

export interface WorkingToolSpec {
  id: WorkingToolId;
  slug: WorkingToolSlug;
  d1Key:
    | "twenty_four_inch_gauge"
    | "common_gavel"
    | "plumb"
    | "square"
    | "level"
    | "trowel";
  shortName: string;
  navLabel: string;
  navDescription: string;
  numeral: string;
  moralLens: string;
  moralDefinition: string;
  sreEquivalent: string;
  sreDefinition: string;
  diagnosticQuestionPattern: string;
  jevClassifierCriteria: string;
  pairedFailureMode: SreFailureModeId;
  engravingCaption: string;
  operativeOriginEssay: string[];
  moralCivicApplicationEssay: string[];
  systemsEngineeringEquivalentEssay: string[];
  operationalPractices: string[];
}

export interface SreFailureModeSpec {
  id: SreFailureModeId;
  slug: SreFailureModeSlug;
  d1Key:
    | "configuration_drift"
    | "cascading_failure"
    | "alert_fatigue"
    | "untested_failover"
    | "blameless_postmortem_gap"
    | "capacity_exhaustion";
  craftTitle: string;
  craftShortLabel: string;
  navLabel: string;
  navDescription: string;
  shortCode: string;
  severity: "nominal" | "warning" | "critical";
  summary: string;
  systemsDefinition: string;
  civicManifestation: string;
  defaultPairedTool: WorkingToolId;
  engravingCaption: string;
  shopFloorMechanicsEssay: string[];
  civicInstitutionalEssay: string[];
  earlyWarningSignals: string[];
}

export const WORKING_TOOLS: WorkingToolSpec[] = [
  {
    id: "24-Inch Gauge",
    slug: "24-inch-gauge",
    d1Key: "twenty_four_inch_gauge",
    shortName: "24-Inch Gauge",
    navLabel: "The 24-Inch Gauge",
    navDescription: "Budgeting crew hours, cutting busywork & guarding reserves",
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
    operativeOriginEssay: [
      "Before a single chisel touches rough limestone in the quarry, the master builder lays the divided rule against the face of the block. Without deliberate measurement ahead of labor, a mason can spend an entire shift dressing a stone that is two inches too narrow for the course where it must sit. On the medieval building site, raw exertion never substitutes for proportioned layout: work begun without the rule consumes timber, mortar, and daylight while producing rubble that must be hauled away.",
      "The divided rule establishes a strict boundary on finite capacity. Every quarry crew works against daylight, weather, and physical endurance. By marking off exact dimensions before striking the stone, the craft protects the crew from the twin hazards of over-cutting and frantic late-shift improvisation when the mortar is already stiffening in the trough.",
    ],
    moralCivicApplicationEssay: [
      "In civic and institutional stewardship, the divided rule governs the scarcest resource any community possesses: human attention. Public agencies, corporate boards, and newsrooms operate under a fixed twenty-four-hour horizon. When leadership surrenders that horizon to performative emergencies, partisan theater, or unprioritized mandates, the hours required for quiet inspection and structural upkeep are cannibalized first.",
      "Applying the rule to public affairs means auditing not what an institution claims to value in its speeches, but how its actual calendar and budget are partitioned. Where attention is squandered on visible busywork while foundational hazards go uninspected, the eventual collapse is not an unforeseen accident—it is an accounting certainty written months earlier in the ledger of misspent hours.",
    ],
    systemsEngineeringEquivalentEssay: [
      "Across high-reliability engineering shops and municipal operations, the divided rule translates directly into capacity budgeting, toil caps, and signal-to-noise hygiene. Every operational crew carries a finite cognitive load. If ninety percent of a watch stander's shift is consumed acknowledging repetitive, non-actionable alarms or manually patching recurring faults, zero engineering reserve remains to harden the underlying architecture.",
      "Disciplined shops enforce a hard ceiling on reactive toil and protect dedicated engineering hours for preventative remediation and capacity headroom. When an incident post-mortem reveals that an on-call team missed a critical warning bell, the inspection does not ask why the operator blinked; it measures how many hundreds of low-grade interruptions were permitted to flood the console before the real fault arrived.",
    ],
    operationalPractices: [
      "Enforce strict toil budgets so reactive firefighting never consumes the hours reserved for structural remediation.",
      "Prune noisy, non-actionable alerts before they train operators to ignore the console during a genuine emergency.",
      "Audit capital and staffing calendars against documented single points of failure rather than headline visibility.",
      "Maintain protected operational reserves (refreshment and recovery margin) so crews do not enter critical windows fatigued.",
    ],
  },
  {
    id: "Common Gavel",
    slug: "common-gavel",
    d1Key: "common_gavel",
    shortName: "Common Gavel",
    navLabel: "The Common Gavel",
    navDescription: "Honest shop-floor reviews & stripping away partisan spin",
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
    operativeOriginEssay: [
      "Stones hoisted fresh from the quarry bed arrive irregular, encrusted with shale, and bristling with jagged projections. No mason attempts to set such a rough ashlar directly into a load-bearing wall; the projecting spurs would concentrate the entire weight of the upper courses onto a single brittle point, fracturing the block under load. The setting maul is applied first at the dressing bench to strike away every superfluous projection until clean, bearing geometry emerges.",
      "Crucially, the operative mason strikes away the rough outer crust without shattering the core of the stone. The blow is directed at what does not belong—the brittle overhang, the false seam, the uneven lip—so that the sound heart of the block can sit flush against its neighbors.",
    ],
    moralCivicApplicationEssay: [
      "When a public utility, regulatory agency, or enterprise suffers a visible breakdown, the immediate reflex of modern institutions is to erect a façade of defensive spin—or to offer up a junior clerk as a public scapegoat. Both responses preserve institutional vanity while leaving the broken work untouched. Partisan commentary compounds the distortion by treating every operational fault as a morality play.",
      "The Gavel demands that we chip away both the public-relations varnish and the impulse to punish the last pair of hands on the lever. Only when defensive posture, self-justifying press releases, and tribal blame are struck off can an inspection board examine the naked geometry of the failure and repair the process that produced it.",
    ],
    systemsEngineeringEquivalentEssay: [
      "On the engineering shop floor, the Gavel is the instrument of blameless root-cause isolation and architectural simplification. When an operator executes a command that triggers an outage, firing the operator leaves the unguarded command path intact for the next technician on the Tuesday shift. A rigorous post-incident review separates human error—which is always a symptom—from the latent trap in the tooling, workflow, or incentive structure.",
      "Equally, the Gavel trims superfluous complexity from bloated systems. Unnecessary middleware, convoluted approval chains, and ornamental compliance checklists act like jagged spurs on a stone: they obscure where load actually travels and multiply the ways a routine change can jam.",
    ],
    operationalPractices: [
      "Conduct blameless post-incident reviews that treat operator mistakes as starting clues about flawed guardrails, never as the end of the inquiry.",
      "Strip defensive public-relations language and partisan framing from internal and public incident dispatches.",
      "Eliminate brittle, undocumented manual steps and superfluous approval layers that obscure operational state.",
      "Protect frontline workers who surface near-misses early so hazards are dressed at the bench rather than in collapse.",
    ],
  },
  {
    id: "The Plumb",
    slug: "the-plumb",
    d1Key: "plumb",
    shortName: "The Plumb",
    navLabel: "The Plumb",
    navDescription: "Holding the line on safety standards under pressure",
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
    operativeOriginEssay: [
      "A wall that leans half a degree off the perpendicular at its third course may appear perfectly upright to the naked eye from the scaffolding. Yet as successive courses of heavy ashlar are laid above it, that slight inclination shifts the center of thrust outside the middle third of the wall's base. Gravity cannot be negotiated with, lobbied, or deferred: either the courses rise true to the plumb line, or the rising weight of the building itself turns into the lever that topples it.",
      "The plumb rule is the simplest and most incorruptible instrument on the site—a weighted lead bob suspended freely from a cord inside a trued frame. It answers to earth's gravity alone, indifferent to the architect's schedule, the patron's budget, or the foreman's assurances.",
    ],
    moralCivicApplicationEssay: [
      "In institutional life, the Plumb tests vertical integrity when commercial, political, or schedule pressure urges a quiet compromise. Every major structural disaster in civic history is preceded by a moment where someone in authority was asked to look away from the plumb line—to certify an untested backup as ready, to waive an inconvenient safety gate before a launch window, or to soften an audit finding that threatened quarterly targets.",
      "Standing upright by the Plumb means holding the line on honest telemetry and non-negotiable safety margins when cutting a corner would be applauded by superiors. It insists that a backup system or public safeguard that exists only on paper is a falsehood against the craft.",
    ],
    systemsEngineeringEquivalentEssay: [
      "In systems engineering and critical infrastructure, the Plumb governs fault isolation, redundancy verification, and launch-readiness integrity. Many architectures boast redundant pathways on slide decks while quietly routing both primary and backup circuits through the same physical conduit, the same credentials store, or the same unverified failover script.",
      "Testing by the Plumb means subjecting failover mechanisms to real load before an emergency strikes, empowering any engineer on the floor to halt a deployment when safety invariants fail, and refusing to downgrade severity metrics to make reliability dashboards look green.",
    ],
    operationalPractices: [
      "Verify every emergency backup and failover path under realistic load rather than relying on paper certifications.",
      "Audit physical and logical dependencies to eliminate hidden single points of failure shared by primary and secondary systems.",
      "Empower frontline engineers and inspectors with stop-work authority when safety margins or acceptance tests fail.",
      "Keep reliability and audit reporting independent from commercial or political schedule pressures.",
    ],
  },
  {
    id: "The Square",
    slug: "the-square",
    d1Key: "square",
    shortName: "The Square",
    navLabel: "The Square",
    navDescription: "Squaring field work with the written blueprint & promises",
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
    operativeOriginEssay: [
      "Two stones may be finely polished on their outer faces, yet if their meeting beds are cut at eighty-eight degrees instead of ninety, they will never bond cleanly in the course. Moisture seeps into the wedge-shaped gap, frost expands the joint in winter, and the uneven bearing surface spalls the corner off the lower block. The Master's Try-Square is applied continuously to every face and bed to prove that the stone as cut matches the geometric covenant of the building.",
      "Even the steel try-square itself must be periodically tested against a master reference plate; an instrument dropped in the quarry or warped by heat will teach an entire crew of masons to cut crooked stones while believing their work is true.",
    ],
    moralCivicApplicationEssay: [
      "The Square is the primary diagnostic instrument for institutional candor and covenant keeping. Every public agency, court, bank, and corporation publishes a written charter—statutes, terms of service, fiduciary pledges, and safety rules. Over time, convenience and expedience tempt organizations to operate by unwritten backroom habits that diverge from those published rules.",
      "Testing an event by the Square asks a direct, measurable question: does the institution's daily conduct in the field form a true right angle with its written promises to the public? When an organization says one thing in its charter and practices another on the shop floor, the resulting fracture is a failure of the Square.",
    ],
    systemsEngineeringEquivalentEssay: [
      "In modern infrastructure and operations, the Square detects and arrests configuration drift. Production systems rarely fail because the original blueprint was malicious; they fail because months of ad-hoc hotfixes, manual console overrides, expired exceptions, and unrecorded workarounds cause the live environment to wander far from the declared specification.",
      "Squaring the work means enforcing continuous reconciliation between the written specification and live production state—and ensuring that when field conditions genuinely require a change, the blueprint itself is openly updated and reviewed rather than bypassed in the dark.",
    ],
    operationalPractices: [
      "Continuously reconcile live production state against the written specification so undocumented field workarounds cannot accumulate silently.",
      "Sunset temporary exceptions and emergency overrides on a strict expiration clock rather than letting them become permanent habits.",
      "Ensure public disclosures, service-level commitments, and regulatory filings accurately reflect actual shop-floor practices.",
      "Test the inspection instruments themselves so compliance audits measure real operational behavior rather than paper checkboxes.",
    ],
  },
  {
    id: "The Level",
    slug: "the-level",
    d1Key: "level",
    shortName: "The Level",
    navLabel: "The Level",
    navDescription: "Shared accountability & equal footing across ranks",
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
    operativeOriginEssay: [
      "For a stone wall to carry weight without shearing, every horizontal course must be laid upon a dead-level bed. If one end of a foundation trench settles or is laid two inches lower than the other, the entire superstructure tilts toward the weak corner, cracking lintels and jamming arches across the span. The operative A-frame level proves that every stone in the course rests upon the same horizontal plane of support.",
      "No carved frieze or gilded pinnacle at the top of the cathedral is exempt from the settlement of the lowest foundation course; the highest stone and the humblest plinth share the exact same gravity and the exact same ground.",
    ],
    moralCivicApplicationEssay: [
      "Applied to civic and corporate governance, the Level exposes asymmetric risk and insulated hierarchy. A recurring pathology of modern institutions is that executives, lawmakers, or financial engineers can approve deferred maintenance, hollow out safety reserves, and book immediate rewards on a tilted plane—where the upside stays upstairs while the downstream cost of collapse falls upon frontline workers, ratepayers, or taxpayers.",
      "The Level insists upon symmetry of consequence: those who hold the authority to defer upkeep or waive a rule must stand on the same floor and bear the same accountability when that debt comes due.",
    ],
    systemsEngineeringEquivalentEssay: [
      "In engineering organizations, the Level governs technical debt stewardship and shared operational ownership. When product or executive teams can force rapid, unhardened launches while throwing the resulting pager burden and maintenance debt over the wall to an under-resourced operations crew, the horizontal plane is broken.",
      "Leveling the shop floor means aligning incentives so that the teams and leaders who authorize architectural shortcuts share directly in the on-call burden, remediation budget, and post-incident accountability.",
    ],
    operationalPractices: [
      "Align governance incentives so decision-makers who authorize risk or defer maintenance share directly in the downstream operational cost.",
      "Make accumulated technical and infrastructure debt visible on the primary balance sheet alongside short-term output metrics.",
      "Apply safety, compliance, and audit standards equally across executive leadership and frontline operations.",
      "Dedicate a non-negotiable share of every planning cycle to paying down foundational maintenance before adding new stories to the structure.",
    ],
  },
  {
    id: "The Trowel",
    slug: "the-trowel",
    d1Key: "trowel",
    shortName: "The Trowel",
    navLabel: "The Trowel",
    navDescription: "Spreading the mortar of clear handoffs & civic trust",
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
    operativeOriginEssay: [
      "After the Gauge has measured, the Gavel has dressed, and the Plumb, Square, and Level have proved each individual ashlar block, the wall is still only a stack of loose stones until the Trowel spreads the lime mortar between them. Mortar performs a dual mechanical duty that looks paradoxical at first glance: it binds separate blocks into a single monolithic mass, and at the same time it forms a resilient cushion between them so point-to-point stone contact cannot shatter the blocks when thermal expansion or seismic tremor moves through the wall.",
      "A dry-stacked joint with missing or crumbling mortar leaves neighboring stones grinding directly against one another until a crack in one course propagates unchecked across the entire façade.",
    ],
    moralCivicApplicationEssay: [
      "In civic life and multi-agency operations, the Trowel represents the binding mortar of clear handoffs, honest inter-departmental communication, and earned public trust. Complex societies depend on dozens of specialized crews—utilities, regulators, suppliers, courts, and emergency responders—whose boundaries meet along thousands of seams.",
      "When institutional silos hoard information, shift liability across jurisdictional lines, or treat neighboring crews as adversaries, the mortar dries to dust. Under stress, the seams shear apart, turning a manageable local disruption into a cascading systemic crisis.",
    ],
    systemsEngineeringEquivalentEssay: [
      "In distributed systems and shop-floor reliability, the Trowel governs interface contracts, circuit breakers, bulkheads, and cross-team handoff protocols. Most catastrophic outages do not originate inside a single component; they erupt at the poorly specified boundary between two services or two teams—where an unannounced schema change, a missing backpressure valve, or a retry storm in one subsystem overwhelms every downstream dependency.",
      "Applying the Trowel means building explicit interface contracts, graceful degradation bulkheads, and shared incident communication channels so separate subsystems remain coordinated without dragging one another down when a local fault occurs.",
    ],
    operationalPractices: [
      "Define explicit interface contracts and handoff protocols at every boundary between independent teams, agencies, or services.",
      "Install structural firebreaks, circuit breakers, and backpressure bulkheads so a fault in one unit cannot cascade across the whole work.",
      "Share live operational telemetry across organizational silos rather than hoarding status updates during an active incident.",
      "Point and repair eroded joints of civic and inter-team trust before high-load emergencies put the seams to the test.",
    ],
  },
];

export const SRE_FAILURE_MODES: SreFailureModeSpec[] = [
  {
    id: "Configuration Drift",
    slug: "configuration-drift",
    d1Key: "configuration_drift",
    craftTitle: "Drifting Off-Square (Configuration Drift)",
    craftShortLabel: "Drifting Off-Square",
    navLabel: "Drifting Off-Square / Configuration Drift",
    navDescription: "When daily field habits quietly wander off the blueprint",
    shortCode: "CFG-DRIFT",
    severity: "warning",
    summary:
      "Drifting Off-Square (Configuration Drift): When day-to-day actions quietly wander away from the written rules without anyone calling a halt to re-measure.",
    systemsDefinition:
      "Happens when quick field workarounds, unrecorded favors, and temporary shortcuts pile up over time until the actual work on the shop floor no longer matches the blueprint.",
    civicManifestation:
      "Agencies, companies, or courts operating by unwritten backroom habits that quietly contradict their public rules until an inspection or breakdown exposes the gap.",
    defaultPairedTool: "The Square",
    engravingCaption: "Plate A — Diverging Field Alignment vs. True 90° Specification",
    shopFloorMechanicsEssay: [
      "Configuration drift never announces itself with a single dramatic alarm. It begins with a well-intentioned technician or supervisor making a small, unrecorded adjustment in the field to clear an immediate bottleneck—a bypassed validation check during a Friday rush, a manual firewall rule opened for a vendor test, or an informal verbal waiver that never makes it back into the master blueprint. Because the system continues running that afternoon, the shortcut is forgotten.",
      "Over months and years, dozens of these undocumented shims accumulate across different shifts. Eventually, the mental model held by leadership and written in the operating manual bears almost no resemblance to the actual machinery running on the shop floor. When a routine load spike or scheduled upgrade arrives, operators apply standard procedures to a non-standard structure, triggering a sudden, baffling failure.",
    ],
    civicInstitutionalEssay: [
      "In public administration, regulatory enforcement, and corporate governance, drifting off-square appears as the widening gulf between statutory law or chartered policy and everyday street-level practice. Consent decrees, procurement rules, and safety inspection checklists remain pristine in the public register while field offices quietly rely on permanent waivers, informal understandings, and unverified self-certifications.",
      "Because no single day's deviation crosses the threshold of scandal, the institution believes it is compliant right up until an external shock exposes that the public rules had ceased governing real operations years ago.",
    ],
    earlyWarningSignals: [
      "Frequent reliance on 'temporary' waivers, emergency overrides, or manual console adjustments that have no automatic expiration date.",
      "Growing divergence between written standard operating procedures and the tribal knowledge taught informally to new hires on shift.",
      "Compliance audits that verify signed paper attestations rather than inspecting live, unannounced shop-floor state.",
      "Routine maintenance updates or policy rollouts failing unexpectedly because field environments no longer match the baseline spec.",
    ],
  },
  {
    id: "Cascading Failure",
    slug: "cascading-failure",
    d1Key: "cascading_failure",
    craftTitle: "Chain-Reaction Breakdown (Cascading Failure)",
    craftShortLabel: "Chain-Reaction Breakdown",
    navLabel: "Chain-Reaction Breakdown / Cascading Failure",
    navDescription: "Chain-reaction breakdowns across unbuffered supports",
    shortCode: "CASCADE-01",
    severity: "critical",
    summary:
      "Chain-Reaction Breakdown (Cascading Failure): When one cracked timber or missed handoff overloads the next support in line because no firebreaks were built between them.",
    systemsDefinition:
      "When a single overloaded joint or stalled work crew throws its full weight onto neighboring supports without shutoff valves or firebreaks to contain the damage.",
    civicManifestation:
      "A local supply bottleneck, credit squeeze, or communication breakdown spreading rapidly across neighboring shops and towns that had no independent reserves.",
    defaultPairedTool: "The Trowel",
    engravingCaption: "Plate B — Unbuffered Load Transfer & Shear Propagation Across Arches",
    shopFloorMechanicsEssay: [
      "A chain-reaction breakdown occurs when tightly coupled components share load without firebreaks, circuit breakers, or backpressure valves between them. When Pier A cracks or slows down, its entire workload is automatically shunted onto Pier B. If Pier B was already running at eighty-five percent capacity to maximize efficiency, the sudden surge pushes it past its thermal or structural limit within seconds, throwing the combined weight of both onto Pier C.",
      "In distributed systems, this mechanical domino effect is frequently accelerated by aggressive, uncoordinated recovery logic—such as thousands of clients simultaneously hammering a recovering database with retry storms, turning a brief two-minute hiccup into a multi-hour regional blackout.",
    ],
    civicInstitutionalEssay: [
      "Across physical supply chains, financial markets, and multi-agency emergency response, cascading failures erupt when efficiency drives strip away local buffer stocks and jurisdictional bulkheads. Just-in-time logistics, interconnected municipal utilities, and tightly leveraged credit plumbing perform admirably under fair-weather averages but transmit local shocks at maximum velocity.",
      "When communication mortar between neighboring agencies is weak, each silo takes defensive action to protect its own ledger—hoarding inventory, freezing credit lines, or closing gates—which starves downstream partners and amplifies the shockwave across the entire civic edifice.",
    ],
    earlyWarningSignals: [
      "Subsystems or supply lines operating near 100% utilization in normal weather with zero surge headroom or local buffer reserves.",
      "Tightly coupled dependencies lacking circuit breakers, load shedding, or graceful degradation modes when an upstream partner stalls.",
      "Automated retry or re-routing loops that multiply request volume during a slowdown instead of backing off.",
      "Siloed agencies or teams that lack pre-established joint communication channels and shared status telemetry during boundary faults.",
    ],
  },
  {
    id: "Alert Fatigue & Signal Loss",
    slug: "alert-fatigue",
    d1Key: "alert_fatigue",
    craftTitle: "Crying Wolf / Drowning in Noise (Alert Fatigue)",
    craftShortLabel: "Crying Wolf / Drowning in Noise",
    navLabel: "Crying Wolf / Alert Fatigue",
    navDescription: "Drowning in false alarms & unverified telemetry signals",
    shortCode: "SIG-LOSS",
    severity: "warning",
    summary:
      "Crying Wolf / Drowning in Noise (Alert Fatigue): When a shop is flooded with so many false alarms and petty warnings that the crew stops listening right before a real hazard hits.",
    systemsDefinition:
      "When overly touchy bells ring all day over harmless vibrations, training workers to ignore or unplug the warning horn right before a genuine structural crack gives way.",
    civicManifestation:
      "Round-the-clock partisan shouting and sensational headlines exhausting public attention while serious, documented warnings sit unread in public records.",
    defaultPairedTool: "24-Inch Gauge",
    engravingCaption: "Plate C — High-Amplitude Noise Floor Masking Structural Fault Signal",
    shopFloorMechanicsEssay: [
      "When an organization adds a new alarm bell after every minor hiccup without ever retiring or recalibrating old thresholds, the control room is soon inundated with hundreds of chimes every shift. Ninety-nine percent of these alerts require no action; they report transient jitter, known quirks, or self-healing fluctuations. Yet each chime demands a slice of human attention to read and dismiss.",
      "Human neurology adapts to constant false alarms in only one way: habituation. Operators learn to bulk-acknowledge pages, mute the klaxon, or treat a flashing red board as normal background weather. When a genuine, slow-moving structural crack finally triggers its sensor, the warning sits buried on page four of an unread queue.",
    ],
    civicInstitutionalEssay: [
      "In the public square and regulatory oversight, signal loss is driven by two forces: sensationalized media ecosystems that frame every routine policy disagreement as an existential catastrophe, and defensive bureaucracy that buries critical disclosures inside ten-thousand-page filings.",
      "When every headline shouts at maximum volume and every compliance office floods the inbox with boilerplate notices, citizens and oversight boards exhaust their twenty-four-inch gauge of attention. After the collapse, investigators almost always discover that the exact warning was on the record months earlier—drowned out by the surrounding din.",
    ],
    earlyWarningSignals: [
      "High volumes of daily alarms or audit notices that are routinely acknowledged or closed without any physical remediation.",
      "Critical severity labels ('SEV-1', 'URGENT', 'BREAKING') applied indiscriminately to routine operational fluctuations.",
      "Oversight filings and safety reports that bury three lines of actionable risk inside ratusan pages of defensive boilerplate.",
      "Watch standers and review boards spending more time triaging notification queues than inspecting physical infrastructure.",
    ],
  },
  {
    id: "Single Point of Failure (SPOF) / Untested Failover",
    slug: "single-point-of-failure",
    d1Key: "untested_failover",
    craftTitle: "One Weak Link / Untested Backup (Single Point of Failure)",
    craftShortLabel: "One Weak Link / Untested Backup",
    navLabel: "One Weak Link / SPOF & Untested Backup",
    navDescription: "Single load-bearing pins & backups that only exist on paper",
    shortCode: "SPOF-FAIL",
    severity: "critical",
    summary:
      "One Weak Link / Untested Backup (Single Point of Failure): Betting the whole structure on a single load-bearing pin—or trusting an emergency backup plan that has never been tested under real weight.",
    systemsDefinition:
      "Hanging an entire operation on a single supplier, bridge, or keyholder while relying on a spare generator or backup plan that has only ever existed on paper.",
    civicManifestation:
      "Critical public utilities, supply lines, or safety checks that look redundant on a chart but seize up the moment an emergency puts them under real load.",
    defaultPairedTool: "The Plumb",
    engravingCaption: "Plate D — Single Keystone Pin & Unverified Secondary Support Path",
    shopFloorMechanicsEssay: [
      "A single point of failure is any keystone pin, credential, conduit, or specialist whose loss brings the entire work to a halt. Often, organizations believe they have eliminated a single point of failure by purchasing a secondary unit—only to discover during an outage that both primary and secondary units draw power from the same breaker panel, traverse the same municipal bridge trench, or depend on a manual failover script that has not been run in three years.",
      "An untested backup is worse than having no backup at all, because it creates a false sense of security that encourages leadership to take higher risks on the primary structure. Until a failover path is exercised under live production weight, it is merely a drawing on parchment.",
    ],
    civicInstitutionalEssay: [
      "In civic infrastructure, defense procurement, and regional utilities, hidden single points of failure proliferate when consolidation concentrates critical manufacturing, clearinghouse settlement, or regulatory inspection into a single bottleneck facility. On organizational charts, three competing contractors may appear to provide resilience, while all three quietly source the same specialty valve or chemical precursor from a single plant.",
      "Meanwhile, statutory emergency plans often sit in binders without live field drills, assuming that spare capacity, emergency communication radios, or mutual-aid crews will materialize effortlessly during a regional crisis.",
    ],
    earlyWarningSignals: [
      "Redundant pathways certified only on logical architecture diagrams without auditing shared physical conduits, power, or upstream suppliers.",
      "Emergency backup generators, recovery backups, or failover runbooks that are tested only in simulated sandboxes—or skipped entirely to avoid disruption.",
      "Critical operational knowledge or signing authority held exclusively by a single individual or sole-source contractor.",
      "Postponed failover drills because leaders fear the backup system might not survive a real switch-over test.",
    ],
  },
  {
    id: "Blame Culture vs. Root-Cause Isolation",
    slug: "blame-culture",
    d1Key: "blameless_postmortem_gap",
    craftTitle: "Scapegoating vs. Fixing the Trap (Blame Culture)",
    craftShortLabel: "Scapegoating vs. Fixing the Trap",
    navLabel: "Scapegoating vs. Fixing the Trap / Blame Culture",
    navDescription: "Firing the last worker on shift instead of fixing broken guardrails",
    shortCode: "BLAME-ISO",
    severity: "warning",
    summary:
      "Scapegoating vs. Fixing the Trap (Blame Culture): Firing the last worker who touched the lever instead of fixing the broken guardrails that set them up to fail.",
    systemsDefinition:
      "Treating a worker's slip-up as the end of the inquiry instead of the starting clue. Punishing the last person on shift guarantees the next worker will walk into the exact same trap.",
    civicManifestation:
      "Public hearings and press releases that sacrifice a low-level clerk to satisfy the crowd while leaving broken rules and bad incentives untouched.",
    defaultPairedTool: "Common Gavel",
    engravingCaption: "Plate E — Surface Scapegoat Focus vs. Unrepaired Subsurface Mechanism",
    shopFloorMechanicsEssay: [
      "When an accident occurs on a poorly designed shop floor, two identical levers—one for routine release and one for emergency dump—often sit side by side without a physical lockout pin. If a fatigued worker on the twelfth hour of a shift pulls the wrong lever, a blame-driven organization declares 'human error,' dismisses the worker, circulates a memo reminding staff to 'be more careful,' and closes the file.",
      "Nothing in the physical geometry of the shop has changed. The unlabeled levers remain six inches apart, the twelve-hour shift schedule remains intact, and the missing lockout pin is still unbuilt. Worse, every other worker on the floor learns a dangerous lesson: if you spot a near-miss or make a recoverable slip, hide the telemetry immediately lest you be sacrificed next.",
    ],
    civicInstitutionalEssay: [
      "In political and corporate life, public scapegoating is the cheapest counterfeit for accountability. After a regulatory lapse, aviation close call, or financial control breakdown, televised hearings and executive statements routinely focus on isolating a rogue field inspector or mid-level manager whose dismissal can close the news cycle.",
      "True root-cause isolation requires the Common Gavel: chipping away the performative hunt for a villain to ask why the institution's training, staffing, tooling, and verification gates permitted a single individual's mistake to propagate unchecked into public harm.",
    ],
    earlyWarningSignals: [
      "Post-incident reports that conclude with 'operator error' or 're-training ordered' without modifying a single physical guardrail or software constraint.",
      "Declining near-miss reporting from frontline crews because workers fear disciplinary reprisal for surfacing hazards.",
      "Public statements that emphasize swift punishment of junior personnel while shielding the resource and scheduling decisions of senior leadership.",
      "Recurring incidents of the exact same mechanical signature happening to different operators across successive quarters.",
    ],
  },
  {
    id: "Technical & Institutional Debt",
    slug: "institutional-debt",
    d1Key: "capacity_exhaustion",
    craftTitle: "Deferred Maintenance (Institutional Debt)",
    craftShortLabel: "Deferred Maintenance",
    navLabel: "Deferred Maintenance / Institutional Debt",
    navDescription: "Shortcuts and skipped upkeep that rot the foundation over time",
    shortCode: "INST-DEBT",
    severity: "critical",
    summary:
      "Deferred Maintenance (Institutional Debt): Taking an easy shortcut today that weakens the foundation tomorrow, until the overdue repairs cost more than the original build.",
    systemsDefinition:
      "Putting off routine upkeep and patching worn timbers with baling wire to hit a short-term deadline, letting hidden rot spread until everyday work becomes unsafe.",
    civicManifestation:
      "Decades of skipped bridge repairs, hollowed-out oversight, and postponed bills piling up until a routine storm triggers a major collapse.",
    defaultPairedTool: "The Level",
    engravingCaption: "Plate F — Subsiding Ashlar Foundation Course Under Compounding Load",
    shopFloorMechanicsEssay: [
      "Every engineered structure—whether a masonry aqueduct, a power grid substation, or a core settlement ledger—accumulates wear and entropy over time. Borrowing against maintenance can occasionally be a rational emergency decision to survive an immediate crunch, provided the loan is recorded on the ledger and repaid promptly once the storm passes.",
      "Institutional debt turns toxic when deferring upkeep becomes the permanent operating model. Each skipped overhaul forces technicians to layer brittle workarounds atop rotting foundations. Interest compounds silently: routine changes take ten times longer, minor vibrations crack load-bearing joints, and eventually the entire engineering budget is consumed just keeping the patched scaffolding from collapsing under its own weight.",
    ],
    civicInstitutionalEssay: [
      "In municipal infrastructure, public budgets, and institutional stewardship, deferred maintenance is driven by asymmetric time horizons. Cutting a maintenance budget or postponing pension and infrastructure renewals produces an immediate, visible surplus on this year's ledger, while the physical decay accumulates underground out of sight of voters and shareholders.",
      "When the bridge abutment, water main, or legacy computer system finally fails during an ordinary winter freeze, the resulting crisis is often blamed on the weather rather than on twenty years of unlevel stewardship that borrowed from the foundation to decorate the façade.",
    ],
    earlyWarningSignals: [
      "Routine maintenance budgets repeatedly raided or deferred to fund high-visibility announcements or short-term margin targets.",
      "Aging foundational systems that only a shrinking handful of retiring specialists know how to repair or restart.",
      "Increasing frequency of emergency patch workarounds required just to keep baseline daily operations online.",
      "Leadership tenure and bonus horizons that are shorter than the maintenance lifecycle of the infrastructure they govern.",
    ],
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

export const DOMAIN_SECTOR_SPECS: DomainSectorSpec[] = [
  {
    id: "Public Policy & Governance",
    slug: "public-policy-governance",
    shortLabel: "Public Policy & Governance",
    description:
      "Statutory mandates, regulatory oversight, courts, and municipal operations",
  },
  {
    id: "Technology & Cyber",
    slug: "technology-cyber",
    shortLabel: "Technology & Cyber",
    description:
      "Distributed cloud infrastructure, protocol security, software, and AI systems",
  },
  {
    id: "Infrastructure & Supply Chain",
    slug: "infrastructure-supply-chain",
    shortLabel: "Infrastructure & Supply Chain",
    description:
      "Power grids, aviation, rail, water works, ports, and physical logistics",
  },
  {
    id: "Economics & Markets",
    slug: "economics-markets",
    shortLabel: "Economics & Markets",
    description:
      "Credit plumbing, treasury markets, fiscal reserves, and industrial balance sheets",
  },
  {
    id: "Institutional Leadership",
    slug: "institutional-leadership",
    shortLabel: "Institutional Leadership",
    description:
      "Board governance, executive stewardship, post-incident accountability, and public trust",
  },
];

export const STRUCTURAL_FRICTION_FALLBACK_SPEC: SreFailureModeSpec = {
  id: "Structural Friction",
  slug: "configuration-drift",
  d1Key: "configuration_drift",
  craftTitle: "Structural Friction (Drifting Off-Square)",
  craftShortLabel: "Structural Friction",
  navLabel: "Drifting Off-Square / Configuration Drift",
  navDescription: "When daily field habits quietly wander off the blueprint",
  shortCode: "",
  severity: "warning",
  summary:
    "Drifting Off-Square (Structural Friction): When day-to-day actions quietly wander away from the written rules, creating strain across the work before a full inspection is called.",
  systemsDefinition:
    "Happens when unmapped handoffs, informal workarounds, or competing pressures cause different parts of a shop or institution to pull against one another.",
  civicManifestation:
    "Public institutions, utilities, or governing bodies experiencing operational strain between their stated mission and field reality.",
  defaultPairedTool: "The Square",
  engravingCaption: "Plate A — Diverging Field Alignment vs. True 90° Specification",
  shopFloorMechanicsEssay: SRE_FAILURE_MODES[0].shopFloorMechanicsEssay,
  civicInstitutionalEssay: SRE_FAILURE_MODES[0].civicInstitutionalEssay,
  earlyWarningSignals: SRE_FAILURE_MODES[0].earlyWarningSignals,
};

const WORKING_TOOL_ALIAS_MAP: Record<string, WorkingToolId> = {
  "24-inch gauge": "24-Inch Gauge",
  "24-inch-gauge": "24-Inch Gauge",
  "the 24-inch gauge": "24-Inch Gauge",
  twenty_four_inch_gauge: "24-Inch Gauge",
  "common gavel": "Common Gavel",
  "common-gavel": "Common Gavel",
  "the common gavel": "Common Gavel",
  common_gavel: "Common Gavel",
  "the plumb": "The Plumb",
  "the-plumb": "The Plumb",
  plumb: "The Plumb",
  "the square": "The Square",
  "the-square": "The Square",
  square: "The Square",
  "the level": "The Level",
  "the-level": "The Level",
  level: "The Level",
  "the trowel": "The Trowel",
  "the-trowel": "The Trowel",
  trowel: "The Trowel",
};

const FAILURE_MODE_ALIAS_MAP: Record<string, SreFailureModeId> = {
  "configuration drift": "Configuration Drift",
  "configuration-drift": "Configuration Drift",
  configuration_drift: "Configuration Drift",
  "cfg-drift": "Configuration Drift",
  "drifting off-square": "Configuration Drift",
  "drifting off-square (configuration drift)": "Configuration Drift",
  "drifting off-square / configuration drift": "Configuration Drift",
  "cascading failure": "Cascading Failure",
  "cascading-failure": "Cascading Failure",
  cascading_failure: "Cascading Failure",
  "cascade-01": "Cascading Failure",
  "chain-reaction breakdown": "Cascading Failure",
  "chain-reaction breakdown (cascading failure)": "Cascading Failure",
  "chain-reaction breakdown / cascading failure": "Cascading Failure",
  "alert fatigue & signal loss": "Alert Fatigue & Signal Loss",
  "alert fatigue": "Alert Fatigue & Signal Loss",
  "alert-fatigue": "Alert Fatigue & Signal Loss",
  alert_fatigue: "Alert Fatigue & Signal Loss",
  "silent-data-corruption": "Alert Fatigue & Signal Loss",
  "sig-loss": "Alert Fatigue & Signal Loss",
  "crying wolf / drowning in noise": "Alert Fatigue & Signal Loss",
  "crying wolf / alert fatigue": "Alert Fatigue & Signal Loss",
  "crying wolf": "Alert Fatigue & Signal Loss",
  "drowning in noise": "Alert Fatigue & Signal Loss",
  "crying wolf / drowning in noise (alert fatigue)":
    "Alert Fatigue & Signal Loss",
  "single point of failure (spof) / untested failover":
    "Single Point of Failure (SPOF) / Untested Failover",
  "single point of failure":
    "Single Point of Failure (SPOF) / Untested Failover",
  "single-point-of-failure":
    "Single Point of Failure (SPOF) / Untested Failover",
  spof: "Single Point of Failure (SPOF) / Untested Failover",
  "untested failover": "Single Point of Failure (SPOF) / Untested Failover",
  "untested-failover": "Single Point of Failure (SPOF) / Untested Failover",
  untested_failover: "Single Point of Failure (SPOF) / Untested Failover",
  "spof-fail": "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link / untested backup":
    "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link / spof & untested backup":
    "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link": "Single Point of Failure (SPOF) / Untested Failover",
  "untested backup": "Single Point of Failure (SPOF) / Untested Failover",
  "one weak link / untested backup (single point of failure)":
    "Single Point of Failure (SPOF) / Untested Failover",
  "blame culture vs. root-cause isolation":
    "Blame Culture vs. Root-Cause Isolation",
  "blame culture": "Blame Culture vs. Root-Cause Isolation",
  "blame-culture": "Blame Culture vs. Root-Cause Isolation",
  blameless_postmortem_gap: "Blame Culture vs. Root-Cause Isolation",
  "blame-iso": "Blame Culture vs. Root-Cause Isolation",
  "scapegoating vs. fixing the trap":
    "Blame Culture vs. Root-Cause Isolation",
  "scapegoating vs. fixing the trap / blame culture":
    "Blame Culture vs. Root-Cause Isolation",
  scapegoating: "Blame Culture vs. Root-Cause Isolation",
  "fixing the trap": "Blame Culture vs. Root-Cause Isolation",
  "scapegoating vs. fixing the trap (blame culture)":
    "Blame Culture vs. Root-Cause Isolation",
  "technical & institutional debt": "Technical & Institutional Debt",
  "institutional debt": "Technical & Institutional Debt",
  "institutional-debt": "Technical & Institutional Debt",
  capacity_exhaustion: "Technical & Institutional Debt",
  "inst-debt": "Technical & Institutional Debt",
  "deferred maintenance": "Technical & Institutional Debt",
  "deferred maintenance / institutional debt": "Technical & Institutional Debt",
  "deferred maintenance (institutional debt)": "Technical & Institutional Debt",
  "structural friction": "Structural Friction",
  structural_friction: "Structural Friction",
  "structural friction (drifting off-square)": "Structural Friction",
};

const DOMAIN_SECTOR_ALIAS_MAP: Record<string, DomainSectorId> = {
  "public policy & governance": "Public Policy & Governance",
  "public-policy-governance": "Public Policy & Governance",
  "public-policy": "Public Policy & Governance",
  "infrastructure & supply chain": "Infrastructure & Supply Chain",
  "infrastructure-supply-chain": "Infrastructure & Supply Chain",
  infrastructure: "Infrastructure & Supply Chain",
  "technology & cyber": "Technology & Cyber",
  "technology-cyber": "Technology & Cyber",
  technology: "Technology & Cyber",
  "economics & markets": "Economics & Markets",
  "economics-markets": "Economics & Markets",
  economics: "Economics & Markets",
  "institutional leadership": "Institutional Leadership",
  "institutional-leadership": "Institutional Leadership",
  leadership: "Institutional Leadership",
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

/**
 * Formats an incident code into a compact monospace Case ID (e.g. `CAB-2026-2081`)
 * for high-density ledger tables without horizontal overflow (Issue #43).
 */
export function formatCompactCaseId(
  rawCode: string | null | undefined,
  fallbackId?: string | number | null
): string {
  if (rawCode && typeof rawCode === "string") {
    const match = rawCode.match(/CAB-\d{4}-\d+/i);
    if (match) {
      return match[0].toUpperCase();
    }
    const stripped = rawCode
      .trim()
      .replace(
        /^(?:DISPATCH\s+FOLIO|INCIDENT\s+ID|LEDGER\s+ENTRY\s*(?:—|-)?\s*(?:CASE|No\.?)?)\s*:?\s*/i,
        ""
      )
      .replace(/^#/, "")
      .trim();
    if (stripped) return stripped;
  }
  if (fallbackId !== undefined && fallbackId !== null) {
    const digits = String(fallbackId).replace(/\D/g, "");
    if (digits) {
      return `CAB-2026-${digits.padStart(4, "0")}`;
    }
  }
  return "CAB-0000";
}

export function formatFriendlyDate(
  isoDate: string | null | undefined
): string {
  if (!isoDate || typeof isoDate !== "string") return "";
  const trimmed = isoDate.trim();
  if (!trimmed) return "";
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
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

/**
 * Returns the canonical plain-English Craft display label for any Failure Mode
 * (e.g., "Drifting Off-Square" for "Configuration Drift") so badges, titles,
 * and narrative synthesis prose remain 100% unified without taxonomy split-brain.
 */
export function formatFailureModeDisplayLabel(
  mode: SreFailureModeId | string | null | undefined
): string {
  const mapped = mapFailureModeToCraftLexicon(mode);
  const spec = getSreFailureModeSpec(mapped);
  return SHORT_FAILURE_LABELS[mapped] || spec.craftShortLabel || mapped;
}

/**
 * Deterministic lookup of a Working Tool specification by its canonical URL slug,
 * D1 enum key, or display name. Returns `null` if unrecognized (used for `notFound()` in `/tools/[slug]`).
 */
export function getWorkingToolBySlug(
  slugOrId: string | null | undefined
): WorkingToolSpec | null {
  if (!slugOrId || typeof slugOrId !== "string") return null;
  const normalized = decodeURIComponent(slugOrId).trim().toLowerCase();
  const byExactSlug = WORKING_TOOLS.find(
    (t) =>
      t.slug === normalized ||
      t.d1Key === normalized ||
      t.id.toLowerCase() === normalized
  );
  if (byExactSlug) return byExactSlug;

  const aliased = WORKING_TOOL_ALIAS_MAP[normalized];
  if (aliased) {
    return WORKING_TOOLS.find((t) => t.id === aliased) || null;
  }
  return null;
}

/**
 * Deterministic lookup of a Structural Failure Mode specification by its canonical URL slug,
 * D1 enum key, or display name. Returns `null` if unrecognized (used for `notFound()` in `/failures/[slug]`).
 */
export function getFailureModeBySlug(
  slugOrId: string | null | undefined
): SreFailureModeSpec | null {
  if (!slugOrId || typeof slugOrId !== "string") return null;
  const normalized = decodeURIComponent(slugOrId).trim().toLowerCase();
  const byExactSlug = SRE_FAILURE_MODES.find(
    (f) =>
      f.slug === normalized ||
      f.d1Key === normalized ||
      f.id.toLowerCase() === normalized ||
      f.craftShortLabel.toLowerCase() === normalized
  );
  if (byExactSlug) return byExactSlug;

  const aliased = FAILURE_MODE_ALIAS_MAP[normalized];
  if (aliased && aliased !== "Structural Friction") {
    return SRE_FAILURE_MODES.find((f) => f.id === aliased) || null;
  }
  return null;
}

/**
 * Deterministic lookup of an Axis III Domain Sector specification by its URL slug or display name.
 */
export function getDomainSectorBySlug(
  slugOrName: string | null | undefined
): DomainSectorSpec | null {
  if (!slugOrName || typeof slugOrName !== "string") return null;
  const normalized = decodeURIComponent(slugOrName).trim().toLowerCase();
  const direct = DOMAIN_SECTOR_SPECS.find(
    (s) => s.slug === normalized || s.id.toLowerCase() === normalized
  );
  if (direct) return direct;

  const aliased = DOMAIN_SECTOR_ALIAS_MAP[normalized];
  if (aliased) {
    return DOMAIN_SECTOR_SPECS.find((s) => s.id === aliased) || null;
  }
  return null;
}

export function getWorkingToolHref(
  tool: WorkingToolId | WorkingToolSpec | string | null | undefined
): string {
  if (tool && typeof tool === "object" && "slug" in tool) {
    return `/tools/${tool.slug}`;
  }
  const spec = getWorkingToolBySlug(typeof tool === "string" ? tool : "") || getWorkingToolSpec(typeof tool === "string" ? tool : null);
  return `/tools/${spec.slug}`;
}

export function getFailureModeHref(
  mode: SreFailureModeId | SreFailureModeSpec | string | null | undefined
): string {
  if (mode && typeof mode === "object" && "slug" in mode) {
    return `/failures/${mode.slug}`;
  }
  const spec = getFailureModeBySlug(typeof mode === "string" ? mode : "") || getSreFailureModeSpec(typeof mode === "string" ? mode : null);
  return `/failures/${spec.slug}`;
}

export function getDomainSectorHref(
  sector: DomainSectorId | DomainSectorSpec | string | null | undefined
): string {
  if (sector && typeof sector === "object" && "slug" in sector) {
    return `/archive?sector=${sector.slug}`;
  }
  const spec = getDomainSectorBySlug(typeof sector === "string" ? sector : "");
  return spec ? `/archive?sector=${spec.slug}` : "/archive";
}
