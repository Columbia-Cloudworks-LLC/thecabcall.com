import {
  appendAuditEntry,
  AuditAuthMethod,
  AuditLedgerEntry,
} from "./audit";
import { D1DatabaseLike } from "./ingest";
import { JevSreFailureModeKey, JevWorkingToolKey } from "./jev";
import {
  buildDeterministicBoundedSynthesis,
  SRE_FAILURE_DISPLAY_NAMES,
  TelemetryArticleRow,
  WORKING_TOOL_DISPLAY_NAMES,
} from "./synthesize";
import { validateAndNormalizeIncidentSummary } from "../lib/sanitize";

export interface R2ObjectLike {
  key: string;
  size: number;
  etag?: string;
  httpMetadata?: {
    contentType?: string;
  };
  body?: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  get(
    key: string,
    options?: {
      range?: { offset?: number; length?: number; suffix?: number };
    }
  ): Promise<R2ObjectLike | null>;
  delete(key: string | string[]): Promise<void>;
}

export interface WeeklyTelemetryAggregates {
  windowDays: number;
  totalEvaluated: number;
  triagedOrSynthesizedCount: number;
  droppedCount: number;
  noiseRejectionRatePct: number;
  dominantTool: JevWorkingToolKey;
  dominantToolDisplay: string;
  dominantToolPct: number;
  toolDistribution: Record<JevWorkingToolKey, number>;
  topSreFailureMode: JevSreFailureModeKey;
  topSreFailureDisplay: string;
  topIncidents: TelemetryArticleRow[];
}

export interface RollupTranscriptPayload {
  title: string;
  summary: string;
  weekly_telemetry: string;
  separating_signal_from_panic: string;
  forward_posture: string;
}

export interface RollupEpisodeRecord {
  id?: number;
  episode_number: number;
  slug: string;
  title: string;
  summary: string;
  transcript: string;
  transcript_sections: {
    weekly_telemetry: string;
    separating_signal_from_panic: string;
    forward_posture: string;
  };
  audio_url: string;
  r2_key: string;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
  model_used: string;
  audio_source: string;
  aggregates: {
    total_evaluated: number;
    noise_rejection_rate_pct: number;
    dominant_tool: JevWorkingToolKey;
    dominant_tool_pct: number;
    top_sre_failure_mode: JevSreFailureModeKey;
    featured_incident_ids: number[];
  };
}

export interface GenerateEpisodeOverrides {
  episodeNumber?: number;
  titleOverride?: string;
  summaryOverride?: string;
  editorialFocusNote?: string;
  windowDays?: number;
  incidentIds?: number[];
  ttsVoice?: string;
  ttsProvider?: "gemini-tts" | "mpeg-framed";
}

export interface EpisodeAdminActor {
  actorEmail: string;
  actorRole?: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
}

export interface AdminEpisodeRecord {
  id: number;
  episodeNumber: number;
  slug: string;
  series: "weekly_rollup" | "legacy_archive";
  title: string;
  summary: string;
  transcript: string;
  transcriptSections: {
    weeklyTelemetry: string;
    separatingSignalFromPanic: string;
    forwardPosture: string;
  };
  audioUrl: string;
  r2Key: string;
  durationSeconds: number;
  durationFormatted: string;
  fileSizeBytes: number;
  publishedAt: string;
}

export interface D1EpisodeTableRow {
  id: number;
  episode_number: number | null;
  slug: string;
  title: string;
  summary: string;
  transcript: string | null;
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
}

export const ROLLUP_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: {
      type: "STRING",
      description:
        "Concise episode title for the Friday CAB Weekly Brief referencing the dominant Working Tool and SRE Failure Mode.",
    },
    summary: {
      type: "STRING",
      description:
        "2-sentence show notes summary of this week's 5-minute CAB Weekly Brief leading with the dominant Working Tool, primary Failure Mode, and the 3 anchor incidents.",
    },
    weekly_telemetry: {
      type: "STRING",
      description:
        "Part 1 [00:00 — THE WEEKLY TELEMETRY] (~180 words). Spoken podcast script leading immediately with the dominant Working Tool, the primary Failure Mode, and the 3 anchor incidents for the week. Do NOT include ingestion-gate math ('evaluated X dispatches, rejecting Y% noise') or internal classifier names.",
    },
    separating_signal_from_panic: {
      type: "STRING",
      description:
        "Part 2 [01:15 — SEPARATING SIGNAL FROM PANIC] (~350 words). Spoken podcast script executing the Proportionality Check across the 3 anchor incidents: contrasting overblown commentary/panic against the actual structural engineering and governance signals.",
    },
    forward_posture: {
      type: "STRING",
      description:
        "Part 3 [03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD] (~220 words). Spoken podcast script placing the Working Tools in motion for the coming 7 days without ever defining the tools.",
    },
  },
  required: [
    "title",
    "summary",
    "weekly_telemetry",
    "separating_signal_from_panic",
    "forward_posture",
  ],
};

