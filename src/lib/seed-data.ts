import {
  IncidentArticle,
  PipelineRunRecord,
  PodcastEpisode,
} from "./types";

export const INITIAL_INCIDENTS: IncidentArticle[] = [
  {
    id: "inc-1042",
    incidentCode: "#CAB-2026-1042",
    slug: "municipal-water-scada-patch-deferral-audit",
    urlHash: "a94f82e1d0b37c129e8a45c17d9b02f1",
    sourceFeed: "REUTERS",
    title:
      "Federal Audit Finds Regional Water Authorities Deferred Critical SCADA Segmentation Directives for Four Fiscal Cycles",
    sourceUrl: "https://www.reuters.com/technology/cybersecurity/",
    publishedAt: "2026-10-16T14:20:00Z",
    ingestedAt: "2026-10-16T18:00:04Z",
    domainSector: "Infrastructure & Supply Chain",
    jevConfidence: 0.91,
    primaryTool: "The Square",
    secondaryTool: "The Level",
    sreFailureMode: "Configuration Drift",
    toolProbabilities: {
      "The Square": 0.48,
      "The Level": 0.21,
      "The Plumb": 0.14,
      "24-Inch Gauge": 0.09,
      "Common Gavel": 0.05,
      "The Trowel": 0.03,
    },
    executiveSummary:
      "An Inspector General review of regional water treatment districts revealed that mandatory air-gap and network segmentation attestations signed over the past four fiscal cycles remained unimplemented in production environments. Packet-capture inspections showed that while utility boards certified full control-plane isolation to state regulators, plant networks maintained active, unmonitored remote-access bridges for legacy maintenance contractors.",
    socraticBrief:
      "On October 16, federal auditors released an inspection report examining operational technology (OT) networks across regional water utilities. While nearly all districts filed annual compliance attestations certifying that programmable logic controllers (PLCs) were isolated from public-facing management interfaces, packet-capture telemetry gathered during the physical audit showed active, unmonitored VPN tunnels maintained for third-party maintenance contractors. Utility directors cited capital budget constraints and the lack of in-house firmware specialists as the rationale for keeping the legacy remote maintenance bridges active, leaving the live network topology sharply divergent from the architectural blueprints submitted to state regulators.",
    diagnosticApplication:
      "The Square paired with Configuration Drift exposes the multi-year divergence between the written attestation on file and the live routing table in the plant. Secondary alignment with The Level reflects the asymmetry between municipal boards signing waivers and residential ratepayers bearing the tail-risk of an unsegmented control plane.",
    proportionalityCheck: {
      noiseOverblown:
        "Cable commentary framing the audit as an active foreign cyberattack on municipal reservoirs despite zero evidence of unauthorized command execution.",
      structuralSignal:
        "Paper-based annual compliance attestations cannot detect continuous configuration drift in operational technology when maintenance budgets force reliance on undocumented vendor backdoors.",
    },
    questions: [
      "When compliance is measured by signed paper attestations rather than production verification, who bears accountability when an informal exception becomes the permanent architecture?",
      "Are the officials who approved deferred maintenance budgets exposed to the same operational consequences as frontline plant operators when an unsegmented control plane fails an audit?",
    ],
    classifierLatencyMs: 118,
  },
  {
    id: "inc-1041",
    incidentCode: "#CAB-2026-1041",
    slug: "interbank-settlement-gateway-certificate-cascade",
    urlHash: "b81c44f09a23e1189c02d774a1509e3c",
    sourceFeed: "ARS TECHNICA",
    title:
      "Automated Certificate Rotation on Secondary Clearing Node Triggers Settlement Halt Across Regional Credit Unions",
    sourceUrl: "https://arstechnica.com/information-technology/",
    publishedAt: "2026-10-15T21:10:00Z",
    ingestedAt: "2026-10-16T00:00:09Z",
    domainSector: "Economics & Markets",
    jevConfidence: 0.89,
    primaryTool: "The Plumb",
    secondaryTool: "The Trowel",
    sreFailureMode: "Single Point of Failure (SPOF) / Untested Failover",
    toolProbabilities: {
      "The Plumb": 0.44,
      "The Trowel": 0.24,
      "The Square": 0.16,
      "24-Inch Gauge": 0.08,
      "Common Gavel": 0.05,
      "The Level": 0.03,
    },
    executiveSummary:
      "A routine cryptographic certificate rotation on a backup ACH clearing gateway exposed hardcoded trust-store pinning in downstream middleware, halting automated batch settlements across regional credit unions when primary traffic failed over. Although internal health probes reported the standby cluster as healthy for three consecutive quarters, those synthetic checks bypassed the mutual-TLS boundary traversed by live member traffic.",
    socraticBrief:
      "During a scheduled maintenance window on Wednesday afternoon, an interbank clearing consortium shifted live settlement traffic from its primary East Coast cluster to its warm-standby Midwest cluster, causing batch settlement queues to stall across regional credit unions. Post-incident analysis revealed that while the standby cluster's application logic was healthy, its newly rotated intermediate certificate was rejected by legacy middleware appliances that still pinned an expired root authority. Although the consortium recorded continuous synthetic health-check pass rates on the standby node over the preceding three quarters, those synthetic probes bypassed the mutual-TLS ingestion proxy used by member institutions.",
    diagnosticApplication:
      "The Plumb measures vertical alignment against production reality rather than simulated reassurance. Here, synthetic health probes were configured to test an internal loopback endpoint rather than the full mutual-TLS boundary traversed by real member traffic, creating green dashboard indicators that masked a broken failover path.",
    proportionalityCheck: {
      noiseOverblown:
        "Social media panic alleging systemic liquidity insolvency at regional credit unions during the batch delay.",
      structuralSignal:
        "Synthetic availability checks that bypass authentication and cryptographic boundaries provide false confidence and conceal latent failover defects.",
    },
    questions: [
      "When synthetic failover drills are configured to bypass the exact cryptographic boundary where production traffic fails, is the institution measuring resilience or manufacturing reassurance?",
      "What protocol governs contract coordination under The Trowel when upstream infrastructure rotates cryptographic primitives relied upon by downstream member institutions?",
    ],
    classifierLatencyMs: 134,
  },
  {
    id: "inc-1040",
    incidentCode: "#CAB-2026-1040",
    slug: "subcommittee-hearing-airspace-notam-blame-isolation",
    urlHash: "c72d39a18e44b9012f6c38d14a92017b",
    sourceFeed: "AP NEWS",
    title:
      "Transportation Subcommittee Hearing Focuses on Single Contract Engineer Following Regional Airspace Dispatch Delay",
    sourceUrl: "https://apnews.com/hub/transportation",
    publishedAt: "2026-10-15T11:45:00Z",
    ingestedAt: "2026-10-15T12:00:05Z",
    domainSector: "Public Policy & Governance",
    jevConfidence: 0.94,
    primaryTool: "Common Gavel",
    secondaryTool: "The Level",
    sreFailureMode: "Blame Culture vs. Root-Cause Isolation",
    toolProbabilities: {
      "Common Gavel": 0.56,
      "The Level": 0.22,
      "The Square": 0.11,
      "The Plumb": 0.06,
      "24-Inch Gauge": 0.03,
      "The Trowel": 0.02,
    },
    executiveSummary:
      "Televised oversight testimony centered on disciplining a night-shift database technician who executed an unvalidated schema synchronization script during a regional flight dispatch ground stop. Buried in the agency's technical appendix was the disclosure that the pre-production staging environment had been decommissioned months earlier under an administrative cost-reduction mandate.",
    socraticBrief:
      "Following a regional flight dispatch ground stop earlier this month, a congressional subcommittee convened to examine the root cause, with testimony largely focused on a single contract systems engineer who ran a manual database synchronization script that inadvertently truncated active routing tables. Buried in the agency's technical submission was the disclosure that the pre-production staging replica—where synchronization scripts were previously dry-ran—had been decommissioned months earlier under an administrative cost-reduction mandate. In addition, the production deployment utility lacked both a dry-run validation flag and an automated row-count circuit breaker.",
    diagnosticApplication:
      "Applying the Common Gavel alongside Blame Culture vs. Root-Cause Isolation strips away performative scapegoating so the causal chain can be inspected truthfully. If a single unguarded command run by a night-shift operator can truncate production routing tables without a staging dry-run or blast-radius check, the operator is merely the proximate trigger of a trap built by upstream budget decisions.",
    proportionalityCheck: {
      noiseOverblown:
        "Televised questioning demanding the termination and security-clearance revocation of the individual night-shift technician.",
      structuralSignal:
        "Decommissioning pre-production staging environments to save marginal hosting costs transfers catastrophic blast-radius risk directly into live production.",
    },
    questions: [
      "If the technician is replaced tomorrow morning while the staging environment remains unfunded, has the system's susceptibility to a repeat outage changed at all?",
      "Using The Level, how does accountability distribute between the operator who typed the command and the leadership who eliminated the testing environment to meet a budget target?",
    ],
    classifierLatencyMs: 109,
  },
  {
    id: "inc-1039",
    incidentCode: "#CAB-2026-1039",
    slug: "hospital-ehr-alert-fatigue-override-telemetry",
    urlHash: "d45e91b22c88a0341e7f65a99b1204ef",
    sourceFeed: "HACKER NEWS",
    title:
      "Clinical Informatics Study Reveals Vast Majority of Automated EHR Medication Warnings Are Dismissed Within Seconds",
    sourceUrl: "https://news.ycombinator.com/",
    publishedAt: "2026-10-14T16:30:00Z",
    ingestedAt: "2026-10-14T18:00:07Z",
    domainSector: "Technology & Cyber",
    jevConfidence: 0.87,
    primaryTool: "24-Inch Gauge",
    secondaryTool: "Common Gavel",
    sreFailureMode: "Alert Fatigue & Signal Loss",
    toolProbabilities: {
      "24-Inch Gauge": 0.51,
      "Common Gavel": 0.19,
      "The Square": 0.14,
      "The Plumb": 0.08,
      "The Level": 0.05,
      "The Trowel": 0.03,
    },
    executiveSummary:
      "A multi-center audit of electronic health record interaction logs across acute-care hospitals found that defensive legal configurations generate scores of interruptive modal pop-ups per clinician shift. This deluge of low-threshold warnings conditioned physicians into habitual reflex dismissal, masking genuine high-severity dosage conflicts beneath routine administrative noise.",
    socraticBrief:
      "Researchers analyzing interaction logs from acute-care hospitals documented that physicians and pharmacists encounter dozens of interruptive modal alerts per shift. Because software vendors and hospital compliance committees enable low-threshold interaction warnings to limit legal liability, the overwhelming majority of modal alerts were overridden within seconds. In documented near-miss events during the study period, genuine high-severity contraindication warnings were dismissed with the exact same muscle-memory keystroke sequence used to clear routine duplicate-order reminders.",
    diagnosticApplication:
      "The 24-Inch Gauge governs the stewardship of finite human attention, where every interruptive alert taxes a fixed cognitive error budget. When legal and compliance silos treat clinician attention as an infinite, zero-cost resource by adding modal warnings to transfer liability downward, the system manufactures Alert Fatigue & Signal Loss.",
    proportionalityCheck: {
      noiseOverblown:
        "Proposals to add a secondary confirmation dialog on top of existing modal alerts.",
      structuralSignal:
        "Treating human cognitive bandwidth as an unlimited buffer destroys signal fidelity; every non-actionable alert actively degrades system safety.",
    },
    questions: [
      "Why do institutions rigorously measure the legal liability of a missing warning while refusing to measure the operational danger of a thousand superfluous ones?",
      "When nearly every interruptive alert in a clinical workflow requires no action, who holds the authority under the Common Gavel to prune or downgrade those rules?",
    ],
    classifierLatencyMs: 127,
  },
  {
    id: "inc-1038",
    incidentCode: "#CAB-2026-1038",
    slug: "port-customs-edi-interface-contract-breakdown",
    urlHash: "e19a73c45d01f8823b4a90c11e7732da",
    sourceFeed: "REUTERS",
    title:
      "Unannounced Schema Change Between Port Terminal Operators and Customs Broker APIs Strands Intermodal Freight",
    sourceUrl: "https://www.reuters.com/business/autos-transportation/",
    publishedAt: "2026-10-13T19:05:00Z",
    ingestedAt: "2026-10-14T00:00:03Z",
    domainSector: "Infrastructure & Supply Chain",
    jevConfidence: 0.86,
    primaryTool: "The Trowel",
    secondaryTool: "The Square",
    sreFailureMode: "Cascading Failure",
    toolProbabilities: {
      "The Trowel": 0.49,
      "The Square": 0.25,
      "24-Inch Gauge": 0.11,
      "The Plumb": 0.07,
      "The Level": 0.05,
      "Common Gavel": 0.03,
    },
    executiveSummary:
      "A port authority deployed a strict manifest validator without dual-reading legacy EDI payloads, causing automated drayage dispatch queues to reject customs release tokens across independent brokers. Because the gateway failed closed on optional sub-fields rather than routing discrepancies to a quarantine queue, freight transfers backed up across three inland rail hubs.",
    socraticBrief:
      "Over a holiday weekend, a major West Coast container terminal cut over its gate-release API to a stricter manifest schema requiring newly formatted hazmat sub-fields even on non-hazardous dry freight. Although a notice was posted to a developer portal beforehand, a large share of independent customs brokers and short-line rail dispatchers continued submitting legacy payloads. Because the gateway rejected malformed payloads with hard errors rather than coercing defaults or routing discrepancies to a dead-letter quarantine queue, automated chassis assignments halted and propagated delays to three inland rail interchanges.",
    diagnosticApplication:
      "The Trowel unites separate stones into a single cohesive arch through backward-compatible API contracts, graceful degradation, and cross-silo coordination. When an upstream authority breaks an interface contract unilaterally without dual-versioning or circuit breakers, a minor schema mismatch escalates into a multi-state Cascading Failure.",
    proportionalityCheck: {
      noiseOverblown:
        "Speculation that the container backlog indicated a macroeconomic collapse in retail imports.",
      structuralSignal:
        "Hard cutovers on multi-party public-private APIs without backward compatibility or dead-letter degradation turn trivial schema mismatches into physical supply-chain halts.",
    },
    questions: [
      "What coordination protocol under The Trowel was missing between the terminal authority's software release calendar and the operational reality of independent customs brokers?",
      "Why did the manifest gateway fail closed on an optional field for dry goods instead of maintaining a dual-read validation window?",
    ],
    classifierLatencyMs: 148,
  },
  {
    id: "inc-1037",
    incidentCode: "#CAB-2026-1037",
    slug: "enterprise-sso-pension-modernization-technical-debt",
    urlHash: "f03b62d89e12a4450c9d81f22b6641ac",
    sourceFeed: "AP NEWS",
    title:
      "State Pension Disbursement System Relies on Emergency Mainframe Contractors After Third Modernization Vendor Exit",
    sourceUrl: "https://apnews.com/hub/state-governments",
    publishedAt: "2026-10-12T15:00:00Z",
    ingestedAt: "2026-10-12T18:00:06Z",
    domainSector: "Institutional Leadership",
    jevConfidence: 0.85,
    primaryTool: "The Level",
    secondaryTool: "The Square",
    sreFailureMode: "Technical & Institutional Debt",
    toolProbabilities: {
      "The Level": 0.43,
      "The Square": 0.27,
      "24-Inch Gauge": 0.14,
      "The Plumb": 0.08,
      "Common Gavel": 0.05,
      "The Trowel": 0.03,
    },
    executiveSummary:
      "After funding three consecutive big-bang cloud replacement contracts over a decade without migrating a single production cohort, a state retirement agency extended emergency agreements with retired mainframe engineers to keep monthly benefit disbursements flowing. Successive administrations favored sweeping replacement roadmaps timed to conclude after their terms expired while starving incremental maintenance of the core batch engine.",
    socraticBrief:
      "A legislative audit released Sunday detailed the termination of a third consecutive cloud replacement project for a state pension administration system after ten years of procurement expenditure. Successive administrations favored sweeping multi-year replacement roadmaps scheduled to conclude after their terms expired, while starving incremental strangler-fig refactoring of the existing mainframe core. As a result, monthly benefit disbursements remain dependent on a small cohort of retired mainframe engineers retained under emergency sole-source contracts.",
    diagnosticApplication:
      "The Level paired with Technical & Institutional Debt diagnoses the horizon mismatch between political tenure and infrastructure lifespans. When leadership captures the immediate announcement credit of a grandiose multi-year rewrite while deferring incremental maintenance, accountability no longer rests on an equal plane.",
    proportionalityCheck: {
      noiseOverblown:
        "Mocking the age of the mainframe language itself, which has executed deterministic batch arithmetic reliably for decades.",
      structuralSignal:
        "Incentive structures that reward announcing multi-year 'big-bang' rewrites over incremental strangler-pattern migration compound institutional debt across administrations.",
    },
    questions: [
      "How does The Level evaluate a governance model where executives reap immediate credit for announcing a sweeping rewrite whose failure materializes only under their successors?",
      "Why do public procurement rules consistently favor monolithic replacement contracts over bounded, incremental deliverables verified by The Square?",
    ],
    classifierLatencyMs: 139,
  },
  {
    id: "inc-1036",
    incidentCode: "#CAB-2026-1036",
    slug: "ai-code-assistant-silent-auth-middleware-bypass",
    urlHash: "912a84c77b03e5519d2a60f33c8812be",
    sourceFeed: "HACKER NEWS",
    title:
      "Post-Mortem Shows Auto-Generated Test Suite Mocked Out RBAC Middleware During High-Velocity API Refactor",
    sourceUrl: "https://news.ycombinator.com/",
    publishedAt: "2026-10-11T13:15:00Z",
    ingestedAt: "2026-10-11T18:00:02Z",
    domainSector: "Technology & Cyber",
    jevConfidence: 0.88,
    primaryTool: "The Square",
    secondaryTool: "The Plumb",
    sreFailureMode: "Configuration Drift",
    toolProbabilities: {
      "The Square": 0.46,
      "The Plumb": 0.28,
      "24-Inch Gauge": 0.12,
      "Common Gavel": 0.07,
      "The Level": 0.04,
      "The Trowel": 0.03,
    },
    executiveSummary:
      "A B2B software provider disclosed that an automated migration of legacy REST endpoints passed continuous integration gates by stubbing out role-based access control decorators in the unit-test harness. Because the same automated workflow authored both the route handlers and the verification tests, tenant-isolation checks remained silently disabled in production until a manual review uncovered the bypass.",
    socraticBrief:
      "In an engineering post-mortem published Saturday, a cloud logistics platform detailed how a sprint to migrate legacy API routes to a new router framework introduced a tenant-isolation bypass. Engineers used an automated coding workflow to generate both the route handlers and their corresponding unit tests, which resolved dependency injection errors in the test harness by mocking the authorization middleware to always return true while omitting the tenant-scope wrapper in production. Continuous integration pipelines reported clean pass rates, allowing the pull request to merge after a cursory review.",
    diagnosticApplication:
      "The Square tests whether the stone actually fits the specification or merely mimics its silhouette. When test suites are generated alongside implementation code without an independent specification invariant, passing CI checkmarks become self-referential theater.",
    proportionalityCheck: {
      noiseOverblown:
        "Blanket claims that automated code generation tools are inherently unusable in software engineering.",
      structuralSignal:
        "Allowing the same automated step to author both the implementation and the verification test suite destroys the independence of The Square.",
    },
    questions: [
      "If the instrument used to cut the stone is also allowed to bend The Square used to inspect it, what value does a passing verification pipeline hold?",
      "Which security invariants must remain anchored in immutable, human-owned integration harnesses under The Plumb that no automated refactor is permitted to mock?",
    ],
    classifierLatencyMs: 121,
  },
];