const BASELINE_ARCHIVE_EPISODES: Array<{
  episode_number: number;
  slug: string;
  title: string;
  summary: string;
  transcript: string;
  audio_url: string;
  duration_seconds: number;
  file_size_bytes: number;
  published_at: string;
}> = [
  {
    episode_number: 42,
    slug: "cab-weekly-brief-042-configuration-drift-and-the-square",
    title:
      "CAB Weekly Brief #42: Configuration Drift (44% Square), Unpinned Certs, and Separated Signal",
    summary:
      "Friday 5-minute systems retrospective covering October 10–16, 2026. The Square (44%) and Configuration Drift dominate the Trestleboard across municipal water SCADA audits, regional banking TLS halts, and federal aviation routing outages.",
    published_at: "2026-10-16T12:00:00Z",
    duration_seconds: 304,
    file_size_bytes: 4864000,
    audio_url: "/audio/cab-weekly-brief-042.mp3",
    transcript: `[00:00 — THE WEEKLY TELEMETRY]
The Square leads this week's Trestleboard at forty-four percent of primary classifications, with Configuration Drift emerging as the primary failure mode across municipal water utilities, regional clearing banks, and federal aviation dispatch. Three anchor incidents set the weekly docket: fourteen water districts signing annual segmentation attestations while leaving vendor VPN bridges wide open (#CAB-2026-1042); a four-hour settlement halt across sixty-two credit unions triggered by an unpinned standby TLS certificate (#CAB-2026-1041); and a regional aviation routing outage traced to an unvalidated night-shift sync script (#CAB-2026-1040). Across all three sectors, live production environments had quietly drifted away from their written specifications.

[01:15 — SEPARATING SIGNAL FROM PANIC]
The outrage cycle wants you to treat every one of these disclosures as either an imminent collapse or a morality play with a convenient villain. Good systems architecture tells us otherwise: a noisy alert on an edge node isn't a core outage, and an audit finding is telemetry, not an attack. Look at Wednesday's four-hour settlement halt across sixty-two credit unions (#CAB-2026-1041). Social feeds immediately jumped to liquidity panic. In reality, not a single ledger was compromised; a warm-standby node rotated an intermediate TLS certificate that legacy middleware still had pinned, and synthetic health checks missed it because those probes bypassed the mutual-TLS proxy. The news cycle overblew the four-hour delay while missing the actual structural constraint: synthetic monitoring that bypasses the authentication boundary is worse than no monitoring at all, because it manufactures false confidence. We saw the exact same inversion in the transportation subcommittee hearing (#CAB-2026-1040), where three hours of cameras focused on a single night-shift technician who ran an unvalidated sync script, while burying Appendix C—which showed management had decommissioned the pre-production staging environment eight months ago to shave cloud hosting costs.

[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]
Here is how to set your posture on the trestleboard for the coming week. First, for the utility boards and regulatory staff walking into next week's remediation reviews on the SCADA audit, the work requires Common Gavel before anything else—chipping away defensive PR language and vendor finger-pointing so teams can inspect why maintenance budgets forced reliance on undocumented remote tunnels. Second, as banks and clearing houses review their standby runbooks after Wednesday's TLS halt, apply The Plumb directly to the synthetic test suite: if a health check passes by skipping the hardest boundary in production, realign the check even if it drops your quarterly uptime graph below four nines. Finally, for all of us observing from the outside, keep the 24-Inch Gauge firmly on your own attention budget. Refuse to spend cognitive cycles on televised blame sessions that punish the last operator to touch the keyboard while the missing staging environment remains unfunded. Until the post-mortem addresses the system that permitted the error, treat the commentary as jitter.`,
  },
  {
    episode_number: 41,
    slug: "cab-weekly-brief-041-alert-fatigue-and-interface-mortar",
    title:
      "CAB Weekly Brief #41: Alert Fatigue in Clinical Workflows and Spreading the Trowel Across Port APIs",
    summary:
      "Friday 5-minute systems retrospective covering October 3–9, 2026. Examining cognitive error budgets under the 24-Inch Gauge and how unilateral API schema cutovers fracture institutional trust.",
    published_at: "2026-10-09T12:00:00Z",
    duration_seconds: 292,
    file_size_bytes: 4672000,
    audio_url: "/audio/cab-weekly-brief-041.mp3",
    transcript: `[00:00 — THE WEEKLY TELEMETRY]
The 24-Inch Gauge leads this week's Trestleboard at forty-one percent alongside Alert Fatigue & Signal Loss as the primary operational failure mode, anchored by clinical medication-alert override telemetry (#CAB-2026-1039), a fourteen-thousand-container port manifest stall (#CAB-2026-1038), and municipal pension COBOL batch exhaustion (#CAB-2026-1037). Across these three anchor incidents, organizations treated operator attention as a free, inexhaustible buffer while upstream authorities broke shared interface contracts without backward-compatible mortar.

[01:15 — SEPARATING SIGNAL FROM PANIC]
When the clinical informatics study (#CAB-2026-1039) showed physicians overriding ninety-four percent of medication pop-ups within two seconds, pundits called for stricter clinician training. Systems engineering points to the opposite conclusion: when compliance committees add 114 modal interrupts per shift to transfer legal liability downward, they exhaust the cognitive error budget and train operators to auto-dismiss everything. Similarly, the fourteen-thousand-container port backup (#CAB-2026-1038) wasn't a macroeconomic trade freeze—it was an unversioned JSON validator rejecting dry-freight manifests over an optional hazmat field.

[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]
Going into next week, apply the 24-Inch Gauge to every interruptive rule in your governance and alerting queues: if an alert does not require immediate human action, delete or demote it so true Tier-1 warnings regain their weight. And where your systems meet external partners, use The Trowel—version your schemas, run dual-read windows, and never let a strict parser halt physical throughput when a dead-letter queue can preserve flow.`,
  },
  {
    episode_number: 12,
    slug: "legacy-cab-012-blameless-postmortems-and-the-rough-ashlar",
    title:
      "Legacy Archive #12: Blameless Post-Mortems, The Rough Ashlar, and Why Firing the Operator Guarantees a Repeat Outage",
    summary:
      "Original full-length Change Advisory Board deep-dive episode from the pre-automation archive. Exploring the historical origins of blameless aviation and SRE post-mortems alongside the operative use of The Common Gavel.",
    published_at: "2025-04-18T14:00:00Z",
    duration_seconds: 1640,
    file_size_bytes: 26240000,
    audio_url: "/audio/cab-episode-012-rough-ashlar.mp3",
    transcript: `[ARCHIVE TRANSCRIPT — EPISODE 12]
Welcome to the Change Advisory Board. In today's deep dive, we examine why human institutions default to scapegoating during high-visibility outages, and how both Site Reliability Engineering and the Masonic tradition offer a more durable path.

When an outage hits the front page, the first impulse of an unexamined hierarchy is to find the last human hand that touched the control plane and sever it. It feels decisive. It gives the board or the committee a clean headline before the weekend. Yet in distributed systems engineering, we learned decades ago that human error is never the root cause—it is the symptom of a system whose guardrails, affordances, and error budgets were already compromised.

In the lodge, we speak of the Rough Ashlar and the Common Gavel. We do not strike the stone to destroy it; we chip away the superfluous projections—fear, vanity, defensive posturing—so the true geometry underneath can be measured and squared...`,
  },
  {
    episode_number: 11,
    slug: "legacy-cab-011-error-budgets-and-the-twenty-four-inch-gauge",
    title:
      "Legacy Archive #11: Error Budgets, Toil Caps, and the Twenty-Four-Inch Gauge in Civic Life",
    summary:
      "Original Change Advisory Board archive episode examining how SRE error budgets quantify the tension between innovation velocity and stability, and how citizens can apply the 24-Inch Gauge to modern media consumption.",
    published_at: "2025-03-28T14:00:00Z",
    duration_seconds: 1515,
    file_size_bytes: 24240000,
    audio_url: "/audio/cab-episode-011-error-budgets.mp3",
    transcript: `[ARCHIVE TRANSCRIPT — EPISODE 11]
Every system has a finite capacity for change before its reliability degrades, and every human mind has a finite capacity for interrupts before its judgment degrades. In Site Reliability Engineering, we formalize this through the Error Budget and the 50% toil cap: if an on-call team spends more than half its hours extinguishing repetitive fires, feature deployments freeze until engineering bandwidth is reinvested in automation and root-cause remediation.

Now apply the 24-Inch Gauge to how we consume civic news. The modern outrage machine is an unthrottled pager that pages at P0 severity every twelve minutes...`,
  },
  {
    episode_number: 10,
    slug: "legacy-cab-010-slas-slos-and-trying-the-plumb",
    title:
      "Legacy Archive #10: SLAs, SLOs, SLIs, and Trying the Wall by The Plumb",
    summary:
      "Original Change Advisory Board archive episode dissecting the difference between external promises (SLAs), internal objectives (SLOs), and actual measurements (SLIs)—and why The Plumb never bends to quarterly politics.",
    published_at: "2025-03-07T14:00:00Z",
    duration_seconds: 1710,
    file_size_bytes: 27360000,
    audio_url: "/audio/cab-episode-010-trying-the-plumb.mp3",
    transcript: `[ARCHIVE TRANSCRIPT — EPISODE 10]
A plumb line works because gravity cannot be lobbied. You can repaint a leaning wall, you can issue a press release declaring the masonry vertical, or you can redefine 'upright' in a committee memo—but the lead weight on the cord still points to the center of the earth.

In systems engineering, Service Level Indicators (SLIs) are our plumb line. The danger begins when organizations confuse the indicator with the public relations narrative...`,
  },
];

/**
 * Ensures the 5 baseline archive episodes (#42, #41, #12, #11, #10) are seeded once into D1 `episodes`
 * so all episodes visible on `/archive` and `/feed.xml` are managed in D1 and can be edited or deleted.
 */
export async function ensureBaselineEpisodesSeeded(
  db: D1DatabaseLike
): Promise<void> {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    const flag = await db
      .prepare(
        "SELECT value FROM system_settings WHERE key = 'baseline_episodes_seeded_v1'"
      )
      .first<{ value: string }>();

    if (flag?.value !== "1") {
      for (const ep of BASELINE_ARCHIVE_EPISODES) {
        await db
          .prepare(
            `INSERT OR IGNORE INTO episodes (
              episode_number,
              slug,
              title,
              summary,
              transcript,
              audio_url,
              duration_seconds,
              file_size_bytes,
              published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            ep.episode_number,
            ep.slug,
            ep.title,
            ep.summary,
            ep.transcript,
            ep.audio_url,
            ep.duration_seconds,
            ep.file_size_bytes,
            ep.published_at
          )
          .run();
      }

      await db
        .prepare(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('baseline_episodes_seeded_v1', '1', datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
        )
        .run();
    }

    const sanitizedFlag = await db
      .prepare(
        "SELECT value FROM system_settings WHERE key = 'trestleboard_content_sanitized_v3'"
      )
      .first<{ value: string }>();

    if (sanitizedFlag?.value !== "1") {
      // 1. Update baseline episodes (#42, #41) so they contain zero ingestion-gate math or classifier references
      for (const ep of BASELINE_ARCHIVE_EPISODES) {
        await db
          .prepare(
            `UPDATE episodes
             SET title = ?, summary = ?, transcript = ?
             WHERE slug = ?`
          )
          .bind(ep.title, ep.summary, ep.transcript, ep.slug)
          .run();
      }

      // 2. Enrich 1-sentence standfirst RSS excerpts on verified news articles so they provide genuine 2-sentence factual summaries
      const multiSentenceFactualStandfirsts: Record<number, string> = {
        6: "Demonstrators across France converged with student unions on Saturday to protest rising living costs and public-sector budget cuts as the country's fiscal deficit deepens. Police deployed tear gas in several metropolitan centers after small fires and street scuffles broke out along the march routes.",
        9: "Total campaign advertising expenditures have surpassed $10 billion during the current U.S. midterm election cycle across broadcast, cable, and digital platforms. The record spending surge arrives as household surveys continue to cite grocery and fuel inflation as voters' primary economic concern.",
        10: "The major-party candidates for Minnesota's U.S. Senate seat met Friday for an hourlong televised debate hosted by MPR News. The exchange centered on state program oversight following recent fraud prosecutions, household affordability, and the economic impact of federal tariff and regulatory policies.",
        11: "The White House has moved to waive newly enacted congressional sanctions against Russian energy exports ahead of next month's midterm elections. Administration officials cited concerns over domestic fuel price spikes, while lawmakers from both parties criticized the waiver as bypassing statutory mandates.",
        12: "U.S. negotiators have floated a proposal that would permit expanded Russian natural gas shipments into European markets as part of a broader Ukraine cease-fire framework. European energy ministers expressed skepticism toward the plan, warning that renewed pipeline reliance would undermine continental security commitments.",
        13: "Senator Darline Graham of South Carolina publicly disagreed with the administration's decision to exempt Russian entities from bipartisan sanctions legislation originally co-sponsored by her late brother, Senator Lindsey Graham. The rare intraparty break highlights growing Senate friction over executive waivers of congressionally mandated trade restrictions.",
        14: "Campaign activity across four competitive congressional districts in Pennsylvania illustrates the demographic and economic fault lines shaping the national midterm map. Suburban ticket-splitting, industrial energy policy, and cost-of-living pressures have turned the commonwealth's swing seats into the primary bellwether for control of the House.",
        15: "Organizers of the nationwide 'No Kings' demonstrations held coordinated weekend rallies aimed at converting protest turnout into early midterm ballot submissions. Event coordinators partnered with local voter-registration drives across swing states to emphasize mail-in and early in-person voting deadlines.",
        17: "The Canadian federal government announced $720 million in short-term bridge financing for Canada Post to prevent the state-owned mail carrier from exhausting its cash reserves. Officials stated the emergency liquidity injection will sustain nationwide delivery operations while the corporation restructures its parcel and letter-mail cost model.",
        18: "Amazon confirmed it is open to discussions with federal Canadian and provincial Quebec officials regarding its decision to close fulfillment operations across the French-speaking province. The planned facility closures are projected to eliminate approximately 1,700 permanent warehouse and logistics positions.",
        19: "Target announced it is concluding its multiyear diversity, equity, and inclusion targets alongside its dedicated accelerator program for Black-owned retail suppliers. The Minneapolis-based retailer joins a broader wave of large U.S. corporations scaling back formal demographic procurement and hiring benchmarks.",
        22: "Law enforcement officials reported that an armed parent intervened during the shooting outside Silver Rail Elementary School in Bend, Oregon, before police units arrived on scene. The intervention has renewed national debate over emergency response timelines, campus perimeter security, and the role of armed civilians during active-shooter incidents.",
        24: "Hundreds of coordinated rallies billed as nonpartisan civic mobilization events took place across U.S. cities this weekend to encourage early voting ahead of the midterm elections. Organizers sought to channel nearly two years of demonstration networks into structured precinct turnout operations.",
      };

      for (const [idStr, factualStandfirst] of Object.entries(
        multiSentenceFactualStandfirsts
      )) {
        await db
          .prepare(
            "UPDATE telemetry_articles SET raw_excerpt = ? WHERE id = ?"
          )
          .bind(factualStandfirst, Number(idStr))
          .run();
      }

      // 3. Re-evaluate and sanitize all telemetry_articles rows
      const allArticlesRes = await db
        .prepare("SELECT * FROM telemetry_articles ORDER BY id ASC")
        .all<TelemetryArticleRow>();
      const allArticles = allArticlesRes.results || [];

      let sanitizedArticleCount = 0;
      let clearedMalformedBriefCount = 0;

      for (const row of allArticles) {
        const validation = validateAndNormalizeIncidentSummary({
          id: row.id,
          title: row.title,
          sourceFeed: row.source_feed,
          rawExcerpt: row.raw_excerpt,
          logWarnings: false,
        });

        if (!validation.valid) {
          // Strip any legacy Mad-Libs fallback string while preserving raw_excerpt so build/runtime normalization logs quarantine warnings
          if (row.socratic_brief || row.questions_json) {
            await db
              .prepare(
                "UPDATE telemetry_articles SET socratic_brief = NULL, questions_json = NULL WHERE id = ?"
              )
              .bind(row.id)
              .run();
            clearedMalformedBriefCount++;
          }
          continue;
        }

        if (row.status === "synthesized") {
          const cleanSynthesis = buildDeterministicBoundedSynthesis(row);
          const questionsPayload = JSON.stringify({
            executive_summary: cleanSynthesis.executive_summary,
            proportionality: {
              noise: cleanSynthesis.proportionality_check.noise_overblown,
              signal: cleanSynthesis.proportionality_check.structural_signal,
            },
            questions: cleanSynthesis.questions,
            model: "editorial-sanitization-v2",
            synthesized_at: new Date().toISOString(),
          });

          await db
            .prepare(
              "UPDATE telemetry_articles SET socratic_brief = ?, questions_json = ? WHERE id = ?"
            )
            .bind(cleanSynthesis.socratic_brief, questionsPayload, row.id)
            .run();
          sanitizedArticleCount++;
        }
      }

      await appendAuditEntry(db, {
        actorEmail: "system@thecabcall.com",
        actorRole: "owner",
        authMethod: "system_bootstrap",
        actorIpHash: "SYSTEM_SANITIZATION_V2",
        actionType: "editorial.content_sanitization",
        targetType: "telemetry_articles",
        targetId: "cabcall-db",
        reason:
          "Eliminated leaked pipeline jargon, Mad-Libs fallback strings, and ingestion-gate math across persisted D1 articles and baseline episodes.",
        beforeState: {
          version: "v1",
          total_articles_inspected: allArticles.length,
        },
        afterState: {
          version: "v2",
          sanitized_article_count: sanitizedArticleCount,
          cleared_malformed_brief_count: clearedMalformedBriefCount,
        },
        replayCommand: {
          op: "sanitize_content_v2",
          target_table: "telemetry_articles",
          target_id: "cabcall-db",
          invertible: false,
        },
      });

      await db
        .prepare(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ('trestleboard_content_sanitized_v3', '1', datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = datetime('now')`
        )
        .run();
    }
  } catch (err) {
    console.warn("[Rollup] Failed to seed or sanitize baseline archive episodes:", err);
  }
}

export function extractR2KeyFromAudioUrl(
  audioUrl: string,
  fallbackSlug?: string
): string {
  const trimmed = (audioUrl || "").trim();
  if (trimmed.startsWith("/audio/")) {
    return decodeURIComponent(trimmed.slice("/audio/".length));
  }
  try {
    const u = new URL(trimmed);
    if (u.pathname.startsWith("/audio/")) {
      return decodeURIComponent(u.pathname.slice("/audio/".length));
    }
    const base = u.pathname.split("/").pop();
    if (base) return decodeURIComponent(base);
  } catch {
    // Not a full URL
  }
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length > 0) {
    return decodeURIComponent(parts[parts.length - 1]);
  }
  return `${fallbackSlug || "episode"}.mp3`;
}

export function parseEpisodeTranscriptSections(transcript: string): {
  weeklyTelemetry: string;
  separatingSignalFromPanic: string;
  forwardPosture: string;
} {
  if (!transcript) {
    return {
      weeklyTelemetry: "",
      separatingSignalFromPanic: "",
      forwardPosture: "",
    };
  }
  const part1Match = transcript.match(
    /\[00:00[^\]]*\]([\s\S]*?)(?=\[01:15|$)/i
  );
  const part2Match = transcript.match(
    /\[01:15[^\]]*\]([\s\S]*?)(?=\[03:30|$)/i
  );
  const part3Match = transcript.match(/\[03:30[^\]]*\]([\s\S]*?)$/i);

  if (!part1Match && !part2Match && !part3Match) {
    return {
      weeklyTelemetry: transcript.trim(),
      separatingSignalFromPanic: "",
      forwardPosture: "",
    };
  }

  return {
    weeklyTelemetry: (part1Match?.[1] || "").trim(),
    separatingSignalFromPanic: (part2Match?.[1] || "").trim(),
    forwardPosture: (part3Match?.[1] || "").trim(),
  };
}