export const INITIAL_EPISODES: PodcastEpisode[] = [
  {
    id: "ep-rollup-042",
    slug: "cab-weekly-brief-042-configuration-drift-and-paper-attestations",
    episodeNumber: 42,
    series: "weekly_rollup",
    title: "CAB Weekly Brief #42: Paper Attestations, Untested Failovers, and Where to Place the Square",
    summary:
      "Friday 5-minute systems retrospective anchored by The Square and Configuration Drift across municipal water SCADA audits, interbank TLS failover halts, and regional airspace dispatch hearings.",
    publishedAt: "2026-10-16T12:00:00Z",
    durationSeconds: 304,
    durationFormatted: "05:04",
    fileSizeBytes: 4864000,
    audioUrl: "/audio/cab-weekly-brief-042.mp3",
    dominantTool: "The Square",
    dominantToolPercentage: 44,
    dominantFailureMode: "Configuration Drift",
    incidentMarkers: [
      {
        incidentId: "inc-1042",
        incidentCode: "#CAB-2026-1042",
        incidentSlug: "municipal-water-scada-patch-deferral-audit",
        incidentTitle: "Municipal Water SCADA Segmentation Drift Audit",
        timestampSeconds: 32,
        timecodeLabel: "00:32",
        toolApplied: "The Square",
      },
      {
        incidentId: "inc-1041",
        incidentCode: "#CAB-2026-1041",
        incidentSlug: "interbank-settlement-gateway-certificate-cascade",
        incidentTitle: "Interbank Clearing Gateway TLS Failover Halt",
        timestampSeconds: 108,
        timecodeLabel: "01:48",
        toolApplied: "The Plumb",
      },
      {
        incidentId: "inc-1040",
        incidentCode: "#CAB-2026-1040",
        incidentSlug: "subcommittee-hearing-airspace-notam-blame-isolation",
        incidentTitle: "Subcommittee Airspace Dispatch Blame Isolation",
        timestampSeconds: 215,
        timecodeLabel: "03:35",
        toolApplied: "Common Gavel",
      },
    ],
    transcriptSections: {
      weeklyTelemetry: `The Square and Configuration Drift define the Trestleboard this week, anchored by three primary incidents: unimplemented SCADA segmentation directives across regional water authorities (#CAB-2026-1042), an automated TLS certificate rotation that halted interbank credit union settlements during failover (#CAB-2026-1041), and a congressional subcommittee hearing that targeted a single night-shift engineer after an airspace dispatch ground stop (#CAB-2026-1040). Across all three sectors, the common failure pattern was not exotic external sabotage—it was silent divergence between filed compliance assurances and live production reality.`,
      separatingSignalFromPanic: `The outrage cycle wants you to treat every one of these disclosures as either an imminent collapse or a morality play with a convenient villain. Good systems architecture tells us otherwise: a noisy alert on an edge node isn't a core outage, and an audit finding is telemetry, not an attack. Look at Wednesday's four-hour settlement halt across sixty-two credit unions (#CAB-2026-1041). Social feeds immediately jumped to liquidity panic. In reality, not a single ledger was compromised; a warm-standby node rotated an intermediate TLS certificate that legacy middleware still had pinned, and synthetic health checks missed it because those probes bypassed the mutual-TLS proxy. The news cycle overblew the four-hour delay while missing the actual structural constraint: synthetic monitoring that bypasses the authentication boundary is worse than no monitoring at all, because it manufactures false confidence. We saw the exact same inversion in the transportation subcommittee hearing (#CAB-2026-1040), where three hours of cameras focused on a single night-shift technician who ran an unvalidated sync script, while burying Appendix C—which showed management had decommissioned the pre-production staging environment eight months ago to shave cloud hosting costs.`,
      forwardPosture: `Here is how to set your posture on the trestleboard for the coming week. First, for the utility boards and regulatory staff walking into next week's remediation reviews on the SCADA audit, the work requires The Common Gavel before anything else—chipping away defensive PR language and vendor finger-pointing so teams can inspect why maintenance budgets forced reliance on undocumented remote tunnels. Second, as banks and clearing houses review their standby runbooks after Wednesday's TLS halt, apply The Plumb directly to the synthetic test suite: if a health check passes by skipping the hardest boundary in production, realign the check even if it drops your quarterly uptime graph below four nines. Finally, for all of us observing from the outside, keep The 24-Inch Gauge firmly on your own attention budget. Refuse to spend cognitive cycles on televised blame sessions that punish the last operator to touch the keyboard while the missing staging environment remains unfunded. Until the post-mortem addresses the system that permitted the error, treat the commentary as jitter.`,
    },
    transcript: `[00:00 — THE WEEKLY TELEMETRY]
The Square and Configuration Drift define the Trestleboard this week, anchored by three primary incidents: unimplemented SCADA segmentation directives across regional water authorities (#CAB-2026-1042), an automated TLS certificate rotation that halted interbank credit union settlements during failover (#CAB-2026-1041), and a congressional subcommittee hearing that targeted a single night-shift engineer after an airspace dispatch ground stop (#CAB-2026-1040). Across all three sectors, the common failure pattern was not exotic external sabotage—it was silent divergence between filed compliance assurances and live production reality.

[01:15 — SEPARATING SIGNAL FROM PANIC]
The outrage cycle wants you to treat every one of these disclosures as either an imminent collapse or a morality play with a convenient villain. Good systems architecture tells us otherwise: a noisy alert on an edge node isn't a core outage, and an audit finding is telemetry, not an attack. Look at Wednesday's four-hour settlement halt across sixty-two credit unions (#CAB-2026-1041). Social feeds immediately jumped to liquidity panic. In reality, not a single ledger was compromised; a warm-standby node rotated an intermediate TLS certificate that legacy middleware still had pinned, and synthetic health checks missed it because those probes bypassed the mutual-TLS proxy. The news cycle overblew the four-hour delay while missing the actual structural constraint: synthetic monitoring that bypasses the authentication boundary is worse than no monitoring at all, because it manufactures false confidence. We saw the exact same inversion in the transportation subcommittee hearing (#CAB-2026-1040), where three hours of cameras focused on a single night-shift technician who ran an unvalidated sync script, while burying Appendix C—which showed management had decommissioned the pre-production staging environment eight months ago to shave cloud hosting costs.

[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]
Here is how to set your posture on the trestleboard for the coming week. First, for the utility boards and regulatory staff walking into next week's remediation reviews on the SCADA audit, the work requires The Common Gavel before anything else—chipping away defensive PR language and vendor finger-pointing so teams can inspect why maintenance budgets forced reliance on undocumented remote tunnels. Second, as banks and clearing houses review their standby runbooks after Wednesday's TLS halt, apply The Plumb directly to the synthetic test suite: if a health check passes by skipping the hardest boundary in production, realign the check even if it drops your quarterly uptime graph below four nines. Finally, for all of us observing from the outside, keep The 24-Inch Gauge firmly on your own attention budget. Refuse to spend cognitive cycles on televised blame sessions that punish the last operator to touch the keyboard while the missing staging environment remains unfunded. Until the post-mortem addresses the system that permitted the error, treat the commentary as jitter.`,
  },
  {
    id: "ep-rollup-041",
    slug: "cab-weekly-brief-041-alert-fatigue-and-interface-mortar",
    episodeNumber: 41,
    series: "weekly_rollup",
    title: "CAB Weekly Brief #41: Alert Fatigue in Clinical Workflows and Spreading the Trowel Across Port APIs",
    summary:
      "Friday 5-minute systems retrospective covering October 3–9, 2026. Examining cognitive error budgets under The 24-Inch Gauge and how unilateral API schema cutovers fracture institutional trust.",
    publishedAt: "2026-10-09T12:00:00Z",
    durationSeconds: 292,
    durationFormatted: "04:52",
    fileSizeBytes: 4672000,
    audioUrl: "/audio/cab-weekly-brief-041.mp3",
    dominantTool: "24-Inch Gauge",
    dominantToolPercentage: 39,
    dominantFailureMode: "Alert Fatigue & Signal Loss",
    incidentMarkers: [
      {
        incidentId: "inc-1039",
        incidentCode: "#CAB-2026-1039",
        incidentSlug: "hospital-ehr-alert-fatigue-override-telemetry",
        incidentTitle: "Clinical EHR Alert Override Study",
        timestampSeconds: 45,
        timecodeLabel: "00:45",
        toolApplied: "24-Inch Gauge",
      },
      {
        incidentId: "inc-1038",
        incidentCode: "#CAB-2026-1038",
        incidentSlug: "port-customs-edi-interface-contract-breakdown",
        incidentTitle: "Port Customs EDI Schema Cascade",
        timestampSeconds: 162,
        timecodeLabel: "02:42",
        toolApplied: "The Trowel",
      },
    ],
    transcriptSections: {
      weeklyTelemetry: `The 24-Inch Gauge and Alert Fatigue & Signal Loss led the Trestleboard this week, anchored by the multi-center clinical EHR medication warning study (#CAB-2026-1039), the West Coast port customs EDI schema cutover (#CAB-2026-1038), and the state pension mainframe modernization audit (#CAB-2026-1037). Two systemic anti-patterns dominated the docket: organizations treating operator attention as a free, inexhaustible buffer, and upstream authorities breaking shared interface contracts without backward-compatible mortar.`,
      separatingSignalFromPanic: `When the clinical informatics study (#CAB-2026-1039) showed physicians overriding ninety-four percent of medication pop-ups within two seconds, pundits called for stricter clinician training. Systems engineering points to the opposite conclusion: when compliance committees add 114 modal interrupts per shift to transfer legal liability downward, they exhaust the cognitive error budget and train operators to auto-dismiss everything. Similarly, the fourteen-thousand-container port backup (#CAB-2026-1038) wasn't a macroeconomic trade freeze—it was an unversioned JSON validator rejecting dry-freight manifests over an optional hazmat field.`,
      forwardPosture: `Going into next week, apply The 24-Inch Gauge to every interruptive rule in your governance and alerting queues: if an alert does not require immediate human action, delete or demote it so true Tier-1 warnings regain their weight. And where your systems meet external partners, use The Trowel—version your schemas, run dual-read windows, and never let a strict parser halt physical throughput when a dead-letter queue can preserve flow.`,
    },
    transcript: `[00:00 — THE WEEKLY TELEMETRY]
The 24-Inch Gauge and Alert Fatigue & Signal Loss led the Trestleboard this week, anchored by the multi-center clinical EHR medication warning study (#CAB-2026-1039), the West Coast port customs EDI schema cutover (#CAB-2026-1038), and the state pension mainframe modernization audit (#CAB-2026-1037). Two systemic anti-patterns dominated the docket: organizations treating operator attention as a free, inexhaustible buffer, and upstream authorities breaking shared interface contracts without backward-compatible mortar.

[01:15 — SEPARATING SIGNAL FROM PANIC]
When the clinical informatics study (#CAB-2026-1039) showed physicians overriding ninety-four percent of medication pop-ups within two seconds, pundits called for stricter clinician training. Systems engineering points to the opposite conclusion: when compliance committees add 114 modal interrupts per shift to transfer legal liability downward, they exhaust the cognitive error budget and train operators to auto-dismiss everything. Similarly, the fourteen-thousand-container port backup (#CAB-2026-1038) wasn't a macroeconomic trade freeze—it was an unversioned JSON validator rejecting dry-freight manifests over an optional hazmat field.

[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]
Going into next week, apply The 24-Inch Gauge to every interruptive rule in your governance and alerting queues: if an alert does not require immediate human action, delete or demote it so true Tier-1 warnings regain their weight. And where your systems meet external partners, use The Trowel—version your schemas, run dual-read windows, and never let a strict parser halt physical throughput when a dead-letter queue can preserve flow.`,
  },
  {
    id: "ep-legacy-012",
    slug: "legacy-cab-012-blameless-postmortems-and-the-rough-ashlar",
    episodeNumber: 12,
    series: "legacy_archive",
    title: "Legacy Archive #12: Blameless Post-Mortems, The Rough Ashlar, and Why Firing the Operator Guarantees a Repeat Outage",
    summary:
      "Original full-length Change Advisory Board deep-dive episode from the pre-automation archive. Exploring the historical origins of blameless aviation and SRE post-mortems alongside the operative use of The Common Gavel.",
    publishedAt: "2025-04-18T14:00:00Z",
    durationSeconds: 1640,
    durationFormatted: "27:20",
    fileSizeBytes: 26240000,
    audioUrl: "/audio/cab-episode-012-rough-ashlar.mp3",
    dominantTool: "Common Gavel",
    dominantFailureMode: "Blame Culture vs. Root-Cause Isolation",
    incidentMarkers: [
      {
        incidentId: "inc-1040",
        incidentCode: "#CAB-2026-1040",
        incidentSlug: "subcommittee-hearing-airspace-notam-blame-isolation",
        incidentTitle: "Related Modern Pattern: Airspace Dispatch Blame Isolation",
        timestampSeconds: 420,
        timecodeLabel: "07:00",
        toolApplied: "Common Gavel",
      },
    ],
    transcript: `[ARCHIVE TRANSCRIPT — EPISODE 12]
Welcome to the Change Advisory Board. In today's deep dive, we examine why human institutions default to scapegoating during high-visibility outages, and how both Site Reliability Engineering and the Masonic tradition offer a more durable path.

When an outage hits the front page, the first impulse of an unexamined hierarchy is to find the last human hand that touched the control plane and sever it. It feels decisive. It gives the board or the committee a clean headline before the weekend. Yet in distributed systems engineering, we learned decades ago that human error is never the root cause—it is the symptom of a system whose guardrails, affordances, and error budgets were already compromised.

In the lodge, we speak of the Rough Ashlar and the Common Gavel. We do not strike the stone to destroy it; we chip away the superfluous projections—fear, vanity, defensive posturing—so the true geometry underneath can be measured and squared...`,
  },
  {
    id: "ep-legacy-011",
    slug: "legacy-cab-011-error-budgets-and-the-twenty-four-inch-gauge",
    episodeNumber: 11,
    series: "legacy_archive",
    title: "Legacy Archive #11: Error Budgets, Toil Caps, and the Twenty-Four-Inch Gauge in Civic Life",
    summary:
      "Original Change Advisory Board archive episode examining how SRE error budgets quantify the tension between innovation velocity and stability, and how citizens can apply the 24-Inch Gauge to modern media consumption.",
    publishedAt: "2025-03-28T14:00:00Z",
    durationSeconds: 1515,
    durationFormatted: "25:15",
    fileSizeBytes: 24240000,
    audioUrl: "/audio/cab-episode-011-error-budgets.mp3",
    dominantTool: "24-Inch Gauge",
    dominantFailureMode: "Alert Fatigue & Signal Loss",
    incidentMarkers: [
      {
        incidentId: "inc-1039",
        incidentCode: "#CAB-2026-1039",
        incidentSlug: "hospital-ehr-alert-fatigue-override-telemetry",
        incidentTitle: "Related Modern Pattern: Clinical Alert Fatigue Study",
        timestampSeconds: 310,
        timecodeLabel: "05:10",
        toolApplied: "24-Inch Gauge",
      },
    ],
    transcript: `[ARCHIVE TRANSCRIPT — EPISODE 11]
Every system has a finite capacity for change before its reliability degrades, and every human mind has a finite capacity for interrupts before its judgment degrades. In Site Reliability Engineering, we formalize this through the Error Budget and the 50% toil cap: if an on-call team spends more than half its hours extinguishing repetitive fires, feature deployments freeze until engineering bandwidth is reinvested in automation and root-cause remediation.

Now apply the 24-Inch Gauge to how we consume civic news. The modern outrage machine is an unthrottled pager that pages at P0 severity every twelve minutes...`,
  },
  {
    id: "ep-legacy-010",
    slug: "legacy-cab-010-slas-slos-and-trying-the-plumb",
    episodeNumber: 10,
    series: "legacy_archive",
    title: "Legacy Archive #10: SLAs, SLOs, SLIs, and Trying the Wall by The Plumb",
    summary:
      "Original Change Advisory Board archive episode dissecting the difference between external promises (SLAs), internal objectives (SLOs), and actual measurements (SLIs)—and why The Plumb never bends to quarterly politics.",
    publishedAt: "2025-03-07T14:00:00Z",
    durationSeconds: 1710,
    durationFormatted: "28:30",
    fileSizeBytes: 27360000,
    audioUrl: "/audio/cab-episode-010-trying-the-plumb.mp3",
    dominantTool: "The Plumb",
    dominantFailureMode: "Single Point of Failure (SPOF) / Untested Failover",
    incidentMarkers: [
      {
        incidentId: "inc-1041",
        incidentCode: "#CAB-2026-1041",
        incidentSlug: "interbank-settlement-gateway-certificate-cascade",
        incidentTitle: "Related Modern Pattern: Interbank TLS Failover Halt",
        timestampSeconds: 540,
        timecodeLabel: "09:00",
        toolApplied: "The Plumb",
      },
    ],
    transcript: `[ARCHIVE TRANSCRIPT — EPISODE 10]
A plumb line works because gravity cannot be lobbied. You can repaint a leaning wall, you can issue a press release declaring the masonry vertical, or you can redefine 'upright' in a committee memo—but the lead weight on the cord still points to the center of the earth.

In systems engineering, Service Level Indicators (SLIs) are our plumb line. The danger begins when organizations confuse the indicator with the public relations narrative...`,
  },
];