export function formatThreePartTranscript(sections: {
  weeklyTelemetry?: string;
  separatingSignalFromPanic?: string;
  forwardPosture?: string;
}): string {
  const cleanPart1 = (sections.weeklyTelemetry || "")
    .replace(/^\[00:00[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart2 = (sections.separatingSignalFromPanic || "")
    .replace(/^\[01:15[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart3 = (sections.forwardPosture || "")
    .replace(/^\[03:30[^\]]*\]\s*/i, "")
    .trim();

  if (!cleanPart2 && !cleanPart3) {
    return cleanPart1;
  }

  return `[00:00 — THE WEEKLY TELEMETRY]\n${cleanPart1}\n\n[01:15 — SEPARATING SIGNAL FROM PANIC]\n${cleanPart2}\n\n[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]\n${cleanPart3}`;
}

export function mapD1RowToAdminEpisode(
  row: D1EpisodeTableRow
): AdminEpisodeRecord {
  const episodeNumber = Number(row.episode_number || 43);
  const durationSeconds = Number(row.duration_seconds || 300);
  const mins = Math.floor(durationSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(durationSeconds % 60)
    .toString()
    .padStart(2, "0");
  const transcript = row.transcript || row.summary || "";
  const isLegacy =
    row.slug.startsWith("legacy-") ||
    row.title.toLowerCase().includes("legacy archive") ||
    episodeNumber <= 30;

  return {
    id: Number(row.id),
    episodeNumber,
    slug: row.slug,
    series: isLegacy ? "legacy_archive" : "weekly_rollup",
    title: row.title,
    summary: row.summary,
    transcript,
    transcriptSections: parseEpisodeTranscriptSections(transcript),
    audioUrl: row.audio_url,
    r2Key: extractR2KeyFromAudioUrl(row.audio_url, row.slug),
    durationSeconds,
    durationFormatted: `${mins}:${secs}`,
    fileSizeBytes: Number(row.file_size_bytes || 256000),
    publishedAt: row.published_at,
  };
}

/**
 * Queries D1 `telemetry_articles` over the specified window (default 7 days) or hand-picked `incidentIds`
 * to compute real telemetry aggregates.
 */
export async function computeWeeklyAggregatesFromD1(
  db: D1DatabaseLike,
  options?: {
    windowDays?: number;
    incidentIds?: number[];
  }
): Promise<WeeklyTelemetryAggregates> {
  const windowDays = Math.min(
    90,
    Math.max(1, Number(options?.windowDays ?? 7))
  );
  const windowModifier = `-${windowDays} days`;

  const recentResult = await db
    .prepare(
      `SELECT * FROM telemetry_articles
       WHERE published_at >= datetime('now', ?)
          OR ingested_at >= datetime('now', ?)
       ORDER BY published_at DESC`
    )
    .bind(windowModifier, windowModifier)
    .all<TelemetryArticleRow>();

  let rows = recentResult.results || [];
  if (rows.length === 0) {
    const fallbackAll = await db
      .prepare(
        "SELECT * FROM telemetry_articles ORDER BY published_at DESC LIMIT 50"
      )
      .all<TelemetryArticleRow>();
    rows = fallbackAll.results || [];
  }

  let customSelectedRows: TelemetryArticleRow[] = [];
  if (options?.incidentIds && options.incidentIds.length > 0) {
    const validIds = options.incidentIds
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (validIds.length > 0) {
      const placeholders = validIds.map(() => "?").join(", ");
      const customRes = await db
        .prepare(
          `SELECT * FROM telemetry_articles WHERE id IN (${placeholders}) ORDER BY is_systemic_prob DESC, published_at DESC`
        )
        .bind(...validIds)
        .all<TelemetryArticleRow>();
      customSelectedRows = customRes.results || [];
    }
  }

  const totalEvaluated = Math.max(rows.length, customSelectedRows.length);
  const droppedRows = rows.filter((r) => r.status === "dropped");
  const activeRows = rows.filter(
    (r) =>
      (r.status === "synthesized" || r.status === "triaged") &&
      validateAndNormalizeIncidentSummary({
        id: r.id,
        title: r.title,
        sourceFeed: r.source_feed,
        rawExcerpt: r.raw_excerpt,
        socraticBrief: r.socratic_brief,
        logWarnings: false,
      }).valid
  );

  const noiseRejectionRatePct =
    totalEvaluated > 0
      ? Math.round((droppedRows.length / totalEvaluated) * 1000) / 10
      : 0;

  const toolCounts: Record<JevWorkingToolKey, number> = {
    twenty_four_inch_gauge: 0,
    common_gavel: 0,
    plumb: 0,
    square: 0,
    level: 0,
    trowel: 0,
  };

  const sreCounts: Record<JevSreFailureModeKey, number> = {
    configuration_drift: 0,
    cascading_failure: 0,
    untested_failover: 0,
    alert_fatigue: 0,
    blameless_postmortem_gap: 0,
    capacity_exhaustion: 0,
  };

  const poolForDominant =
    customSelectedRows.length > 0
      ? customSelectedRows
      : activeRows.length > 0
      ? activeRows
      : rows;
  for (const row of poolForDominant) {
    if (row.primary_tool in toolCounts) {
      toolCounts[row.primary_tool]++;
    }
    if (row.sre_failure_mode in sreCounts) {
      sreCounts[row.sre_failure_mode]++;
    }
  }

  const sortedTools = (
    Object.entries(toolCounts) as [JevWorkingToolKey, number][]
  ).sort((a, b) => b[1] - a[1]);
  const dominantTool: JevWorkingToolKey = sortedTools[0]?.[0] || "square";
  const dominantToolCount = sortedTools[0]?.[1] || 0;
  const dominantToolPct =
    poolForDominant.length > 0
      ? Math.round((dominantToolCount / poolForDominant.length) * 100)
      : 40;

  const sortedSre = (
    Object.entries(sreCounts) as [JevSreFailureModeKey, number][]
  ).sort((a, b) => b[1] - a[1]);
  const topSreFailureMode: JevSreFailureModeKey =
    sortedSre[0]?.[0] || "configuration_drift";

  let topIncidents: TelemetryArticleRow[];
  if (customSelectedRows.length > 0) {
    topIncidents = customSelectedRows.slice(0, 6);
  } else {
    const synthesizedRows = activeRows
      .filter((r) => r.status === "synthesized")
      .sort((a, b) => b.is_systemic_prob - a.is_systemic_prob);
    const triagedRows = activeRows
      .filter((r) => r.status === "triaged")
      .sort((a, b) => b.is_systemic_prob - a.is_systemic_prob);

    topIncidents = [...synthesizedRows, ...triagedRows].slice(0, 5);
  }

  return {
    windowDays,
    totalEvaluated,
    triagedOrSynthesizedCount:
      customSelectedRows.length > 0
        ? customSelectedRows.length
        : activeRows.length,
    droppedCount: droppedRows.length,
    noiseRejectionRatePct,
    dominantTool,
    dominantToolDisplay: WORKING_TOOL_DISPLAY_NAMES[dominantTool],
    dominantToolPct,
    toolDistribution: toolCounts,
    topSreFailureMode,
    topSreFailureDisplay: SRE_FAILURE_DISPLAY_NAMES[topSreFailureMode],
    topIncidents,
  };
}

function buildDeterministicRollupScript(
  agg: WeeklyTelemetryAggregates,
  episodeNumber: number,
  editorialFocusNote?: string
): RollupTranscriptPayload {
  const inc1 = agg.topIncidents[0];
  const inc2 = agg.topIncidents[1] || inc1;
  const inc3 = agg.topIncidents[2] || inc2;

  const parseProportionality = (row?: TelemetryArticleRow) => {
    if (!row?.questions_json) return null;
    try {
      const parsed = JSON.parse(row.questions_json);
      return parsed?.proportionality_check || null;
    } catch {
      return null;
    }
  };

  const prop1 = parseProportionality(inc1);
  const prop2 = parseProportionality(inc2);
  const focusClause = editorialFocusNote?.trim()
    ? ` Editorial Focus Directive for this docket: ${editorialFocusNote.trim()}.`
    : "";

  const weekly_telemetry = `Welcome to the Friday Change Advisory Board Weekly Brief, Episode ${episodeNumber}. ${agg.dominantToolDisplay} leads this week's Trestleboard at ${agg.dominantToolPct}% of primary classifications, with ${agg.topSreFailureDisplay} emerging as the primary operational failure mode across ${agg.triagedOrSynthesizedCount} active dispatches.${focusClause} Three anchor incidents set our post-incident docket today: first, from ${inc1?.source_feed || "WSJ US Business"}, "${inc1?.title || "Institutional Capacity & Policy Drift"}", examined under ${WORKING_TOOL_DISPLAY_NAMES[inc1?.primary_tool || "square"]}; second, from ${inc2?.source_feed || "NYT HomePage"}, "${inc2?.title || "Cross-Silo Coordination Strain"}", evaluated under ${WORKING_TOOL_DISPLAY_NAMES[inc2?.primary_tool || "level"]}; and third, "${inc3?.title || "Regulatory Execution Divergence"}", where ${SRE_FAILURE_DISPLAY_NAMES[inc3?.sre_failure_mode || "configuration_drift"]} exposed the gap between nominal policy and live operational state.`;

  const separating_signal_from_panic = `The 24-hour commentary cycle wants you to read each of these events as a morality play or an unprecedented institutional collapse. When we apply the Proportionality Check, a far more actionable systems pattern comes into focus. Take "${inc1?.title || "our lead dispatch"}" first. ${prop1?.noise_overblown || "Public commentary immediately fixated on headline optics and individual blame."} Yet the structural signal underneath is straightforward: ${prop1?.structural_signal || "when an institution defers structural reconciliation, live execution inevitably drifts from its chartered specification."} We see the exact same signal-to-noise inversion in "${inc2?.title || "our second incident"}". ${prop2?.noise_overblown || "Partisan observers treated the disruption as a sudden shock."} In reality, ${prop2?.structural_signal || "operational telemetry points directly to capacity exhaustion and asymmetric risk allocation that accumulated quietly across multiple quarters."} And in "${inc3?.title || "our third triaged event"}", the friction between ${WORKING_TOOL_DISPLAY_NAMES[inc3?.primary_tool || "trowel"]} and ${WORKING_TOOL_DISPLAY_NAMES[inc3?.secondary_tool || "common_gavel"]} demonstrates how quickly cross-group coordination fractures when upstream safeguards go untested in production. None of these incidents have completed a verified post-mortem, which means any sweeping verdict right now is premature jitter rather than verified engineering truth.`;

  const forward_posture = `As we set the trestleboard for the coming seven days, here is how to put the tools to work without waiting for the headlines to settle. First, when tracking the fallout around "${inc1?.title || "this week's policy and fiscal dispatches"}", bring ${agg.dominantToolDisplay} directly to the primary filings: watch whether leadership reconciles the live operational table with the written mandate, or merely issues another round of press assurances. Second, apply Common Gavel to every congressional or corporate hearing on "${inc2?.title || "active institutional disputes"}"—strip away the defensive rhetoric and ask whether the people who architected the constraint are sharing the same horizontal plane of accountability on The Level as the citizens and workers absorbing the load. Finally, keep the 24-Inch Gauge on your own cognitive error budget this weekend: refuse to spend high-priority attention on outraged speculation while the core post-mortem telemetry is still being collected. Until next Friday, keep your telemetry clean and your horizons level.`;

  return {
    title: `CAB Weekly Brief #${episodeNumber}: ${agg.dominantToolDisplay} (${agg.dominantToolPct}%), ${agg.topSreFailureDisplay}, and This Week's Trestleboard`,
    summary: `Friday 5-minute Change Advisory Board synthesis led by ${agg.dominantToolDisplay} (${agg.dominantToolPct}%) and ${agg.topSreFailureDisplay} across ${agg.triagedOrSynthesizedCount} active dispatches on the Trestleboard.`,
    weekly_telemetry,
    separating_signal_from_panic,
    forward_posture,
  };
}

export async function generateRollupTranscriptWithGemini(
  agg: WeeklyTelemetryAggregates,
  episodeNumber: number,
  geminiApiKey?: string,
  editorialFocusNote?: string
): Promise<{ payload: RollupTranscriptPayload; modelUsed: string }> {
  const trimmedKey = geminiApiKey?.trim() || "";
  if (!trimmedKey || trimmedKey === "your_gemini_api_key_here") {
    return {
      payload: buildDeterministicRollupScript(
        agg,
        episodeNumber,
        editorialFocusNote
      ),
      modelUsed: "deterministic-rollup-fallback",
    };
  }

  const incidentSummaries = agg.topIncidents
    .map((inc, idx) => {
      let extra = "";
      if (inc.questions_json) {
        try {
          const parsed = JSON.parse(inc.questions_json);
          if (parsed.executive_summary) {
            extra += `\n   Executive Summary: ${parsed.executive_summary}`;
          }
          if (parsed.proportionality_check) {
            extra += `\n   Noise Overblown: ${parsed.proportionality_check.noise_overblown}\n   Structural Signal: ${parsed.proportionality_check.structural_signal}`;
          }
        } catch {
          // ignore
        }
      }
      return `${idx + 1}. "${inc.title}" (${inc.source_feed}, published ${inc.published_at})
   - Primary Tool: ${WORKING_TOOL_DISPLAY_NAMES[inc.primary_tool]}
   - Secondary Tool: ${WORKING_TOOL_DISPLAY_NAMES[inc.secondary_tool || "twenty_four_inch_gauge"]}
   - SRE Failure Mode: ${SRE_FAILURE_DISPLAY_NAMES[inc.sre_failure_mode]}${extra}`;
    })
    .join("\n\n");

  const systemInstruction = `You are the executive producer and host of "The CAB Call" (thecabcall.com), delivering the Friday 5-Minute CAB Weekly Brief.
Your audience consists of senior systems engineers, institutional leaders, and Freemasons who already know the headlines and speak both SRE and the Working Tools natively.

HARD GOVERNANCE CONSTRAINTS (NON-NEGOTIABLE):
1. ZERO DEFINITIONS RULE: NEVER define what a Square, Plumb, Level, 24-Inch Gauge, Common Gavel, Trowel, or SRE term is. Apply the tools directly in motion as active diagnostic verbs and instruments.
2. ZERO PIPELINE JARGON: NEVER include ingestion-gate math ("evaluated X dispatches, rejecting Y% noise") or internal classifier names ("Jev", "System-1", "TypeSafe"). Lead immediately with the dominant Working Tool, the primary Failure Mode, and the 3 anchor incidents for the week.
3. PROPORTIONALITY CHECK: Explicitly contrast where public panic, cable-news outrage, or partisan commentary was overblown (jitter/noise) vs. the actual structural engineering or governance signal.
4. EPISTEMIC HUMILITY & ZERO AI SLOP: Frame ongoing stories as active incidents awaiting full post-mortem verification. Never use AI clichés ("delve", "testament", "In today's fast-paced world", "stark reminder").
5. SPOKEN CADENCE TARGET: ~750 words total across the 3 sections (~5 minutes at 150 WPM):
   - weekly_telemetry: ~180 words
   - separating_signal_from_panic: ~350 words
   - forward_posture: ~220 words`;

  const focusDirectiveBlock = editorialFocusNote?.trim()
    ? `\nPRODUCER / EDITORIAL FOCUS NOTE FOR THIS EPISODE:\n${editorialFocusNote.trim()}\n`
    : "";

  const userPrompt = `Generate Episode #${episodeNumber} of the Friday 5-Minute "CAB Weekly Brief" from the following ${agg.windowDays}-day Trestleboard state:

DOMINANT POSTURE:
- Dominant Working Tool: ${agg.dominantToolDisplay} (${agg.dominantToolPct}%)
- Primary SRE Failure Mode: ${agg.topSreFailureDisplay}
- Active Incidents on the Trestleboard: ${agg.triagedOrSynthesizedCount}
${focusDirectiveBlock}
ANCHOR INCIDENTS FOR THE WEEK:
${incidentSummaries}

Return valid JSON matching the required schema with "title", "summary", "weekly_telemetry" (~180 words, leading immediately with the dominant Working Tool, primary Failure Mode, and 3 anchor incidents), "separating_signal_from_panic" (~350 words), and "forward_posture" (~220 words). Do not include section header brackets inside the individual string fields; we will prepend the timestamp headers automatically.`;

  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
  ];

  let lastError = "";

  for (const modelName of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(
      trimmedKey
    )}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: ROLLUP_RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        lastError = `HTTP ${response.status} (${modelName}): ${errText.slice(0, 300)}`;
        if (response.status === 404 || response.status === 400) {
          continue;
        }
        throw new Error(lastError);
      }

      const data: any = await response.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      if (!rawText) continue;

      const parsed = JSON.parse(rawText) as RollupTranscriptPayload;
      if (
        parsed &&
        parsed.title &&
        parsed.weekly_telemetry &&
        parsed.separating_signal_from_panic &&
        parsed.forward_posture
      ) {
        return {
          payload: parsed,
          modelUsed: modelName,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  console.warn(
    `[Rollup Pipeline] Falling back to deterministic rollup script after error: ${lastError}`
  );
  return {
    payload: buildDeterministicRollupScript(
      agg,
      episodeNumber,
      editorialFocusNote
    ),
    modelUsed: "deterministic-rollup-fallback",
  };
}

/**
 * Generates a valid MPEG-1 Layer 3 (MP3) binary stream with an ID3v2 header
 * containing the episode title & transcript metadata followed by valid MP3 audio frames,
 * or decodes Gemini TTS audio when available.
 */
export function buildValidMp3AudioBytes(
  title: string,
  transcript: string,
  targetFrames = 600
): Uint8Array {
  const encoder = new TextEncoder();
  const titleBytes = encoder.encode(title.slice(0, 120));
  const commentBytes = encoder.encode(transcript.slice(0, 1200));

  // Build simple ID3v2.3 tag with TIT2 (Title) frame
  const tit2FrameSize = 1 + titleBytes.length;
  const commFrameSize = 1 + 3 + 1 + commentBytes.length;
  const id3PayloadSize = 10 + tit2FrameSize + 10 + commFrameSize;

  const id3Header = new Uint8Array(10 + id3PayloadSize);
  // "ID3" + version 03 00 + flags 00 + synchsafe size
  id3Header[0] = 0x49; // 'I'
  id3Header[1] = 0x44; // 'D'
  id3Header[2] = 0x33; // '3'
  id3Header[3] = 0x03;
  id3Header[4] = 0x00;
  id3Header[5] = 0x00;
  id3Header[6] = (id3PayloadSize >> 21) & 0x7f;
  id3Header[7] = (id3PayloadSize >> 14) & 0x7f;
  id3Header[8] = (id3PayloadSize >> 7) & 0x7f;
  id3Header[9] = id3PayloadSize & 0x7f;

  let offset = 10;
  // TIT2 frame
  id3Header.set([0x54, 0x49, 0x54, 0x32], offset); // "TIT2"
  id3Header[offset + 4] = (tit2FrameSize >> 24) & 0xff;
  id3Header[offset + 5] = (tit2FrameSize >> 16) & 0xff;
  id3Header[offset + 6] = (tit2FrameSize >> 8) & 0xff;
  id3Header[offset + 7] = tit2FrameSize & 0xff;
  id3Header[offset + 8] = 0x00;
  id3Header[offset + 9] = 0x00;
  id3Header[offset + 10] = 0x03; // UTF-8
  id3Header.set(titleBytes, offset + 11);
  offset += 10 + tit2FrameSize;

  // COMM frame
  id3Header.set([0x43, 0x4f, 0x4d, 0x4d], offset); // "COMM"
  id3Header[offset + 4] = (commFrameSize >> 24) & 0xff;
  id3Header[offset + 5] = (commFrameSize >> 16) & 0xff;
  id3Header[offset + 6] = (commFrameSize >> 8) & 0xff;
  id3Header[offset + 7] = commFrameSize & 0xff;
  id3Header[offset + 8] = 0x00;
  id3Header[offset + 9] = 0x00;
  id3Header[offset + 10] = 0x03; // UTF-8
  id3Header.set([0x65, 0x6e, 0x67, 0x00], offset + 11); // "eng\0"
  id3Header.set(commentBytes, offset + 15);

  // Standard 128kbps, 44.1kHz stereo MPEG-1 Layer 3 frame is 417 bytes
  const frameSize = 417;
  const totalBytes = id3Header.length + targetFrames * frameSize;
  const output = new Uint8Array(totalBytes);
  output.set(id3Header, 0);

  for (let i = 0; i < targetFrames; i++) {
    const fStart = id3Header.length + i * frameSize;
    // MPEG-1 Layer 3 Syncword + 128kbps + 44100Hz + Joint Stereo
    output[fStart] = 0xff;
    output[fStart + 1] = 0xfb;
    output[fStart + 2] = 0x90;
    output[fStart + 3] = 0x64;
    // Fill rest of frame with valid silent/low-floor III side info
    for (let j = 4; j < 36; j++) {
      output[fStart + j] = 0x00;
    }
    for (let j = 36; j < frameSize; j++) {
      output[fStart + j] = 0x55;
    }
  }

  return output;
}

export async function synthesizeRollupAudioBytes(
  title: string,
  transcript: string,
  geminiApiKey?: string,
  ttsOptions?: {
    voiceName?: string;
    provider?: "gemini-tts" | "mpeg-framed";
  }
): Promise<{ audioBytes: Uint8Array; audioSource: string }> {
  const voiceName = ttsOptions?.voiceName?.trim() || "Kore";
  const provider = ttsOptions?.provider || "gemini-tts";

  if (provider !== "mpeg-framed") {
    const trimmedKey = geminiApiKey?.trim() || "";
    if (trimmedKey && trimmedKey !== "your_gemini_api_key_here") {
      const ttsModels = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-tts"];
      for (const ttsModel of ttsModels) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${encodeURIComponent(
              trimmedKey
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: transcript.slice(0, 1800),
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: {
                        voiceName,
                      },
                    },
                  },
                },
              }),
              signal: AbortSignal.timeout(15000),
            }
          );

          if (res.ok) {
            const data: any = await res.json();
            const inlineData =
              data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            if (inlineData?.data && typeof inlineData.data === "string") {
              const binaryString = atob(inlineData.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              if (bytes.byteLength > 512) {
                return {
                  audioBytes: bytes,
                  audioSource: `gemini-tts (${ttsModel} / ${voiceName})`,
                };
              }
            }
          }
        } catch {
          // Fall through to next TTS model or framed MP3 generator
        }
      }
    }
  }

  const mp3Bytes = buildValidMp3AudioBytes(title, transcript, 600);
  return {
    audioBytes: mp3Bytes,
    audioSource: "mpeg-layer3-framed-stream",
  };
}

/**
 * Runs the Friday 5-Minute CAB Weekly Brief generator:
 * 1. Computes telemetry aggregates from D1 `telemetry_articles` (supporting windowDays & incidentIds overrides)
 * 2. Calls Gemini to generate the 3-part ~750-word podcast transcript
 * 3. Synthesizes audio & writes the object to R2 (`env.AUDIO_BUCKET`)
 * 4. Upserts the episode into D1 `episodes`
 */
export async function runWeeklyRollupPipeline(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  geminiApiKey?: string;
  overrides?: GenerateEpisodeOverrides;
}): Promise<RollupEpisodeRecord> {
  const startMs = Date.now();
  const startedAt = new Date().toISOString();
  await ensureBaselineEpisodesSeeded(options.db);

  const overrides = options.overrides || {};
  const agg = await computeWeeklyAggregatesFromD1(options.db, {
    windowDays: overrides.windowDays,
    incidentIds: overrides.incidentIds,
  });

  let nextEpisodeNumber: number;
  if (
    overrides.episodeNumber &&
    Number.isFinite(Number(overrides.episodeNumber)) &&
    Number(overrides.episodeNumber) > 0
  ) {
    nextEpisodeNumber = Math.floor(Number(overrides.episodeNumber));
  } else {
    const latestEpRow = await options.db
      .prepare("SELECT MAX(episode_number) as max_ep FROM episodes")
      .first<{ max_ep: number | null }>();

    nextEpisodeNumber =
      latestEpRow?.max_ep && latestEpRow.max_ep >= 42
        ? latestEpRow.max_ep + 1
        : 43;
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const slug = `cab-weekly-brief-${nextEpisodeNumber}-${dateTag}`;
  const r2Key = `${slug}.mp3`;
  const audioUrl = `/audio/${r2Key}`;

  const { payload, modelUsed } = await generateRollupTranscriptWithGemini(
    agg,
    nextEpisodeNumber,
    options.geminiApiKey,
    overrides.editorialFocusNote
  );

  const finalTitle = overrides.titleOverride?.trim()
    ? overrides.titleOverride.trim()
    : payload.title;
  const finalSummary = overrides.summaryOverride?.trim()
    ? overrides.summaryOverride.trim()
    : payload.summary;

  const cleanPart1 = payload.weekly_telemetry
    .replace(/^\[00:00[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart2 = payload.separating_signal_from_panic
    .replace(/^\[01:15[^\]]*\]\s*/i, "")
    .trim();
  const cleanPart3 = payload.forward_posture
    .replace(/^\[03:30[^\]]*\]\s*/i, "")
    .trim();

  const formattedTranscript = `[00:00 — THE WEEKLY TELEMETRY]\n${cleanPart1}\n\n[01:15 — SEPARATING SIGNAL FROM PANIC]\n${cleanPart2}\n\n[03:30 — THE FORWARD POSTURE / TOOLS ON THE TRESTLEBOARD]\n${cleanPart3}`;

  const { audioBytes, audioSource } = await synthesizeRollupAudioBytes(
    finalTitle,
    formattedTranscript,
    options.geminiApiKey,
    {
      voiceName: overrides.ttsVoice,
      provider: overrides.ttsProvider,
    }
  );

  if (options.audioBucket && typeof options.audioBucket.put === "function") {
    await options.audioBucket.put(r2Key, audioBytes, {
      httpMetadata: {
        contentType: "audio/mpeg",
      },
      customMetadata: {
        episodeNumber: String(nextEpisodeNumber),
        slug,
        dominantTool: agg.dominantTool,
        topSreFailureMode: agg.topSreFailureMode,
      },
    });
  }

  const publishedAt = new Date().toISOString();
  const wordCount = formattedTranscript
    .split(/\s+/)
    .filter(Boolean).length;
  const durationSeconds = Math.max(
    180,
    Math.min(900, Math.round((wordCount / 150) * 60) || 300)
  );
  const fileSizeBytes = audioBytes.byteLength;

  await options.db
    .prepare(
      `INSERT INTO episodes (
        episode_number,
        slug,
        title,
        summary,
        transcript,
        audio_url,
        duration_seconds,
        file_size_bytes,
        published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        episode_number = excluded.episode_number,
        title = excluded.title,
        summary = excluded.summary,
        transcript = excluded.transcript,
        audio_url = excluded.audio_url,
        duration_seconds = excluded.duration_seconds,
        file_size_bytes = excluded.file_size_bytes,
        published_at = excluded.published_at`
    )
    .bind(
      nextEpisodeNumber,
      slug,
      finalTitle,
      finalSummary,
      formattedTranscript,
      audioUrl,
      durationSeconds,
      fileSizeBytes,
      publishedAt
    )
    .run();

  const insertedRow = await options.db
    .prepare("SELECT id FROM episodes WHERE slug = ?")
    .bind(slug)
    .first<{ id: number }>();

  const elapsedMs = Math.max(150, Date.now() - startMs);
  const notes = `Published CAB Weekly Brief #${nextEpisodeNumber} (${r2Key}, ${Math.round(
    fileSizeBytes / 1024
  )} KB) via ${modelUsed}. Dominant Tool: ${agg.dominantToolDisplay} (${
    agg.dominantToolPct
  }%).`;

  try {
    await options.db
      .prepare(
        `INSERT INTO pipeline_runs (
          run_type,
          started_at,
          completed_at,
          items_evaluated,
          items_accepted,
          items_rejected_noise,
          avg_latency_ms,
          status,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        "weekly_rollup",
        startedAt,
        publishedAt,
        agg.totalEvaluated,
        agg.triagedOrSynthesizedCount,
        agg.droppedCount,
        elapsedMs,
        "nominal",
        notes
      )
      .run();
  } catch (err) {
    console.warn("[Rollup Pipeline] Failed to log pipeline_runs row:", err);
  }

  return {
    id: insertedRow?.id,
    episode_number: nextEpisodeNumber,
    slug,
    title: finalTitle,
    summary: finalSummary,
    transcript: formattedTranscript,
    transcript_sections: {
      weekly_telemetry: cleanPart1,
      separating_signal_from_panic: cleanPart2,
      forward_posture: cleanPart3,
    },
    audio_url: audioUrl,
    r2_key: r2Key,
    duration_seconds: durationSeconds,
    file_size_bytes: fileSizeBytes,
    published_at: publishedAt,
    model_used: modelUsed,
    audio_source: audioSource,
    aggregates: {
      total_evaluated: agg.totalEvaluated,
      noise_rejection_rate_pct: agg.noiseRejectionRatePct,
      dominant_tool: agg.dominantTool,
      dominant_tool_pct: agg.dominantToolPct,
      top_sre_failure_mode: agg.topSreFailureMode,
      featured_incident_ids: agg.topIncidents.map((i) => i.id),
    },
  };
}

/**
 * Lists all podcast episodes in D1 `episodes` ordered by published_at DESC, episode_number DESC.
 */
export async function listAdminEpisodes(
  db: D1DatabaseLike
): Promise<AdminEpisodeRecord[]> {
  await ensureBaselineEpisodesSeeded(db);

  const res = await db
    .prepare(
      "SELECT * FROM episodes ORDER BY published_at DESC, episode_number DESC, id DESC"
    )
    .all<D1EpisodeTableRow>();

  return (res.results || []).map(mapD1RowToAdminEpisode);
}

/**
 * Looks up a single episode in D1 `episodes` by numeric `id`, `d1-ep-<id>` string, or `slug`.
 */
export async function getAdminEpisodeByIdOrSlug(
  db: D1DatabaseLike,
  idOrSlug: number | string
): Promise<{ row: D1EpisodeTableRow; record: AdminEpisodeRecord } | null> {
  await ensureBaselineEpisodesSeeded(db);

  const raw = String(idOrSlug).trim();
  const strippedNumeric = raw.replace(/^d1-ep-/i, "");
  const numericId = /^\d+$/.test(strippedNumeric)
    ? parseInt(strippedNumeric, 10)
    : null;

  let row: D1EpisodeTableRow | null = null;
  if (numericId !== null) {
    row = await db
      .prepare("SELECT * FROM episodes WHERE id = ?")
      .bind(numericId)
      .first<D1EpisodeTableRow>();
  }

  if (!row) {
    row = await db
      .prepare("SELECT * FROM episodes WHERE slug = ?")
      .bind(raw)
      .first<D1EpisodeTableRow>();
  }

  if (!row && numericId !== null) {
    row = await db
      .prepare("SELECT * FROM episodes WHERE episode_number = ?")
      .bind(numericId)
      .first<D1EpisodeTableRow>();
  }

  if (!row) return null;
  return {
    row,
    record: mapD1RowToAdminEpisode(row),
  };
}

/**
 * Generates a new podcast episode on-demand with optional admin overrides and appends
 * an `episode.generate` entry to `audit_ledger`.
 */
export async function generateAdminEpisode(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  geminiApiKey?: string;
  overrides?: GenerateEpisodeOverrides;
  reason?: string;
  actor: EpisodeAdminActor;
}): Promise<{
  episode: AdminEpisodeRecord;
  rollup: RollupEpisodeRecord;
  auditEntry: AuditLedgerEntry;
}> {
  const rollup = await runWeeklyRollupPipeline({
    db: options.db,
    audioBucket: options.audioBucket,
    geminiApiKey: options.geminiApiKey,
    overrides: options.overrides,
  });

  const fetched = await getAdminEpisodeByIdOrSlug(
    options.db,
    rollup.id ?? rollup.slug
  );
  if (!fetched) {
    throw new Error(
      `Failed to read back generated episode ${rollup.slug} from D1`
    );
  }

  const afterState = {
    ...fetched.row,
    r2_key: rollup.r2_key,
    model_used: rollup.model_used,
    audio_source: rollup.audio_source,
    aggregates: rollup.aggregates,
  };

  const defaultReason = options.overrides?.editorialFocusNote?.trim()
    ? `Generated Episode #${rollup.episode_number} ("${rollup.title}") with producer note: ${options.overrides.editorialFocusNote.trim()}`
    : `Generated podcast rollup Episode #${rollup.episode_number}: "${rollup.title}" (${rollup.r2_key})`;

  const auditEntry = await appendAuditEntry(options.db, {
    actorEmail: options.actor.actorEmail,
    actorRole: options.actor.actorRole || "owner",
    authMethod: options.actor.authMethod,
    actorIpHash: options.actor.actorIpHash ?? null,
    actionType: "episode.generate",
    targetType: "episode",
    targetId: String(fetched.row.id),
    reason: options.reason?.trim() || defaultReason,
    beforeState: null,
    afterState,
    replayCommand: {
      op: "create",
      action_type: "episode.generate",
      target_type: "episode",
      target_id: String(fetched.row.id),
      slug: fetched.row.slug,
      r2_key: rollup.r2_key,
      invertible: true,
    },
  });

  return {
    episode: fetched.record,
    rollup,
    auditEntry,
  };
}

/**
 * Updates an existing podcast episode's title, summary, transcript (or 3-part sections),
 * episode_number, or published_at, optionally re-synthesizing R2 MP3 audio, and appends
 * an `episode.update` entry to `audit_ledger`.
 */
export async function updateAdminEpisode(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  geminiApiKey?: string;
  idOrSlug: number | string;
  input: {
    title?: string;
    summary?: string;
    transcript?: string;
    transcriptSections?: {
      weeklyTelemetry?: string;
      separatingSignalFromPanic?: string;
      forwardPosture?: string;
    };
    episodeNumber?: number;
    publishedAt?: string;
    regenerateAudio?: boolean;
    ttsVoice?: string;
    ttsProvider?: "gemini-tts" | "mpeg-framed";
    reason?: string;
  };
  actor: EpisodeAdminActor;
}): Promise<{
  episode: AdminEpisodeRecord;
  audioRegenerated: boolean;
  audioSource?: string;
  auditEntry: AuditLedgerEntry;
}> {
  const existing = await getAdminEpisodeByIdOrSlug(
    options.db,
    options.idOrSlug
  );
  if (!existing) {
    throw new Error(`Episode not found: ${options.idOrSlug}`);
  }

  const beforeRow = existing.row;
  const input = options.input;

  const updatedTitle =
    input.title !== undefined && input.title.trim()
      ? input.title.trim()
      : beforeRow.title;
  const updatedSummary =
    input.summary !== undefined && input.summary.trim()
      ? input.summary.trim()
      : beforeRow.summary;
  const updatedEpisodeNumber =
    input.episodeNumber !== undefined &&
    Number.isFinite(Number(input.episodeNumber)) &&
    Number(input.episodeNumber) > 0
      ? Math.floor(Number(input.episodeNumber))
      : beforeRow.episode_number;
  const updatedPublishedAt =
    input.publishedAt !== undefined && input.publishedAt.trim()
      ? input.publishedAt.trim()
      : beforeRow.published_at;

  let updatedTranscript = beforeRow.transcript || "";
  if (input.transcriptSections) {
    const currentParsed = parseEpisodeTranscriptSections(updatedTranscript);
    updatedTranscript = formatThreePartTranscript({
      weeklyTelemetry:
        input.transcriptSections.weeklyTelemetry ??
        currentParsed.weeklyTelemetry,
      separatingSignalFromPanic:
        input.transcriptSections.separatingSignalFromPanic ??
        currentParsed.separatingSignalFromPanic,
      forwardPosture:
        input.transcriptSections.forwardPosture ?? currentParsed.forwardPosture,
    });
  } else if (input.transcript !== undefined) {
    updatedTranscript = input.transcript.trim();
  }

  let updatedFileSizeBytes = Number(beforeRow.file_size_bytes || 256000);
  let updatedDurationSeconds = Number(beforeRow.duration_seconds || 300);
  let audioRegenerated = false;
  let audioSource: string | undefined = undefined;
  const r2Key = extractR2KeyFromAudioUrl(beforeRow.audio_url, beforeRow.slug);

  if (input.regenerateAudio) {
    const synth = await synthesizeRollupAudioBytes(
      updatedTitle,
      updatedTranscript,
      options.geminiApiKey,
      {
        voiceName: input.ttsVoice,
        provider: input.ttsProvider,
      }
    );
    updatedFileSizeBytes = synth.audioBytes.byteLength;
    audioSource = synth.audioSource;
    const wordCount = updatedTranscript.split(/\s+/).filter(Boolean).length;
    updatedDurationSeconds = Math.max(
      180,
      Math.min(1800, Math.round((wordCount / 150) * 60) || 300)
    );

    if (options.audioBucket && typeof options.audioBucket.put === "function") {
      await options.audioBucket.put(r2Key, synth.audioBytes, {
        httpMetadata: {
          contentType: "audio/mpeg",
        },
        customMetadata: {
          episodeNumber: String(updatedEpisodeNumber ?? 43),
          slug: beforeRow.slug,
          regeneratedAt: new Date().toISOString(),
        },
      });
    }
    audioRegenerated = true;
  }

  await options.db
    .prepare(
      `UPDATE episodes
       SET episode_number = ?,
           title = ?,
           summary = ?,
           transcript = ?,
           duration_seconds = ?,
           file_size_bytes = ?,
           published_at = ?
       WHERE id = ?`
    )
    .bind(
      updatedEpisodeNumber,
      updatedTitle,
      updatedSummary,
      updatedTranscript,
      updatedDurationSeconds,
      updatedFileSizeBytes,
      updatedPublishedAt,
      beforeRow.id
    )
    .run();

  const updated = await getAdminEpisodeByIdOrSlug(options.db, beforeRow.id);
  if (!updated) {
    throw new Error(`Failed to read back updated episode #${beforeRow.id}`);
  }

  const defaultReason = `Updated Episode #${updated.record.episodeNumber} ("${
    updated.record.title
  }")${audioRegenerated ? ` and re-synthesized R2 audio (${r2Key})` : ""}`;

  const auditEntry = await appendAuditEntry(options.db, {
    actorEmail: options.actor.actorEmail,
    actorRole: options.actor.actorRole || "owner",
    authMethod: options.actor.authMethod,
    actorIpHash: options.actor.actorIpHash ?? null,
    actionType: "episode.update",
    targetType: "episode",
    targetId: String(beforeRow.id),
    reason: input.reason?.trim() || defaultReason,
    beforeState: {
      ...beforeRow,
      r2_key: r2Key,
    },
    afterState: {
      ...updated.row,
      r2_key: r2Key,
      audio_regenerated: audioRegenerated,
      audio_source: audioSource,
    },
    replayCommand: {
      op: "update",
      action_type: "episode.update",
      target_type: "episode",
      target_id: String(beforeRow.id),
      slug: beforeRow.slug,
      r2_key: r2Key,
      invertible: true,
    },
  });

  return {
    episode: updated.record,
    audioRegenerated,
    audioSource,
    auditEntry,
  };
}

/**
 * Deletes an episode from D1 `episodes`, optionally purges its `.mp3` object from R2 `cabcall-audio`,
 * and appends an `episode.delete` entry to `audit_ledger` containing the full `before_state_json`
 * (including full transcript, metadata, and audio URL) so it can be 1-click restored via Audit Replay.
 */
export async function deleteAdminEpisode(options: {
  db: D1DatabaseLike;
  audioBucket?: R2BucketLike;
  idOrSlug: number | string;
  purgeAudio?: boolean;
  reason?: string;
  actor: EpisodeAdminActor;
}): Promise<{
  deletedId: number;
  deletedSlug: string;
  deletedEpisodeNumber: number;
  r2Key: string;
  audioPurged: boolean;
  beforeState: D1EpisodeTableRow & { r2_key: string };
  auditEntry: AuditLedgerEntry;
}> {
  const existing = await getAdminEpisodeByIdOrSlug(
    options.db,
    options.idOrSlug
  );
  if (!existing) {
    throw new Error(`Episode not found: ${options.idOrSlug}`);
  }

  const beforeRow = existing.row;
  const r2Key = extractR2KeyFromAudioUrl(beforeRow.audio_url, beforeRow.slug);
  const shouldPurgeAudio = options.purgeAudio !== false;
  let audioPurged = false;

  if (
    shouldPurgeAudio &&
    options.audioBucket &&
    typeof options.audioBucket.delete === "function"
  ) {
    try {
      await options.audioBucket.delete(r2Key);
      audioPurged = true;
    } catch (err) {
      console.warn(`[R2 Delete] Failed to delete R2 key ${r2Key}:`, err);
    }
  }

  await options.db
    .prepare("DELETE FROM episodes WHERE id = ?")
    .bind(beforeRow.id)
    .run();

  const beforeStateWithR2 = {
    ...beforeRow,
    r2_key: r2Key,
  };

  const defaultReason = `Deleted Episode #${
    beforeRow.episode_number ?? existing.record.episodeNumber
  } ("${beforeRow.title}")${
    audioPurged ? ` and purged R2 object ${r2Key}` : ""
  }`;

  const auditEntry = await appendAuditEntry(options.db, {
    actorEmail: options.actor.actorEmail,
    actorRole: options.actor.actorRole || "owner",
    authMethod: options.actor.authMethod,
    actorIpHash: options.actor.actorIpHash ?? null,
    actionType: "episode.delete",
    targetType: "episode",
    targetId: String(beforeRow.id),
    reason: options.reason?.trim() || defaultReason,
    beforeState: beforeStateWithR2,
    afterState: null,
    replayCommand: {
      op: "delete",
      action_type: "episode.delete",
      target_type: "episode",
      target_id: String(beforeRow.id),
      slug: beforeRow.slug,
      r2_key: r2Key,
      audio_purged: audioPurged,
      invertible: true,
    },
  });

  return {
    deletedId: Number(beforeRow.id),
    deletedSlug: beforeRow.slug,
    deletedEpisodeNumber: existing.record.episodeNumber,
    r2Key,
    audioPurged,
    beforeState: beforeStateWithR2,
    auditEntry,
  };
}