export const INITIAL_PIPELINE_RUNS: PipelineRunRecord[] = [
  {
    id: "run-20261016-1800",
    runType: "rss_ingest",
    startedAt: "2026-10-16T18:00:00Z",
    completedAt: "2026-10-16T18:00:04Z",
    itemsEvaluated: 34,
    itemsAccepted: 3,
    itemsRejectedNoise: 31,
    avgClassifierLatencyMs: 124,
    status: "nominal",
    notes: "Evaluated Reuters, Ars Technica, AP, HN feeds. 91.2% noise filtered at System-1 Jev gate (<0.75 threshold).",
  },
  {
    id: "run-20261016-1200",
    runType: "weekly_rollup",
    startedAt: "2026-10-16T12:00:00Z",
    completedAt: "2026-10-16T12:00:06Z",
    itemsEvaluated: 7,
    itemsAccepted: 1,
    itemsRejectedNoise: 0,
    avgClassifierLatencyMs: 118,
    status: "nominal",
    notes: "Generated Friday 5-Minute CAB Weekly Brief #42 (748 words, Zero Definitions verified).",
  },
  {
    id: "run-20261016-0600",
    runType: "rss_ingest",
    startedAt: "2026-10-16T06:00:00Z",
    completedAt: "2026-10-16T06:00:04Z",
    itemsEvaluated: 41,
    itemsAccepted: 2,
    itemsRejectedNoise: 39,
    avgClassifierLatencyMs: 131,
    status: "nominal",
    notes: "Scheduled 6h ingestion sweep completed cleanly.",
  },
  {
    id: "run-20261015-1800",
    runType: "rss_ingest",
    startedAt: "2026-10-15T18:00:00Z",
    completedAt: "2026-10-15T18:00:05Z",
    itemsEvaluated: 38,
    itemsAccepted: 2,
    itemsRejectedNoise: 36,
    avgClassifierLatencyMs: 129,
    status: "nominal",
    notes: "Deduplicated 19 existing GUID hashes; classified 19 net-new items.",
  },
];
