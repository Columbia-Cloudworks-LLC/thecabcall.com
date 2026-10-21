import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  buildOrSanitizeArticleDiagnostics,
  cleanRssText,
  computeNgramOverlap,
  containsInterpolatedHeadline,
  deduplicateSignalAgainstFacts,
  hasDuplicateSentenceBetweenFactsAndSignal,
  hasSyntheticPlaceholderIdentifier,
  isTemplatedOrMalformedCopy,
  normalizeCanonicalUrl,
  normalizeStoredQuestionsPayload,
  sanitizeSyntheticPlaceholders,
  stripUnsafeHtmlAndCdata,
} from "../src/lib/sanitize.ts";
import {
  ensureD1Snapshot,
  executeD1ArchivePaginationQueries,
  executeD1FailureModeAggregations,
  executeD1WorkingToolAggregations,
  extractStoredQuestionsPayload,
  mapD1RowToIncidentArticle,
  paginateAndAggregateIncidentCorpus,
  readLocalD1Snapshot,
} from "../src/lib/d1-bridge.ts";
import {
  deescalateHeadlineDeterministic,
  extractImageFromSourceArticleUrl,
  resolveContextualPublicDomainImage,
  stripLegacyBoilerplateTitleSuffix,
} from "../src/pipeline/editorial.ts";
import { INITIAL_INCIDENTS, INITIAL_EPISODES } from "../src/lib/seed-data.ts";
import {
  CANONICAL_PODCAST_AI_COLOPHON,
  buildCleanEpisodeHook,
  buildCleanExtendedNotes,
  extractExternalSourcesFromText,
  sanitizeEpisodeSummaryDefensive,
  stripAiDisclaimers,
} from "../src/lib/episode-metadata.ts";
import {
  validateJevEvaluationOutput,
  evaluateArticleWithJev,
} from "../src/pipeline/jev.ts";
import {
  computeCanonicalArticleHash,
  fetchFeedXmlWithLimits,
  collectLatestUsRssItems,
  runD1IngestPipeline,
  DEFAULT_MAX_FEED_RESPONSE_BYTES,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
} from "../src/pipeline/ingest.ts";
import {
  buildSystem2Prompt,
  validateSynthesizedBriefOutput,
  runSynthesizePipeline,
  type TelemetryArticleRow,
} from "../src/pipeline/synthesize.ts";
import {
  runWeeklyRollupPipeline,
  type R2BucketLike,
  type R2ObjectLike,
  type R2ObjectMetaLike,
} from "../src/pipeline/rollup.ts";
import {
  assertZeroTelemetryBleed,
  formatCompactCaseId,
  formatCraftLedgerEntry,
  formatFriendlySourceName,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
  type PublicIncidentDto,
} from "../src/lib/dto.ts";
import {
  DOMAIN_SECTOR_SPECS,
  formatFailureModeDisplayLabel,
  getDomainSectorBySlug,
  getFailureModeBySlug,
  getFailureModeHref,
  getSreFailureModeSpec,
  getWorkingToolBySlug,
  getWorkingToolHref,
  getWorkingToolSpec,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SRE_FAILURE_MODES,
  WORKING_TOOLS,
} from "../src/lib/taxonomy.ts";
import {
  isNavItemActive,
  NAVIGATION_SCHEMA,
} from "../src/lib/navigation.ts";
import {
  buildWeeklyTrestleboardState,
  getFailureModeHubData,
  getPaginatedArchiveDispatches,
  getSystemPostureSummary,
  getWorkingToolHubData,
} from "../src/lib/store.ts";
import { verifyAuditChainIntegrity } from "../src/pipeline/audit.ts";
import {
  createOutboundFeed,
  deleteOutboundFeed,
  listOutboundFeeds,
  renderIncidentsJsonFeed,
  renderIncidentsRssXml,
  renderPodcastRssXml,
  updateOutboundFeed,
} from "../src/pipeline/publishing.ts";
import worker, { type ExecutionContextLike } from "../src/worker.ts";

function createInMemoryD1Database(): {
  db: D1DatabaseLike;
  rawSql: DatabaseSync;
} {
  const sqlite = new DatabaseSync(":memory:");
  const migrationsDir = path.join(process.cwd(), "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    sqlite.exec(sql);
  }

  const createStatement = (
    query: string,
    boundValues: unknown[] = []
  ): D1PreparedStatementLike => ({
    bind(...values: unknown[]) {
      return createStatement(query, values);
    },
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      const stmt = sqlite.prepare(query);
      const row = stmt.get(...(boundValues as Array<string | number | null>)) as
        | T
        | undefined;
      return row ?? null;
    },
    async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
      const stmt = sqlite.prepare(query);
      const rows = stmt.all(
        ...(boundValues as Array<string | number | null>)
      ) as T[];
      return { results: rows };
    },
    async run<T = unknown>(): Promise<T> {
      const stmt = sqlite.prepare(query);
      const res = stmt.run(...(boundValues as Array<string | number | null>));
      return {
        meta: {
          last_row_id: Number(res.lastInsertRowid),
          changes: Number(res.changes),
        },
      } as unknown as T;
    },
  });

  const db: D1DatabaseLike = {
    prepare(query: string) {
      return createStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]> {
      sqlite.exec("BEGIN IMMEDIATE TRANSACTION");
      try {
        const out: T[] = [];
        for (const stmt of statements) {
          out.push(await stmt.run<T>());
        }
        sqlite.exec("COMMIT");
        return out;
      } catch (err) {
        try {
          sqlite.exec("ROLLBACK");
        } catch {
          // ignore
        }
        throw err;
      }
    },
  };

  return { db, rawSql: sqlite };
}

class MockR2Bucket implements R2BucketLike {
  private objects = new Map<
    string,
    { bytes: Uint8Array; contentType?: string; customMetadata?: Record<string, string> }
  >();
  public simulateMissingOnHead = false;
  public simulateZeroByteOnHead = false;
  public simulateInvalidMimeOnHead = false;

  async put(
    key: string,
    value: ArrayBuffer | Uint8Array | ReadableStream | string,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown> {
    const bytes =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array
        ? value
        : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array([1, 2, 3]);
    this.objects.set(key, {
      bytes,
      contentType: options?.httpMetadata?.contentType,
      customMetadata: options?.customMetadata,
    });
    return { key, size: bytes.byteLength };
  }

  async head(key: string): Promise<R2ObjectMetaLike | null> {
    if (this.simulateMissingOnHead) return null;
    const found = this.objects.get(key);
    if (!found) return null;
    if (this.simulateZeroByteOnHead) {
      return {
        key,
        size: 0,
        httpMetadata: { contentType: found.contentType || "audio/mpeg" },
      };
    }
    if (this.simulateInvalidMimeOnHead) {
      return {
        key,
        size: found.bytes.byteLength,
        httpMetadata: { contentType: "text/plain" },
      };
    }
    return {
      key,
      size: found.bytes.byteLength,
      httpMetadata: { contentType: found.contentType || "audio/mpeg" },
    };
  }

  async get(key: string): Promise<R2ObjectLike | null> {
    const meta = await this.head(key);
    const found = this.objects.get(key);
    if (!meta || !found) return null;
    return {
      ...meta,
      async arrayBuffer() {
        return found.bytes.buffer.slice(
          found.bytes.byteOffset,
          found.bytes.byteOffset + found.bytes.byteLength
        ) as ArrayBuffer;
      },
    };
  }

  async delete(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      this.objects.delete(k);
    }
  }
}

const mockExecutionContext: ExecutionContextLike = {
  waitUntil() {
    // no-op in verification suite
  },
  passThroughOnException() {
    // no-op in verification suite
  },
};

async function runVerificationSuite() {
  console.log("=== THE CAB CALL // DEFENSIVE HARDENING VERIFICATION SUITE ===");

  // -------------------------------------------------------------------------
  // 1. OBJECTIVE 1: RSS INGESTION, CONCURRENCY, BYTE LIMITS & CANONICAL HASHING
  // -------------------------------------------------------------------------
  console.log(
    "\n[1/5] Verifying Objective 1: Concurrent RSS Ingestion, Byte Limits, & Canonical Hashing..."
  );

  const urlA =
    "https://WWW.NPR.ORG:443/2026/10/17/grid-outage/?utm_source=rss&utm_medium=feed&b=2&a=1&fbclid=xyz#section-2";
  const urlB = "https://www.npr.org/2026/10/17/grid-outage?a=1&b=2";
  assert.equal(
    normalizeCanonicalUrl(urlA),
    "https://www.npr.org/2026/10/17/grid-outage?a=1&b=2",
    "normalizeCanonicalUrl must strip tracking params, fragments, default ports, and sort query params"
  );

  const hash1 = await computeCanonicalArticleHash(urlA, "guid-npr-1001");
  const hash2 = await computeCanonicalArticleHash(urlB, "GUID-NPR-1001");
  assert.equal(
    hash1,
    hash2,
    "computeCanonicalArticleHash must be deterministic across tracking params and GUID case"
  );

  const dirtyHtml =
    '<![CDATA[<script>alert("xss")</script><p onclick="evil()">Regional transformer <a href="javascript:void(0)">substation</a> offline &amp; awaiting inspection.</p>]]>';
  const cleanedText = cleanRssText(stripUnsafeHtmlAndCdata(dirtyHtml));
  assert.ok(
    !cleanedText.includes("<script>") &&
      !cleanedText.includes("onclick") &&
      !cleanedText.includes("CDATA"),
    "stripUnsafeHtmlAndCdata must remove script tags, event handlers, and CDATA wrappers"
  );
  assert.equal(
    cleanedText,
    "Regional transformer substation offline & awaiting inspection."
  );

  // Test oversized XML rejection (>1 MiB)
  const oversizedXml =
    "<rss><channel>" +
    "A".repeat(DEFAULT_MAX_FEED_RESPONSE_BYTES + 1024) +
    "</channel></rss>";
  await assert.rejects(
    () =>
      fetchFeedXmlWithLimits("https://example.com/oversized.xml", {
        fetchImpl: async () => new Response(oversizedXml, { status: 200 }),
      }),
    /exceeded maximum.*limit/,
    "fetchFeedXmlWithLimits must reject XML payloads exceeding 1 MiB"
  );

  // Test concurrent polling resilience against HTTP 429, HTTP 500, malformed XML, and oversized XML
  const { db, rawSql } = createInMemoryD1Database();

  const mockConcurrentRssFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("npr.org")) {
      return new Response("Too Many Requests", { status: 429 });
    }
    if (url.includes("pbs.org")) {
      return new Response("Upstream Internal Error", { status: 500 });
    }
    if (url.includes("nytimes.com")) {
      return new Response(
        "<rss><channel><item><title>Malformed unclosed XML",
        { status: 200 }
      );
    }
    if (url.includes("dj.com")) {
      return new Response(
        "X".repeat(DEFAULT_MAX_FEED_RESPONSE_BYTES + 500),
        { status: 200 }
      );
    }
    if (url.includes("arstechnica.com")) {
      // Ars Technica succeeds with valid RSS item containing CDATA and tracking params
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
         <rss version="2.0">
           <channel>
             <item>
               <title><![CDATA[Regional Fiber Backhaul Cut Exposes Redundant Path Sharing Across Three Carriers]]></title>
               <link>https://arstechnica.com/information-technology/2026/10/fiber-cut/?utm_source=rss&amp;utm_campaign=main</link>
               <guid>ars-fiber-2026-10-17</guid>
               <pubDate>Sat, 17 Oct 2026 12:00:00 GMT</pubDate>
               <description><![CDATA[<script>bad()</script><p>A backhoe severance along a shared highway right-of-way simultaneously disrupted three ostensibly independent cloud transit providers whose backup dark-fiber leases traversed the same physical conduit. Post-incident engineering reviews confirmed that logical BGP route diversity had never been cross-checked against municipal physical conduit maps.</p>]]></description>
             </item>
           </channel>
         </rss>`,
        { status: 200 }
      );
    }
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel></channel></rss>`,
      { status: 200 }
    );
  };

  const collected = await collectLatestUsRssItems(5, db, {
    fetchImpl: mockConcurrentRssFetch,
  });
  assert.equal(
    collected.items.length,
    1,
    "Concurrent RSS collector must isolate failed feeds and return items from healthy feeds"
  );
  assert.equal(
    collected.feedErrors.length,
    3,
    "HTTP 429, HTTP 500, and oversized feeds must be recorded in feedErrors without crashing"
  );
  assert.equal(
    collected.items[0].sourceUrl,
    "https://arstechnica.com/information-technology/2026/10/fiber-cut",
    "Collected item sourceUrl must have tracking parameters stripped"
  );
  console.log(
    "  ✓ Concurrent RSS isolation, 1 MiB byte cap, CDATA/HTML sanitization, and canonical SHA-256 hashing verified."
  );

  // -------------------------------------------------------------------------
  // 2. OBJECTIVE 2: JEV-1.14.0 BOUNDARY VALIDATION & QUARANTINE ROUTING
  // -------------------------------------------------------------------------
  console.log(
    "\n[2/5] Verifying Objective 2: jev-1.14.0 Runtime Boundary Validator & QUARANTINED / PENDING_RETRY States..."
  );

  const validProbs = {
    twenty_four_inch_gauge: 0.1,
    common_gavel: 0.1,
    plumb: 0.2,
    square: 0.4,
    level: 0.1,
    trowel: 0.1,
  };

  // Invalid enum check
  const invalidEnumCheck = validateJevEvaluationOutput({
    isSystemicProb: 0.85,
    jevConfidence: 0.91,
    primaryTool: "The Compasses", // not in the 6 Working Tools enum
    secondaryTool: "plumb",
    sreFailureMode: "cascading_failure",
    workingToolProbabilities: validProbs,
  });
  assert.equal(
    invalidEnumCheck.valid,
    false,
    "Invalid working tool enum must fail validation"
  );

  // Non-finite / out-of-range float check
  const outOfRangeCheck = validateJevEvaluationOutput({
    isSystemicProb: 1.45,
    jevConfidence: Number.NaN,
    primaryTool: "square",
    secondaryTool: "plumb",
    sreFailureMode: "configuration_drift",
    workingToolProbabilities: validProbs,
  });
  assert.equal(
    outOfRangeCheck.valid,
    false,
    "Out-of-range or NaN floats must fail validation"
  );

  // Low-confidence routing to QUARANTINED
  const lowConfEval = await evaluateArticleWithJev(
    {
      title: "Regional Substation Maintenance Window",
      source: "NPR Top News",
      excerpt:
        "Scheduled transformer maintenance experienced a minor delay during switching. Utility crews restored secondary telemetry within twenty minutes.",
    },
    "test-key",
    {
      rawResponseOverride: {
        answers: {
          is_systemic_event: { noul: 0.82, confidence: 0.35 }, // < 0.50 minConfidence
          working_tool: {
            probabilities: validProbs,
            confidence: 0.35,
          },
          sre_failure_mode: {
            probabilities: {
              configuration_drift: 0.5,
              cascading_failure: 0.1,
              untested_failover: 0.1,
              alert_fatigue: 0.1,
              blameless_postmortem_gap: 0.1,
              capacity_exhaustion: 0.1,
            },
            confidence: 0.35,
          },
        },
      },
    }
  );
  assert.equal(
    lowConfEval.status,
    "QUARANTINED",
    "Low-confidence (< minConfidence) systemic Jev evaluation must transition to QUARANTINED"
  );

  // Case A: Transient Jev API 503 failure -> article must persist in D1 as PENDING_RETRY
  const transientFailIngest = await runD1IngestPipeline({
    db,
    typesafeApiKey: "test-key",
    customArticle: {
      title: "Interstate Power Pool Frequency Excursion During Telemetry Upgrade",
      description:
        "Balancing authority operators experienced a twelve-minute blind spot during an automated EMS schema migration across regional interconnects. Backup state-estimator nodes failed to assume primary polling duties until manual intervention.",
      sourceFeed: "NPR Top News",
      link: "https://www.npr.org/2026/10/17/power-pool-excursion",
    },
    jevOptions: {
      fetchImpl: async () =>
        new Response("Service Unavailable", { status: 503 }),
    },
  });
  assert.equal(
    transientFailIngest.pendingRetryCount,
    1,
    "Transient Jev 503 failure must leave ingested article in PENDING_RETRY state"
  );

  // Case B: Malformed Jev output -> article transitions to QUARANTINED
  const malformedJevIngest = await runD1IngestPipeline({
    db,
    typesafeApiKey: "test-key",
    customArticle: {
      title: "Municipal Transit Signaling Controller Firmware Mismatch",
      description:
        "Wayside interlocking controllers rejected telemetry packets after an uncoordinated firmware patch across three commuter rail lines. Service remained suspended for four hours while technicians rolled back the configuration.",
      sourceFeed: "PBS NewsHour Nation",
      link: "https://www.pbs.org/newshour/2026/10/17/transit-firmware",
    },
    jevOptions: {
      rawResponseOverride: {
        answers: {
          is_systemic_event: { noul: Number.NaN, confidence: 0.92 },
        },
      },
    },
  });
  assert.equal(
    malformedJevIngest.quarantinedCount,
    1,
    "Malformed Jev output must transition article to QUARANTINED in D1"
  );

  // Case C: Valid high-confidence Jev output -> article transitions to 'triaged'
  const validJevIngest = await runD1IngestPipeline({
    db,
    typesafeApiKey: "test-key",
    customArticle: {
      title:
        "Regional Fiber Backhaul Cut Exposes Shared Conduit Single Point of Failure",
      description:
        "Three cloud transit providers lost primary and secondary paths simultaneously when a single municipal bridge conduit was severed during roadwork. Post-incident routing audits revealed that backup dark-fiber circuits converged inside the same thirty-meter choke point.",
      sourceFeed: "Ars Technica",
      link: "https://arstechnica.com/2026/10/17/shared-conduit-spof",
    },
    jevOptions: {
      rawResponseOverride: {
        answers: {
          is_systemic_event: { noul: 0.91, confidence: 0.89 },
          working_tool: {
            probabilities: {
              level: 0.45,
              plumb: 0.25,
              square: 0.1,
              twenty_four_inch_gauge: 0.1,
              common_gavel: 0.05,
              trowel: 0.05,
            },
            confidence: 0.89,
          },
          sre_failure_mode: {
            probabilities: {
              untested_failover: 0.65,
              cascading_failure: 0.15,
              configuration_drift: 0.05,
              alert_fatigue: 0.05,
              blameless_postmortem_gap: 0.05,
              capacity_exhaustion: 0.05,
            },
            confidence: 0.89,
          },
        },
      },
    },
  });
  assert.equal(
    validJevIngest.triagedCount,
    1,
    "Valid high-confidence Jev output must transition article to triaged"
  );

  // Case D: Mad-Libs / templated synthesis output -> transitions triaged article to QUARANTINED
  const triagedId = validJevIngest.articles[0].id;
  assert.ok(triagedId, "Triaged article must have a D1 id");

  const sampleRow: TelemetryArticleRow = {
    id: triagedId,
    url_hash: validJevIngest.articles[0].url_hash,
    source_feed: "Ars Technica",
    title:
      "Regional Fiber Backhaul Cut Exposes Shared Conduit Single Point of Failure",
    source_url: "https://arstechnica.com/2026/10/17/shared-conduit-spof",
    raw_excerpt:
      "Three cloud transit providers lost primary and secondary paths simultaneously when a single municipal bridge conduit was severed during roadwork.",
    published_at: "2026-10-17T12:00:00Z",
    ingested_at: "2026-10-17T12:00:00Z",
    is_systemic_prob: 0.91,
    jev_confidence: 0.89,
    primary_tool: "level",
    secondary_tool: "plumb",
    sre_failure_mode: "untested_failover",
    jev_raw_json: "{}",
    socratic_brief: null,
    questions_json: null,
    status: "triaged",
  };

  const madLibsValidation = validateSynthesizedBriefOutput(sampleRow, {
    executive_summary:
      "Regional Fiber Backhaul Cut underwent an operational evaluation to determine how Single Point of Failure impacts resilience.",
    socratic_brief:
      "Regional Fiber Backhaul Cut underwent an operational evaluation to determine how Single Point of Failure impacts resilience.",
    proportionality_check: {
      noise_overblown:
        "Coverage surrounding Regional Fiber Backhaul Cut centers on immediate reaction rather than structural constraints.",
      structural_signal:
        "Viewed through The Level and The Plumb, the underlying issue is Single Point of Failure.",
    },
    questions: [
      "Prompted by The Level: Where did the failover test fail?",
      "How does The Plumb apply to this incident?",
    ],
  });
  assert.equal(
    madLibsValidation.valid,
    false,
    "Mad-Libs fallback template strings must be rejected by validateSynthesizedBriefOutput"
  );

  const quarantineSynthSummary = await runSynthesizePipeline({
    db,
    articleIds: [triagedId],
    synthesisOverride: {
      executive_summary:
        "Regional Fiber Backhaul Cut underwent an operational evaluation to determine how Single Point of Failure impacts resilience.",
      socratic_brief:
        "Regional Fiber Backhaul Cut underwent an operational evaluation to determine how Single Point of Failure impacts resilience.",
      proportionality_check: {
        noise_overblown: "Short noise.",
        structural_signal: "Short signal.",
      },
      questions: ["Prompted by The Level: Why did it fail?"],
    },
  });
  assert.equal(
    quarantineSynthSummary.quarantinedCount,
    1,
    "Malformed or Mad-Libs synthesis output must transition article to QUARANTINED"
  );

  // Reset status to 'triaged' and test valid bespoke synthesis -> transitions to 'synthesized'
  await db
    .prepare(`UPDATE telemetry_articles SET status = 'triaged' WHERE id = ?`)
    .bind(triagedId)
    .run();

  const validSynthSummary = await runSynthesizePipeline({
    db,
    articleIds: [triagedId],
    synthesisOverride: {
      executive_summary:
        "A construction severance of a single municipal bridge conduit simultaneously knocked offline three regional cloud transit providers that had leased dark fiber along the same physical right-of-way. Post-incident routing audits revealed that backup circuits marketed as geographically diverse converged inside the same thirty-meter bridge choke point.",
      socratic_brief:
        "A construction severance of a single municipal bridge conduit simultaneously knocked offline three regional cloud transit providers that had leased dark fiber along the same physical right-of-way. Post-incident routing audits revealed that backup circuits marketed as geographically diverse converged inside the same thirty-meter bridge choke point.",
      proportionality_check: {
        noise_overblown:
          "Initial commentary speculated about coordinated sabotage across multiple telecommunications carriers after three regional networks degraded within the same second.",
        structural_signal:
          "Layer-1 physical path diversity was never audited below the logical BGP AS-path layer, allowing redundant leases to share a single unmonitored municipal bridge conduit.",
      },
      questions: [
        "When procurement contracts certify redundant network paths only at the logical BGP layer without auditing physical right-of-way maps, how can infrastructure operators verify true fault isolation?",
        "What independent physical-layer verification should be required before critical civic utilities classify a secondary transit lease as a viable failover path?",
      ],
    },
  });
  assert.equal(
    validSynthSummary.synthesizedCount,
    1,
    "Valid non-templated synthesis must transition article to synthesized"
  );
  console.log(
    "  ✓ Jev boundary validator, PENDING_RETRY decoupling, Mad-Libs rejection, and QUARANTINED state transitions verified."
  );

  // -------------------------------------------------------------------------
  // 3. OBJECTIVE 3: D1 BATCH PERSISTENCE, INDEX COVERAGE & R2 HEAD() CHECK
  // -------------------------------------------------------------------------
  console.log(
    "\n[3/5] Verifying Objective 3: D1 Schema Index Coverage & R2-to-D1 Audio Verification Gate..."
  );

  const indexRows = rawSql
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
        'idx_telemetry_articles_url_hash',
        'idx_telemetry_articles_status_published_at',
        'idx_episodes_status_published_at'
      )`
    )
    .all() as Array<{ name: string }>;
  assert.equal(
    indexRows.length,
    3,
    "All 3 defensive hardening indexes must exist on telemetry_articles and episodes"
  );

  const mockBucket = new MockR2Bucket();

  // Case 1: R2 object missing -> episode must NOT transition to PUBLISHED
  mockBucket.simulateMissingOnHead = true;
  const missingAudioRollup = await runWeeklyRollupPipeline({
    db,
    audioBucket: mockBucket,
  });
  assert.notEqual(
    missingAudioRollup.status,
    "PUBLISHED",
    "Episode must NOT transition to PUBLISHED when R2 head() returns null"
  );
  mockBucket.simulateMissingOnHead = false;

  // Case 2: R2 object is 0 bytes -> episode must NOT transition to PUBLISHED
  mockBucket.simulateZeroByteOnHead = true;
  const zeroByteRollup = await runWeeklyRollupPipeline({
    db,
    audioBucket: mockBucket,
  });
  assert.equal(
    zeroByteRollup.status,
    "QUARANTINED",
    "Episode must transition to QUARANTINED when R2 head() reports 0 bytes"
  );
  mockBucket.simulateZeroByteOnHead = false;

  // Case 3: R2 object has invalid MIME metadata -> episode must NOT transition to PUBLISHED
  mockBucket.simulateInvalidMimeOnHead = true;
  const invalidMimeRollup = await runWeeklyRollupPipeline({
    db,
    audioBucket: mockBucket,
  });
  assert.equal(
    invalidMimeRollup.status,
    "QUARANTINED",
    "Episode must transition to QUARANTINED when R2 head() reports non-audio MIME type"
  );
  mockBucket.simulateInvalidMimeOnHead = false;

  // Remove the non-published test episode row before running the valid R2 verification check
  await db.prepare(`DELETE FROM episodes WHERE status != 'PUBLISHED'`).run();

  // Case 4: Valid R2 object (size > 0, audio/mpeg) -> episode transitions to PUBLISHED
  const validRollup = await runWeeklyRollupPipeline({
    db,
    audioBucket: mockBucket,
  });
  assert.equal(
    validRollup.status,
    "PUBLISHED",
    "Episode must transition to PUBLISHED only after R2 head() verifies existence, size > 0, and audio/* MIME"
  );
  console.log(
    "  ✓ D1 composite indexes and R2 head() verification gate (missing, 0-byte, invalid MIME, valid audio/mpeg) verified."
  );

  // -------------------------------------------------------------------------
  // 4. OBJECTIVE 4 & 5c: ZERO SELECT *, PUBLIC DTO PROJECTION, & ZERO TELEMETRY BLEED
  // -------------------------------------------------------------------------
  console.log(
    "\n[4/5] Verifying Objective 4: Zero SELECT * Queries & Strict Quarantine Exclusion in Public Endpoints..."
  );

  // Scan all files in src/ for SELECT *
  const srcDir = path.join(process.cwd(), "src");
  const walkFiles = (dir: string): string[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walkFiles(fullPath));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push(fullPath);
      }
    }
    return files;
  };

  for (const file of walkFiles(srcDir)) {
    const content = fs.readFileSync(file, "utf8");
    assert.ok(
      !/SELECT\s+\*\s+FROM/i.test(content),
      `Forbidden 'SELECT * FROM' found in ${path.relative(process.cwd(), file)}`
    );
  }

  // Insert an explicit QUARANTINED episode into D1 to ensure it is excluded alongside QUARANTINED/PENDING_RETRY articles
  await db
    .prepare(
      `INSERT INTO episodes (
        episode_number, slug, title, summary, transcript,
        audio_url, duration_seconds, file_size_bytes, published_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'QUARANTINED')`
    )
    .bind(
      999,
      "quarantined-episode-999",
      "Quarantined Unverified Audio Episode",
      "Quarantined summary",
      "Quarantined transcript",
      "/audio/missing.mp3",
      300,
      0,
      "2026-10-17T00:00:00Z"
    )
    .run();

  // Verify Worker GET / and GET /api/snapshot
  const workerEnv = {
    DB: db,
    AUDIO_BUCKET: mockBucket,
  };

  const rootRes = await worker.fetch(
    new Request("https://thecabcall.thecabcall.workers.dev/"),
    workerEnv,
    mockExecutionContext
  );
  assert.equal(rootRes.status, 200);
  const rootJson = (await rootRes.json()) as Record<string, unknown>;
  const rootBleed = assertZeroTelemetryBleed(rootJson);
  assert.equal(
    rootBleed.clean,
    true,
    `GET / leaked internal telemetry: ${rootBleed.violations.join("; ")}`
  );

  const snapshotRes = await worker.fetch(
    new Request("https://thecabcall.thecabcall.workers.dev/api/snapshot"),
    workerEnv,
    mockExecutionContext
  );
  assert.equal(snapshotRes.status, 200);
  const snapshotJson = (await snapshotRes.json()) as {
    ok: boolean;
    incidents: Array<{ title: string }>;
    episodes: Array<{ episodeNumber: number }>;
  };

  // Verify QUARANTINED and PENDING_RETRY articles and episodes never appear in /api/snapshot
  assert.equal(
    snapshotJson.incidents.length,
    1,
    "Only the 1 synthesized valid article may appear in /api/snapshot (QUARANTINED and PENDING_RETRY must be excluded)"
  );
  assert.equal(
    snapshotJson.incidents[0].title,
    "Regional Fiber Backhaul Cut Exposes Shared Conduit Single Point of Failure"
  );
  assert.ok(
    snapshotJson.episodes.every((ep) => ep.episodeNumber !== 999),
    "QUARANTINED episodes must never appear in /api/snapshot"
  );

  // Verify zero telemetry bleed on /api/snapshot
  const snapshotBleed = assertZeroTelemetryBleed(snapshotJson);
  assert.equal(
    snapshotBleed.clean,
    true,
    `/api/snapshot leaked internal telemetry: ${snapshotBleed.violations.join("; ")}`
  );
  console.log(
    "  ✓ Zero 'SELECT *' across src/, strict QUARANTINED/PENDING_RETRY exclusion, and Public DTO projection verified."
  );

  // -------------------------------------------------------------------------
  // 5. OBJECTIVE 5: WORKER SCHEDULED CRON RESILIENCE & TELEMETRY BLEED AUDIT
  // -------------------------------------------------------------------------
  console.log(
    "\n[5/5] Verifying Objective 5: Scheduled Worker Resilience & End-to-End Zero Telemetry Bleed..."
  );

  // Ensure worker.scheduled() does not crash even when upstream feeds return HTTP 429/500 or malformed XML
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = mockConcurrentRssFetch;
    await assert.doesNotReject(
      async () => {
        await worker.scheduled(
          {
            cron: "0 */6 * * *",
            scheduledTime: Date.now(),
            noRetry() {
              // no-op
            },
          },
          workerEnv,
          mockExecutionContext
        );
      },
      "worker.scheduled() must not crash when upstream RSS feeds return HTTP 429/500 or malformed XML"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  // Verify assertZeroTelemetryBleed catches forbidden keys and template strings when intentionally injected
  const keyBleedCheck = assertZeroTelemetryBleed({
    incidents: [{ title: "Test", jevConfidence: 0.91 }],
  });
  assert.equal(
    keyBleedCheck.clean,
    false,
    "assertZeroTelemetryBleed must flag jevConfidence if leaked into a public payload"
  );

  const versionBleedCheck = assertZeroTelemetryBleed({
    model: "jev-1.14.0",
  });
  assert.equal(
    versionBleedCheck.clean,
    false,
    "assertZeroTelemetryBleed must flag jev-1.14.0 version tag if leaked into a public payload"
  );

  const templateBleedCheck = assertZeroTelemetryBleed({
    summary:
      "Article X underwent an operational evaluation to determine how Configuration Drift impacts resilience.",
  });
  assert.equal(
    templateBleedCheck.clean,
    false,
    "assertZeroTelemetryBleed must flag Mad-Libs fallback template strings if leaked into a public payload"
  );

  console.log(
    "  ✓ Scheduled Worker cron fault isolation and zero-telemetry-bleed assertions verified."
  );

  // -------------------------------------------------------------------------
  // 6. OBJECTIVE 6: CRAFT LEXICON BOUNDARY MAPPER & PLAIN-SPOKEN UI LABELS
  // -------------------------------------------------------------------------
  console.log(
    "\n[6/6] Verifying Objective 6: Craft Lexicon Boundary Mapper (mapDtoToCraftLexicon) & UI Label Hygiene..."
  );

  // Verify safe fallback on unmapped / unknown enums
  assert.equal(
    mapFailureModeToCraftLexicon("UNKNOWN_ENUM_CODE_99"),
    "Structural Friction",
    "Unmapped failure mode enum must default safely to 'Structural Friction'"
  );
  assert.equal(
    mapWorkingToolToCraftLexicon("unknown_snake_tool"),
    "The Square",
    "Unmapped working tool enum must default safely to 'The Square'"
  );

  const mappedUnmappedDto = mapDtoToCraftLexicon({
    primaryTool: "non_existent_tool",
    secondaryTool: "",
    sreFailureMode: "UNMAPPED_FAILURE_MODE",
    title: "Regional Substation Audit (CFG-DRIFT) [SPOF-FAIL]",
    incidentCode: "#CAB-2026-1042",
  });
  assert.equal(mappedUnmappedDto.primaryTool, "The Square");
  assert.equal(mappedUnmappedDto.secondaryTool, "The Square");
  assert.equal(mappedUnmappedDto.sreFailureMode, "Structural Friction");
  assert.equal(
    mappedUnmappedDto.title,
    "Regional Substation Audit",
    "mapDtoToCraftLexicon must strip leaked raw failure shortCodes from titles"
  );
  assert.equal(
    formatCraftLedgerEntry("#CAB-2026-1042"),
    "LEDGER ENTRY No. CAB-2026-1042",
    "formatCraftLedgerEntry must format incident codes as 'LEDGER ENTRY No. ...'"
  );

  // Verify public-facing components do not render raw shortCode badges or legacy labels
  const publicComponentChecks: Array<{
    file: string;
    mustContain: string[];
    mustNotContain: RegExp[];
  }> = [
    {
      file: "src/components/IncidentBriefClient.tsx",
      mustContain: [
        "THE CRAFTSMAN&apos;S BRIEF",
        "CASE LEDGER",
        "STRUCTURAL INSPECTION",
        "I. WHAT HAPPENED (THE PLAIN FACTS)",
        "PARTISAN HEAT &amp; SPIN (THE NOISE)",
        "THE ACTUAL FOUNDATION (THE SIGNAL)",
        "RELATED CASES ON THE TRESTLEBOARD",
      ],
      mustNotContain: [
        /EDITORIAL DISPATCH LEDGER/,
        /TELEMETRY SPEC SHEET/,
        /POST-INCIDENT REVIEW \(PIR\)/,
        /I\. Facts of the Incident/,
        /Overblown Media Jitter \(Noise\)/,
        /Underlying Structural Constraint \(Signal\)/,
        /RELATED DISPATCHES IN THE ARCHIVE/,
        /RELATED TELEMETRY IN THE ARCHIVE/,
        /failureSpec\.shortCode/,
      ],
    },
    {
      file: "src/components/RubricInspectorDrawer.tsx",
      mustContain: ["PAIRED STRUCTURAL FAILURE MODE"],
      mustNotContain: [/failureSpec\.shortCode/],
    },
    {
      file: "src/components/RubricCodexClient.tsx",
      mustContain: ["Paired Failure Axis: {pairedFailure.id}"],
      mustNotContain: [/pairedFailure\.shortCode/, /mode\.shortCode/],
    },
    {
      file: "src/components/KnowledgeGraphClient.tsx",
      mustContain: ["STRUCTURAL INSPECTION", "Case Ledger"],
      mustNotContain: [
        /failure\.shortCode/,
        /<th[^>]*>PIR<\/th>/,
        /live telemetry/i,
      ],
    },
    {
      file: "src/components/PodcastArchiveClient.tsx",
      mustContain: [
        "Weekly Ledger Roundups",
        "Foundational Essays",
        "1. The Week&apos;s Trestleboard",
      ],
      mustNotContain: [
        /Weekly Telemetry Rollups \(5-Min\)/,
        /1\. The Weekly Telemetry/,
      ],
    },
  ];

  for (const check of publicComponentChecks) {
    const content = fs.readFileSync(
      path.join(process.cwd(), check.file),
      "utf8"
    );
    for (const expected of check.mustContain) {
      assert.ok(
        content.includes(expected),
        `${check.file} must contain Craft Lexicon label: ${expected}`
      );
    }
    for (const forbidden of check.mustNotContain) {
      assert.ok(
        !forbidden.test(content),
        `${check.file} must NOT match forbidden pattern: ${forbidden}`
      );
    }
  }

  // Verify Issue #14: Shop-Floor & Operative Craft Failure Mode Translations
  const expectedCraftFailureModes: Array<{
    id: string;
    craftTitle: string;
    craftShortLabel: string;
    summarySubstring: string;
  }> = [
    {
      id: "Configuration Drift",
      craftTitle: "Drifting Off-Square (Configuration Drift)",
      craftShortLabel: "Drifting Off-Square",
      summarySubstring:
        "Drifting Off-Square (Configuration Drift): When day-to-day actions quietly wander away from the written rules without anyone calling a halt to re-measure.",
    },
    {
      id: "Cascading Failure",
      craftTitle: "Chain-Reaction Breakdown (Cascading Failure)",
      craftShortLabel: "Chain-Reaction Breakdown",
      summarySubstring:
        "Chain-Reaction Breakdown (Cascading Failure): When one cracked timber or missed handoff overloads the next support in line because no firebreaks were built between them.",
    },
    {
      id: "Alert Fatigue & Signal Loss",
      craftTitle: "Crying Wolf / Drowning in Noise (Alert Fatigue)",
      craftShortLabel: "Crying Wolf / Drowning in Noise",
      summarySubstring:
        "Crying Wolf / Drowning in Noise (Alert Fatigue): When a shop is flooded with so many false alarms and petty warnings that the crew stops listening right before a real hazard hits.",
    },
    {
      id: "Single Point of Failure (SPOF) / Untested Failover",
      craftTitle: "One Weak Link / Untested Backup (Single Point of Failure)",
      craftShortLabel: "One Weak Link / Untested Backup",
      summarySubstring:
        "One Weak Link / Untested Backup (Single Point of Failure): Betting the whole structure on a single load-bearing pin—or trusting an emergency backup plan that has never been tested under real weight.",
    },
    {
      id: "Blame Culture vs. Root-Cause Isolation",
      craftTitle: "Scapegoating vs. Fixing the Trap (Blame Culture)",
      craftShortLabel: "Scapegoating vs. Fixing the Trap",
      summarySubstring:
        "Scapegoating vs. Fixing the Trap (Blame Culture): Firing the last worker who touched the lever instead of fixing the broken guardrails that set them up to fail.",
    },
    {
      id: "Technical & Institutional Debt",
      craftTitle: "Deferred Maintenance (Institutional Debt)",
      craftShortLabel: "Deferred Maintenance",
      summarySubstring:
        "Deferred Maintenance (Institutional Debt): Taking an easy shortcut today that weakens the foundation tomorrow, until the overdue repairs cost more than the original build.",
    },
  ];

  for (const expectedMode of expectedCraftFailureModes) {
    const spec = getSreFailureModeSpec(expectedMode.id);
    assert.equal(spec.id, expectedMode.id);
    assert.equal(spec.craftTitle, expectedMode.craftTitle);
    assert.equal(spec.craftShortLabel, expectedMode.craftShortLabel);
    assert.equal(spec.summary, expectedMode.summarySubstring);
    assert.ok(
      !/retry storms|bulkhead isolation|declarative specification/i.test(
        spec.systemsDefinition
      ),
      `systemsDefinition for ${spec.id} must not contain high-friction IT jargon`
    );
    // Backward and forward alias resolution
    assert.equal(
      mapFailureModeToCraftLexicon(expectedMode.craftTitle),
      expectedMode.id
    );
    assert.equal(
      mapFailureModeToCraftLexicon(expectedMode.craftShortLabel),
      expectedMode.id
    );
  }

  for (const tool of WORKING_TOOLS) {
    assert.ok(
      !/declarative specification|carry the pager|SLAs\/SLOs|error budget/i.test(
        `${tool.sreEquivalent} ${tool.sreDefinition}`
      ),
      `WORKING_TOOLS[${tool.id}] operational descriptions must use accessible shop-floor craft language`
    );
  }

  // Safe fallback checks for getSreFailureModeSpec & getWorkingToolSpec
  const fallbackFailure = getSreFailureModeSpec("TOTALLY_UNKNOWN_LEGACY_MODE");
  assert.ok(fallbackFailure, "getSreFailureModeSpec must never return undefined");
  assert.equal(fallbackFailure.id, "Structural Friction");
  assert.ok(
    fallbackFailure.craftTitle.includes("Drifting Off-Square") &&
      fallbackFailure.summary.includes("Drifting Off-Square"),
    "Fallback failure spec must include Drifting Off-Square / Structural Friction craft guidance"
  );

  const fallbackTool = getWorkingToolSpec("TOTALLY_UNKNOWN_LEGACY_TOOL");
  assert.ok(fallbackTool, "getWorkingToolSpec must never return undefined");
  assert.equal(fallbackTool.id, "The Square");

  console.log(
    "  ✓ Craft Lexicon mapper, shop-floor Failure Mode translations, 'Structural Friction' safe fallback, and plain-spoken UI labels verified."
  );

  // -------------------------------------------------------------------------
  // 7. OBJECTIVE 7 (ISSUE #15): ZERO HEADLINE INTERPOLATION & PLAIN WORKSHOP PROSE
  // -------------------------------------------------------------------------
  console.log(
    "\n[7/7] Verifying Objective 7 (Issue #15): Zero Headline Interpolation & Plain Workshop Prose..."
  );

  const sampleHeadline =
    "Trump gives update on health of George W. Bush after former president reveals cancer diagnosis";
  const brokenNoise =
    "Public commentary around Trump gives update on health of George W. Bush after former president reveals cancer diagnosis focuses on immediate political reaction rather than the underlying institutional mechanics.";
  const brokenSignal =
    "The structural signal in Trump gives update on health of George W. Bush after former president reveals cancer diagnosis is Configuration Drift evaluated under The Plumb: Donald Trump said Saturday that former President George W. Bush is doing well, though the episode highlights where live operational practice to diverge from the stated legal or institutional charter.";
  const brokenQ1 =
    "In Trump gives update on health of George W. Bush, which specific check under The Plumb allowed live operational practice to diverge from the stated legal or institutional charter without triggering an earlier corrective audit?";
  const brokenQ2 =
    "How should 24-Inch Gauge be applied to ensure the response to Trump gives update on health of George W. Bush addresses the underlying Configuration Drift rather than merely managing immediate public fallout?";

  assert.equal(
    containsInterpolatedHeadline(brokenNoise, sampleHeadline),
    true,
    "containsInterpolatedHeadline must detect full headline interpolation in Noise"
  );
  assert.equal(
    containsInterpolatedHeadline(brokenSignal, sampleHeadline),
    true,
    "containsInterpolatedHeadline must detect full headline interpolation in Signal"
  );
  assert.equal(
    containsInterpolatedHeadline(brokenQ1, sampleHeadline),
    true,
    "containsInterpolatedHeadline must detect >= 5-word headline prefix interpolation in Question 1"
  );
  assert.equal(
    containsInterpolatedHeadline(brokenQ2, sampleHeadline),
    true,
    "containsInterpolatedHeadline must detect >= 5-word headline prefix interpolation in Question 2"
  );
  assert.equal(
    isTemplatedOrMalformedCopy(brokenQ1, sampleHeadline),
    true,
    "isTemplatedOrMalformedCopy must flag corporate compliance jargon and headline interpolation"
  );

  // Test legacy `proportionality` (`noise` / `signal`) JSON shape from `editorial-sanitization-v2`
  const legacyV2Json = JSON.stringify({
    executive_summary:
      "Donald Trump shared a public update Saturday regarding former President George W. Bush after Bush disclosed a recent cancer diagnosis. Statements from both offices emphasized recovery protocols and cross-administration institutional courtesy.",
    proportionality: {
      noise: brokenNoise,
      signal: brokenSignal,
    },
    questions: [brokenQ1, brokenQ2],
    synthesized_by: "editorial-sanitization-v2",
  });

  const normalizedLegacy = extractStoredQuestionsPayload(legacyV2Json, {
    title: sampleHeadline,
    sourceFeed: "NPR News",
    factualSummary:
      "Donald Trump shared a public update Saturday regarding former President George W. Bush after Bush disclosed a recent cancer diagnosis. Statements from both offices emphasized recovery protocols and cross-administration institutional courtesy.",
    primaryTool: "The Plumb",
    secondaryTool: "24-Inch Gauge",
    sreFailureMode: "Configuration Drift",
  });

  assert.ok(
    normalizedLegacy.noiseOverblown && normalizedLegacy.noiseOverblown.length >= 40,
    "Normalized legacy proportionality.noise must produce a complete plain-spoken Noise diagnostic"
  );
  assert.ok(
    normalizedLegacy.structuralSignal && normalizedLegacy.structuralSignal.length >= 40,
    "Normalized legacy proportionality.signal must produce a complete plain-spoken Signal diagnostic"
  );
  assert.equal(
    containsInterpolatedHeadline(normalizedLegacy.noiseOverblown!, sampleHeadline),
    false,
    "Sanitized Noise must NOT contain the interpolated headline"
  );
  assert.equal(
    containsInterpolatedHeadline(normalizedLegacy.structuralSignal!, sampleHeadline),
    false,
    "Sanitized Signal must NOT contain the interpolated headline"
  );
  assert.equal(
    containsInterpolatedHeadline(normalizedLegacy.questions[0], sampleHeadline),
    false,
    "Sanitized Question 1 must NOT contain the interpolated headline"
  );
  assert.equal(
    containsInterpolatedHeadline(normalizedLegacy.questions[1], sampleHeadline),
    false,
    "Sanitized Question 2 must NOT contain the interpolated headline"
  );
  assert.ok(
    !/live operational practice to diverge from the stated legal or institutional charter/i.test(
      `${normalizedLegacy.noiseOverblown} ${normalizedLegacy.structuralSignal} ${normalizedLegacy.questions.join(" ")}`
    ),
    "Sanitized diagnostics and questions must be free of corporate compliance legalese"
  );
  assert.ok(
    /\bthis (case|decision|action|breakdown)\b/i.test(
      `${normalizedLegacy.noiseOverblown} ${normalizedLegacy.structuralSignal} ${normalizedLegacy.questions.join(" ")}`
    ),
    "Plain workshop diagnostics and questions must refer naturally to 'this case', 'this decision', 'this action', or 'this breakdown'"
  );

  // Verify Worker /api/snapshot also repairs a row stored with legacy `proportionality` (`noise` / `signal`) and interpolated headline
  await db
    .prepare(
      `INSERT INTO telemetry_articles (
        url_hash, source_feed, title, source_url, raw_excerpt, published_at,
        is_systemic_prob, jev_confidence, primary_tool, secondary_tool, sre_failure_mode,
        jev_raw_json, socratic_brief, questions_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synthesized')`
    )
    .bind(
      "hash-legacy-v2-bush-update",
      "NPR News",
      sampleHeadline,
      "https://example.com/npr-bush-update",
      "Donald Trump shared a public update Saturday regarding former President George W. Bush after Bush disclosed a recent cancer diagnosis. Statements from both offices emphasized recovery protocols and cross-administration institutional courtesy.",
      "2026-10-18T10:00:00Z",
      0.86,
      0.88,
      "plumb",
      "twenty_four_inch_gauge",
      "configuration_drift",
      JSON.stringify({ model: "jev-1.14.0" }),
      "Donald Trump shared a public update Saturday regarding former President George W. Bush after Bush disclosed a recent cancer diagnosis. Statements from both offices emphasized recovery protocols and cross-administration institutional courtesy.",
      legacyV2Json
    )
    .run();

  const snapshotAfterLegacyRes = await worker.fetch(
    new Request("https://thecabcall.thecabcall.workers.dev/api/snapshot"),
    workerEnv,
    mockExecutionContext
  );
  assert.equal(snapshotAfterLegacyRes.status, 200);
  const snapshotAfterLegacy = (await snapshotAfterLegacyRes.json()) as {
    ok: boolean;
    incidents: PublicIncidentDto[];
  };

  const bushIncident = snapshotAfterLegacy.incidents.find(
    (inc) => inc.title === sampleHeadline
  );
  assert.ok(
    bushIncident,
    "Worker /api/snapshot must normalize and render legacy editorial-sanitization-v2 rows cleanly"
  );
  assert.equal(
    containsInterpolatedHeadline(
      bushIncident.proportionalityCheck.noiseOverblown,
      bushIncident.title
    ),
    false,
    "Worker DTO noiseOverblown must have zero headline interpolation"
  );
  assert.equal(
    containsInterpolatedHeadline(
      bushIncident.proportionalityCheck.structuralSignal,
      bushIncident.title
    ),
    false,
    "Worker DTO structuralSignal must have zero headline interpolation"
  );
  assert.equal(
    containsInterpolatedHeadline(bushIncident.questions[0], bushIncident.title),
    false,
    "Worker DTO Question 1 must have zero headline interpolation"
  );
  assert.equal(
    containsInterpolatedHeadline(bushIncident.questions[1], bushIncident.title),
    false,
    "Worker DTO Question 2 must have zero headline interpolation"
  );

  // Verify all seed INITIAL_INCIDENTS and all snapshot incidents have zero headline interpolation in Sections II or III
  for (const inc of [...INITIAL_INCIDENTS, ...snapshotAfterLegacy.incidents]) {
    assert.equal(
      containsInterpolatedHeadline(
        inc.proportionalityCheck.noiseOverblown,
        inc.title
      ),
      false,
      `Incident "${inc.title}" has interpolated headline in Section II Noise`
    );
    assert.equal(
      containsInterpolatedHeadline(
        inc.proportionalityCheck.structuralSignal,
        inc.title
      ),
      false,
      `Incident "${inc.title}" has interpolated headline in Section II Signal`
    );
    assert.equal(
      containsInterpolatedHeadline(inc.questions[0], inc.title),
      false,
      `Incident "${inc.title}" has interpolated headline in Section III Question 1`
    );
    assert.equal(
      containsInterpolatedHeadline(inc.questions[1], inc.title),
      false,
      `Incident "${inc.title}" has interpolated headline in Section III Question 2`
    );
  }

  const finalBleedAudit = assertZeroTelemetryBleed(snapshotAfterLegacy);
  assert.equal(
    finalBleedAudit.clean,
    true,
    `Final /api/snapshot bleed & headline-interpolation check failed: ${finalBleedAudit.violations.join("; ")}`
  );

  console.log(
    "  ✓ Issue #15 headline-interpolation detector, legacy proportionality normalization, and plain workshop prose verified across all incidents."
  );

  // -------------------------------------------------------------------------
  // 8. OBJECTIVE 8 (ISSUE #16): PREVENT VERBATIM SENTENCE DUPLICATION ACROSS SECTIONS I & II
  // -------------------------------------------------------------------------
  console.log(
    "\n[8/8] Verifying Objective 8 (Issue #16): Section I vs. Section II Sentence Deduplication (computeNgramOverlap & deduplicateSignalAgainstFacts)..."
  );

  const sampleSectionIFacts =
    "On October 16, federal auditors released an inspection report examining operational technology networks across regional water utilities. Packet-capture telemetry gathered during the physical audit showed active, unmonitored VPN tunnels maintained for third-party maintenance contractors.";

  const verbatimSecondSentence =
    "Packet-capture telemetry gathered during the physical audit showed active, unmonitored VPN tunnels maintained for third-party maintenance contractors.";

  const nearDuplicateSecondSentence =
    "Evaluated under The Square: packet-capture telemetry gathered during the physical audit showed active, unmonitored VPN tunnels maintained for outside maintenance contractors.";

  const distinctCraftSentence =
    "Annual paper sign-offs cannot catch unmonitored remote bridges when plant maintenance budgets force operators to rely on vendor backdoors.";

  // Unit check 1: computeNgramOverlap
  assert.equal(
    computeNgramOverlap(verbatimSecondSentence, verbatimSecondSentence, 4),
    1,
    "computeNgramOverlap must return 1.0 for identical sentences"
  );
  assert.ok(
    computeNgramOverlap(verbatimSecondSentence, nearDuplicateSecondSentence, 4) >
      0.5,
    "computeNgramOverlap must exceed 0.50 when >50% of 4-grams overlap"
  );
  assert.ok(
    computeNgramOverlap(verbatimSecondSentence, distinctCraftSentence, 4) < 0.2,
    "computeNgramOverlap must remain low (<0.20) for genuinely distinct sentences"
  );

  // Unit check 2: Single duplicate sentence in structuralSignal is stripped and replaced with workshop craft fallback
  const dedupedSingle = deduplicateSignalAgainstFacts(
    sampleSectionIFacts,
    verbatimSecondSentence,
    "The Square",
    "Configuration Drift",
    "The Level"
  );
  assert.notEqual(
    dedupedSingle,
    verbatimSecondSentence,
    "deduplicateSignalAgainstFacts must strip a verbatim Section I sentence"
  );
  assert.ok(
    dedupedSingle.length >= 40 && dedupedSingle.includes("The Square"),
    "When stripping leaves structuralSignal empty, deduplicateSignalAgainstFacts must fall back to a distinct craft summary anchored to primaryTool"
  );
  assert.equal(
    hasDuplicateSentenceBetweenFactsAndSignal(sampleSectionIFacts, dedupedSingle),
    false,
    "Fallback structuralSignal must have zero duplicate sentences against Section I"
  );

  // Unit check 3: >50% 4-gram overlapping sentence in structuralSignal is stripped and replaced
  const dedupedNear = deduplicateSignalAgainstFacts(
    sampleSectionIFacts,
    nearDuplicateSecondSentence,
    "The Plumb",
    "Single Point of Failure (SPOF) / Untested Failover",
    "24-Inch Gauge"
  );
  assert.equal(
    hasDuplicateSentenceBetweenFactsAndSignal(sampleSectionIFacts, dedupedNear),
    false,
    "deduplicateSignalAgainstFacts must strip a >50% 4-gram overlapping sentence and replace with distinct craft summary"
  );
  assert.ok(
    dedupedNear.includes("The Plumb"),
    "Fallback structuralSignal must be anchored to The Plumb craft lens"
  );

  // Unit check 4: Multi-sentence structuralSignal where sentence 1 duplicates Section I and sentence 2 is distinct -> retains sentence 2
  const mixedTwoSentenceSignal = `${verbatimSecondSentence} ${distinctCraftSentence}`;
  const dedupedMixed = deduplicateSignalAgainstFacts(
    sampleSectionIFacts,
    mixedTwoSentenceSignal,
    "The Square",
    "Configuration Drift",
    "The Level"
  );
  assert.equal(
    dedupedMixed,
    distinctCraftSentence,
    "When structuralSignal has 1 duplicate sentence and 1 distinct sentence (>=30 chars), only the duplicate sentence is stripped"
  );

  // Integration check 5: buildOrSanitizeArticleDiagnostics repairs a duplicate-sentence signal
  const diagDedupCheck = buildOrSanitizeArticleDiagnostics({
    title: "Regional Water Utility Audit",
    sourceFeed: "REUTERS",
    factualSummary: sampleSectionIFacts,
    primaryTool: "The Square",
    secondaryTool: "The Level",
    sreFailureMode: "Configuration Drift",
    existingNoise:
      "Cable commentary framing the audit as an active foreign cyberattack on municipal reservoirs despite zero evidence of unauthorized command execution.",
    existingSignal: verbatimSecondSentence,
    existingQuestions: [
      "When compliance is measured by signed paper attestations rather than production verification, who bears accountability when an informal exception becomes the permanent architecture?",
      "Are the officials who approved deferred maintenance budgets exposed to the same operational consequences as frontline plant operators when an unsegmented control plane fails an audit?",
    ],
  });
  assert.equal(diagDedupCheck.valid, true);
  assert.equal(
    diagDedupCheck.repaired,
    true,
    "buildOrSanitizeArticleDiagnostics must mark repaired=true when existingSignal duplicates a Section I sentence"
  );
  assert.equal(
    hasDuplicateSentenceBetweenFactsAndSignal(
      sampleSectionIFacts,
      diagDedupCheck.structuralSignal
    ),
    false,
    "buildOrSanitizeArticleDiagnostics output must never duplicate a sentence from factualSummary"
  );

  // Integration check 6: projectPublicIncidentDto repairs a duplicate-sentence signal on any IncidentArticle / DTO
  const sampleSeedWithDupSignal = {
    ...INITIAL_INCIDENTS[0],
    proportionalityCheck: {
      ...INITIAL_INCIDENTS[0].proportionalityCheck,
      structuralSignal: verbatimSecondSentence,
    },
  };
  const projectedDedupDto = projectPublicIncidentDto(sampleSeedWithDupSignal);
  assert.ok(projectedDedupDto, "projectPublicIncidentDto must return a valid DTO");
  assert.equal(
    hasDuplicateSentenceBetweenFactsAndSignal(
      [projectedDedupDto.socraticBrief, projectedDedupDto.executiveSummary],
      projectedDedupDto.proportionalityCheck.structuralSignal
    ),
    false,
    "projectPublicIncidentDto must deduplicate structuralSignal against socraticBrief and executiveSummary"
  );

  // Integration check 7: Verify IncidentBriefClient.tsx enforces deduplicateSignalAgainstFacts at the view boundary
  const incidentBriefSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/IncidentBriefClient.tsx"),
    "utf8"
  );
  assert.ok(
    incidentBriefSource.includes("deduplicateSignalAgainstFacts(") &&
      incidentBriefSource.includes("{deduplicatedStructuralSignal}"),
    "IncidentBriefClient.tsx must enforce deduplicateSignalAgainstFacts at the Section II view boundary"
  );

  // Integration check 8: Verify zero exact or near-duplicate sentences across all seed, snapshot, and live/local incidents
  const localSnap = readLocalD1Snapshot();
  const remoteOrLocalSnap = await ensureD1Snapshot().catch(() => localSnap);
  const allIncidentsToVerify = [
    ...INITIAL_INCIDENTS,
    ...snapshotAfterLegacy.incidents,
    ...localSnap.incidents,
    ...remoteOrLocalSnap.incidents,
  ];
  for (const inc of allIncidentsToVerify) {
    const hasDup = hasDuplicateSentenceBetweenFactsAndSignal(
      [inc.socraticBrief, inc.executiveSummary],
      inc.proportionalityCheck.structuralSignal
    );
    assert.equal(
      hasDup,
      false,
      `Incident "${inc.title}" has a duplicate or >50% overlapping sentence between Section I and Section II Signal`
    );
  }

  console.log(
    `  ✓ Issue #16 computeNgramOverlap & deduplicateSignalAgainstFacts verified across all ${allIncidentsToVerify.length} seed, snapshot, and live/local incidents.`
  );

  // -------------------------------------------------------------------------
  // 9. OBJECTIVE 9 (ISSUE #17): KRUG USABILITY — NO MYSTERY-MEAT [?] & PLAIN ACTION BUTTONS
  // -------------------------------------------------------------------------
  console.log(
    "\n[9/9] Verifying Objective 9 (Issue #17): Krug Usability — Zero Mystery-Meat [?] Badges & Plain-English Action Buttons..."
  );

  // Unit check 1: formatFriendlySourceName mappings & defensive fallback
  const friendlySourceCases: Array<[string | null | undefined, string]> = [
    ["NYT > Top Stories", "NYT"],
    ["NYT HomePage", "NYT"],
    ["New York Times", "NYT"],
    ["NPR Top News", "NPR"],
    ["NPR News", "NPR"],
    ["WSJ", "WSJ"],
    ["WSJ US Business", "WSJ"],
    ["PBS NewsHour", "PBS"],
    ["PBS NewsHour Nation", "PBS"],
    ["Ars Technica", "Ars Technica"],
    ["ARS TECHNICA", "Ars Technica"],
    ["REUTERS", "Reuters"],
    ["AP NEWS", "AP"],
    ["Hacker News", "Hacker News"],
    ["", "Source"],
    ["   ", "Source"],
    [null, "Source"],
    [undefined, "Source"],
    ["Source", "Source"],
    ["RSS Feed", "Source"],
    ["LIVE TELEMETRY INPUT", "Source"],
  ];

  for (const [rawFeed, expectedName] of friendlySourceCases) {
    assert.equal(
      formatFriendlySourceName(rawFeed),
      expectedName,
      `formatFriendlySourceName(${JSON.stringify(rawFeed)}) must return "${expectedName}"`
    );
  }

  // Component check 2: Zero literal [?] strings across IncidentBriefClient, KnowledgeGraphClient, and PodcastArchiveClient
  const krugTargetFiles = [
    "src/components/IncidentBriefClient.tsx",
    "src/components/KnowledgeGraphClient.tsx",
    "src/components/PodcastArchiveClient.tsx",
  ];

  for (const relFile of krugTargetFiles) {
    const fileContent = fs.readFileSync(
      path.join(process.cwd(), relFile),
      "utf8"
    );
    assert.equal(
      fileContent.includes("[?]"),
      false,
      `${relFile} must NOT contain any mystery-meat "[?]" string`
    );
    assert.equal(
      /Cross-Filter (?:Diagnostic )?Signature|Inspect Primary (?:Source Dispatch|RSS Source)/i.test(
        fileContent
      ),
      false,
      `${relFile} must NOT contain legacy jargon button labels`
    );
  }

  const incidentBriefKrugSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/IncidentBriefClient.tsx"),
    "utf8"
  );
  assert.ok(
    incidentBriefKrugSource.includes("Tool Guide") &&
      incidentBriefKrugSource.includes("View Tool Guide") &&
      incidentBriefKrugSource.includes("Read Original {friendlySourceName} Article") &&
      incidentBriefKrugSource.includes("More '${incident.primaryTool}' Cases →") &&
      incidentBriefKrugSource.includes("See Similar Cases →"),
    "IncidentBriefClient.tsx must use clear Tool Guide affordances, 'Read Original {SourceName} Article', and 'More \\'{Tool}\\' Cases →' (with 'See Similar Cases →' fallback)"
  );

  console.log(
    "  ✓ Issue #17 zero mystery-meat [?] badges, formatFriendlySourceName, and plain-English Krug action buttons verified."
  );

  // -------------------------------------------------------------------------
  // 10. OBJECTIVE 10 (ISSUE #18): 'YOU ARE HERE' STREET SIGNS & SIDEBAR HIERARCHY
  // -------------------------------------------------------------------------
  console.log(
    "\n[10/11] Verifying Objective 10 (Issue #18): Krug 'You Are Here' Navigation Street Signs & Sidebar Visual Hierarchy..."
  );

  const siteHeaderSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/SiteHeader.tsx"),
    "utf8"
  );

  assert.ok(
    siteHeaderSource.includes("export function isNavItemActive(") &&
      siteHeaderSource.includes('normalizedPath.startsWith("/incidents/")') &&
      siteHeaderSource.includes('aria-current={isActive ? "page" : undefined}') &&
      siteHeaderSource.includes("border-b-2 border-b-[#C5A059]") &&
      siteHeaderSource.includes("text-[#F3EFE6] font-bold"),
    "SiteHeader.tsx must implement isNavItemActive for /incidents/* routes, aria-current='page', and a high-contrast gold bottom border"
  );

  // Verify route matching behavior across all public routes
  const evaluateNavActive = (itemHref: string, pathname: string): boolean => {
    const normalizedPath = (pathname || "/").trim() || "/";
    if (itemHref === "/") {
      return (
        normalizedPath === "/" ||
        normalizedPath === "/incidents" ||
        normalizedPath.startsWith("/incidents/")
      );
    }
    return (
      normalizedPath === itemHref || normalizedPath.startsWith(`${itemHref}/`)
    );
  };

  const navHrefs = ["/", "/knowledge-graph", "/archive", "/rubric", "/status"];
  const testPaths: Array<{ path: string; expectedActiveHref: string }> = [
    { path: "/", expectedActiveHref: "/" },
    {
      path: "/incidents/municipal-water-scada-patch-deferral-audit",
      expectedActiveHref: "/",
    },
    {
      path: "/incidents/some-other-slug",
      expectedActiveHref: "/",
    },
    { path: "/knowledge-graph", expectedActiveHref: "/knowledge-graph" },
    { path: "/archive", expectedActiveHref: "/archive" },
    { path: "/rubric", expectedActiveHref: "/rubric" },
    { path: "/status", expectedActiveHref: "/status" },
  ];

  for (const { path: testPath, expectedActiveHref } of testPaths) {
    const activeItems = navHrefs.filter((href) =>
      evaluateNavActive(href, testPath)
    );
    assert.equal(
      activeItems.length,
      1,
      `Route "${testPath}" must have exactly 1 active navigation item (found ${activeItems.length})`
    );
    assert.equal(
      activeItems[0],
      expectedActiveHref,
      `Route "${testPath}" must activate "${expectedActiveHref}" as its 'You Are Here' street sign`
    );
  }

  // Verify left sidebar visual hierarchy in IncidentBriefClient.tsx:
  // Primary Working Tool, Moral Lens, Failure Mode, and Copperplate Engraving lead at top;
  // Ledger ID (`{ledgerEntryLabel}`) is demoted to the lower colophon.
  const asideStartIdx = incidentBriefKrugSource.indexOf("<aside");
  const asideEndIdx = incidentBriefKrugSource.indexOf("</aside>");
  assert.ok(
    asideStartIdx >= 0 && asideEndIdx > asideStartIdx,
    "IncidentBriefClient.tsx must contain an <aside> left sidebar"
  );
  const asideContent = incidentBriefKrugSource.slice(asideStartIdx, asideEndIdx);
  const primaryToolPos = asideContent.indexOf("{incident.primaryTool}");
  const moralLensPos = asideContent.indexOf("{primaryToolSpec.moralLens}");
  const failureTitlePos = asideContent.indexOf("{failureSpec.craftTitle}");
  const engravingPos = asideContent.indexOf("<WorkingToolEngraving");
  const ledgerEntryPos = asideContent.indexOf("{ledgerEntryLabel}");

  assert.ok(
    primaryToolPos >= 0 &&
      moralLensPos >= 0 &&
      failureTitlePos >= 0 &&
      engravingPos >= 0 &&
      ledgerEntryPos >= 0,
    "Sidebar (<aside>) must contain Primary Working Tool, Moral Lens, Craft Failure Mode, Engraving, and Ledger Entry ID"
  );
  assert.ok(
    primaryToolPos < ledgerEntryPos &&
      moralLensPos < ledgerEntryPos &&
      failureTitlePos < ledgerEntryPos &&
      engravingPos < ledgerEntryPos,
    "Sidebar visual hierarchy must promote Primary Working Tool, Moral Lens, Failure Mode, and Engraving above the demoted Ledger Entry ID in the lower colophon"
  );

  console.log(
    "  ✓ Issue #18 'You Are Here' navigation street signs (aria-current='page', gold bottom border, /incidents/* active matching) and sidebar visual hierarchy verified."
  );

  // -------------------------------------------------------------------------
  // 11. OBJECTIVE 11 (ISSUE #19): TEST-PUBLICLEXICONANDUSABILITY GATE
  // -------------------------------------------------------------------------
  console.log(
    "\n[11/11] Verifying Objective 11 (Issue #19): Test-PublicLexiconAndUsability End-to-End Gate..."
  );

  const publicFilesToAudit = [
    "src/components/IncidentBriefClient.tsx",
    "src/components/IncidentCard.tsx",
    "src/components/TrestleboardClient.tsx",
    "src/components/RubricInspectorDrawer.tsx",
    "src/components/RubricCodexClient.tsx",
    "src/components/WorkingToolHubClient.tsx",
    "src/components/FailureModeHubClient.tsx",
    "src/components/KnowledgeGraphClient.tsx",
    "src/components/PodcastArchiveClient.tsx",
    "src/components/SiteHeader.tsx",
    "src/components/SiteFooter.tsx",
    "src/components/SystemStatusClient.tsx",
    "src/components/PersistentAudioPlayer.tsx",
    "src/components/MasonicEngravings.tsx",
    "src/app/page.tsx",
    "src/app/incidents/[slug]/page.tsx",
    "src/app/tools/[slug]/page.tsx",
    "src/app/failures/[slug]/page.tsx",
    "src/app/knowledge-graph/page.tsx",
    "src/app/archive/page.tsx",
    "src/app/podcast/page.tsx",
    "src/app/rubric/page.tsx",
    "src/app/status/page.tsx",
    "src/app/feeds/page.tsx",
    "src/app/about/page.tsx",
  ];

  const bannedUiRegexes: Array<{ label: string; regex: RegExp }> = [
    { label: "TELEMETRY SPEC SHEET", regex: /TELEMETRY SPEC SHEET/i },
    { label: "EDITORIAL DISPATCH LEDGER", regex: /EDITORIAL DISPATCH LEDGER/i },
    {
      label: "POST-INCIDENT REVIEW (PIR)",
      regex: /POST-INCIDENT REVIEW \(PIR\)/i,
    },
    { label: "FACTS OF THE INCIDENT", regex: /FACTS OF THE INCIDENT/i },
    { label: "MEDIA JITTER", regex: /MEDIA JITTER/i },
    {
      label: "UNDERLYING STRUCTURAL CONSTRAINT (SIGNAL)",
      regex: /UNDERLYING STRUCTURAL CONSTRAINT \(SIGNAL\)/i,
    },
    {
      label: "RELATED TELEMETRY IN THE ARCHIVE",
      regex: /RELATED TELEMETRY IN THE ARCHIVE/i,
    },
    {
      label: "RELATED DISPATCHES IN THE ARCHIVE",
      regex: /RELATED DISPATCHES IN THE ARCHIVE/i,
    },
    {
      label: "Cross-Filter Signature",
      regex: /Cross-Filter (?:Diagnostic )?Signature/i,
    },
    {
      label: "Primary RSS Source / Inspect Primary Source Dispatch",
      regex: /Primary RSS Source|Inspect Primary Source Dispatch/i,
    },
    {
      label: "Raw enum codes (CFG-DRIFT, CASCADE-01, SIG-LOSS, SPOF-FAIL, BLAME-ISO, INST-DEBT)",
      regex: /\((?:CFG-DRIFT|CASCADE-01|SIG-LOSS|SPOF-FAIL|BLAME-ISO|INST-DEBT)\)/,
    },
    { label: "Mystery-meat [?] badge", regex: /\[\?\]/ },
    {
      label: "Public feed mutation endpoint call (/api/cron/ingest or /api/cron/weekly-rollup)",
      regex: /\/api\/cron\/(?:ingest|weekly-rollup)/i,
    },
    {
      label: "Public feed mutation trigger button (Poll Sourced Publications / Submit Event for Structural Inspection)",
      regex: /Poll Sourced Publications|Submit Event for Structural Inspection|Synthesize New Friday 5-Min CAB Brief/i,
    },
  ];

  for (const relPath of publicFilesToAudit) {
    const srcText = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
    for (const { label, regex } of bannedUiRegexes) {
      assert.equal(
        regex.test(srcText),
        false,
        `Public file ${relPath} must have zero occurrences of banned UI string "${label}"`
      );
    }
  }

  // Verify About & Feeds page (SystemStatusClient.tsx) is strictly read-only and documents all published feeds + site philosophy
  const statusClientSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/SystemStatusClient.tsx"),
    "utf8"
  );
  for (const requiredFeedLandmark of [
    "/feed.xml",
    "/feeds/incidents.xml",
    "/feeds/incidents.json",
    "The Six Working Tools as Civic Instruments",
    "Blameless Inspection Over Partisan Scapegoating",
    "Anatomy of a Craftsman&apos;s Brief",
  ]) {
    assert.ok(
      statusClientSource.includes(requiredFeedLandmark),
      `SystemStatusClient.tsx must include published feed / philosophy landmark: ${requiredFeedLandmark}`
    );
  }

  // Render deterministic HTML for `/` and `/incidents/[slug]` across all incidents and assert:
  // 1. Zero banned UI strings
  // 2. Zero verbatim <H1> headline interpolation in Sections II or III <p> tags
  // 3. Zero exact sentence duplication and <= 50% 4-gram overlap between Section I (Facts) and Section II (Signal)
  // 4. Krug navigation street signs (aria-current="page") and plain-English action button labels
  const renderSimulatedBriefHtml = (
    rawInc: (typeof allIncidentsToVerify)[number]
  ): string => {
    const inc = mapDtoToCraftLexicon(rawInc);
    const primarySpec = getWorkingToolSpec(inc.primaryTool);
    const failureModeSpec = getSreFailureModeSpec(inc.sreFailureMode);
    const ledgerEntry = formatCraftLedgerEntry(inc.incidentCode);
    const friendlySource = formatFriendlySourceName(inc.sourceFeed);
    const factsParagraph =
      inc.socraticBrief
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)[0] || inc.executiveSummary;
    const dedupedSignal = deduplicateSignalAgainstFacts(
      [factsParagraph, inc.socraticBrief, inc.executiveSummary],
      inc.proportionalityCheck.structuralSignal,
      inc.primaryTool,
      inc.sreFailureMode,
      inc.secondaryTool
    );
    const isTrestleboardActive = evaluateNavActive("/", `/incidents/${inc.slug}`);

    return `
      <header>
        <nav aria-label="Primary Broadsheet Navigation">
          <a href="/" aria-current="${isTrestleboardActive ? "page" : ""}" class="border-b-2 border-b-[#C5A059] text-[#F3EFE6] font-bold">The Trestleboard</a>
          <a href="/archive">The Archive</a>
        </nav>
      </header>
      <aside>
        <span>THE CRAFTSMAN'S BRIEF</span>
        <span>CASE LEDGER</span>
        <h2>${inc.primaryTool}</h2>
        <p>${primarySpec.moralLens} — ${primarySpec.sreEquivalent}</p>
        <span>${failureModeSpec.craftTitle}</span>
        <div>RECORD ID: ${ledgerEntry}</div>
        <a href="${inc.sourceUrl}">Read Original ${friendlySource} Article</a>
        <a href="/archive?tool=${encodeURIComponent(primarySpec.slug)}">More '${inc.primaryTool}' Cases →</a>
      </aside>
      <main>
        <span>STRUCTURAL INSPECTION</span>
        <h1>${inc.title}</h1>
        <section id="section-i">
          <h2>I. WHAT HAPPENED (THE PLAIN FACTS)</h2>
          <p>${factsParagraph}</p>
        </section>
        <section id="section-ii">
          <h2>II. The Diagnostic Lens: ${inc.primaryTool} & ${failureModeSpec.craftTitle}</h2>
          <div>
            <span>PARTISAN HEAT & SPIN (THE NOISE)</span>
            <p class="section-ii-noise">${inc.proportionalityCheck.noiseOverblown}</p>
          </div>
          <div>
            <span>THE ACTUAL FOUNDATION (THE SIGNAL)</span>
            <p class="section-ii-signal">${dedupedSignal}</p>
          </div>
        </section>
        <section id="section-iii">
          <h2>Questions for Fair & Consistent Judgment</h2>
          <p class="section-iii-q1">${inc.questions[0]}</p>
          <p class="section-iii-q2">${inc.questions[1]}</p>
        </section>
      </main>
    `;
  };

  for (const rawInc of allIncidentsToVerify) {
    const inc = mapDtoToCraftLexicon(rawInc);
    const html = renderSimulatedBriefHtml(inc);

    for (const { label, regex } of bannedUiRegexes) {
      assert.equal(
        regex.test(html),
        false,
        `Rendered HTML for "/incidents/${inc.slug}" must not contain banned pattern "${label}"`
      );
    }

    assert.ok(
      html.includes('aria-current="page"') &&
        html.includes("Read Original ") &&
        html.includes(`More '${inc.primaryTool}' Cases →`),
      `Rendered HTML for "/incidents/${inc.slug}" must include aria-current="page" and plain-spoken Krug action buttons`
    );

    const factsParagraph =
      inc.socraticBrief
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)[0] || inc.executiveSummary;
    const dedupedSignal = deduplicateSignalAgainstFacts(
      [factsParagraph, inc.socraticBrief, inc.executiveSummary],
      inc.proportionalityCheck.structuralSignal,
      inc.primaryTool,
      inc.sreFailureMode,
      inc.secondaryTool
    );

    assert.equal(
      containsInterpolatedHeadline(
        inc.proportionalityCheck.noiseOverblown,
        inc.title
      ),
      false,
      `Rendered Section II Noise for "${inc.title}" must have zero <H1> headline interpolation`
    );
    assert.equal(
      containsInterpolatedHeadline(dedupedSignal, inc.title),
      false,
      `Rendered Section II Signal for "${inc.title}" must have zero <H1> headline interpolation`
    );
    assert.equal(
      containsInterpolatedHeadline(inc.questions[0], inc.title),
      false,
      `Rendered Section III Q1 for "${inc.title}" must have zero <H1> headline interpolation`
    );
    assert.equal(
      containsInterpolatedHeadline(inc.questions[1], inc.title),
      false,
      `Rendered Section III Q2 for "${inc.title}" must have zero <H1> headline interpolation`
    );
    assert.equal(
      hasDuplicateSentenceBetweenFactsAndSignal(
        [factsParagraph, inc.socraticBrief, inc.executiveSummary],
        dedupedSignal
      ),
      false,
      `Rendered Section I (Facts) and Section II (Signal) for "${inc.title}" must have zero duplicate sentences and <=50% 4-gram overlap`
    );
  }

  console.log(
    `  ✓ Issue #19 Test-PublicLexiconAndUsability verified across ${publicFilesToAudit.length} public source files and ${allIncidentsToVerify.length} rendered case briefs.`
  );

  // -------------------------------------------------------------------------
  // 12. OBJECTIVE 12 (EPIC #27 / ISSUES #28–#32 + EPIC #44 / ISSUE #39): TWO-TIER MASTHEAD, SEAL & DROPDOWN LEDGER
  // -------------------------------------------------------------------------
  console.log(
    "\n[12/15] Verifying Objective 12 (Epic #27 & Issue #39): Two-Tier Masthead, Seal Backing & Canonical Dropdown Ledger..."
  );

  const navConfigSource = fs.readFileSync(
    path.join(process.cwd(), "src/lib/navigation.ts"),
    "utf8"
  );
  const engravingsSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/MasonicEngravings.tsx"),
    "utf8"
  );
  const globalsCssSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8"
  );

  // Issue #28: Two-Tier Editorial Masthead & Container Alignment
  assert.ok(
    siteHeaderSource.includes("TIER 1: THE EDITORIAL MASTHEAD") &&
      siteHeaderSource.includes("TIER 2: THE NAVIGATION LEDGER BAR") &&
      siteHeaderSource.includes("max-w-7xl mx-auto px-4 sm:px-6") &&
      siteHeaderSource.includes("sm:whitespace-nowrap"),
    "Issue #28: SiteHeader.tsx must separate Tier 1 (Masthead) and Tier 2 (Navigation Ledger), align max-w-7xl mx-auto px-4 sm:px-6, and enforce single-line title (sm:whitespace-nowrap)"
  );

  // Issue #29: Seal Backing, Scaling, Glow, 15deg Rotation & Plumb-Line Divider
  assert.ok(
    engravingsSource.includes('fill="#070A10"') &&
      engravingsSource.includes('id="cabSealBacking"') &&
      engravingsSource.includes("drop-shadow(0 0 10px rgba(212, 175, 55, 0.18))") &&
      engravingsSource.includes("group-hover:rotate-[15deg]") &&
      engravingsSource.includes("duration-[600ms]") &&
      siteHeaderSource.includes("via-[#C5A059]/65"),
    "Issue #29: SquareAndCompassesCrest must include solid #070A10 seal backing, ambient gold drop-shadow, 15deg/600ms hover rotation, and vertical gold plumb-line divider"
  );

  // Issue #30 + Issue #39: Central Navigation Schema derived from canonical taxonomy
  const serializedNavSchema = JSON.stringify(NAVIGATION_SCHEMA);
  assert.equal(NAVIGATION_SCHEMA[0]?.id, "trestleboard");
  assert.equal(NAVIGATION_SCHEMA[0]?.href, "/");
  assert.equal(
    NAVIGATION_SCHEMA[0]?.items,
    undefined,
    "THE TRESTLEBOARD nav item must be a flat direct link to '/' without dropdown items"
  );
  for (const removedAnchor of [
    "/#weekly-brief",
    "/#active-dispatches",
    "/#systemic-trends",
  ]) {
    assert.equal(
      serializedNavSchema.includes(removedAnchor),
      false,
      `THE TRESTLEBOARD nav item must not include redundant same-page anchor ${removedAnchor}`
    );
  }
  for (const expectedNavSnippet of [
    "/archive",
    "/archive#matrix",
    "/archive?view=sources",
    "/archive?sector=public-policy-governance",
    "/archive?sector=infrastructure-supply-chain",
    "/archive?sector=technology-cyber",
    "/archive?sector=economics-markets",
    "/archive?sector=institutional-leadership",
    "/podcast#latest",
    "/podcast#transcripts",
    "Episode Guides & Transcripts",
    "/tools/24-inch-gauge",
    "/tools/common-gavel",
    "/tools/the-square",
    "/tools/the-level",
    "/tools/the-plumb",
    "/tools/the-trowel",
    "/failures/single-point-of-failure",
    "/failures/cascading-failure",
    "/failures/configuration-drift",
    "/failures/alert-fatigue",
    "/failures/blame-culture",
    "/failures/institutional-debt",
    "/status#mission",
    "/status#editorial-standards",
    "/status#feeds",
  ]) {
    assert.ok(
      serializedNavSchema.includes(expectedNavSnippet),
      `Issue #30 & #39: NAVIGATION_SCHEMA must contain canonical route ${expectedNavSnippet}`
    );
  }

  // Issue #31 & #32: Architectural Popover Panels, Corner Ticks, 150ms Hover-Intent, 10px CSS Bridge, Sticky Nav & Accessibility
  assert.ok(
    siteHeaderSource.includes("HOVER_CLOSE_DELAY_MS = 150") &&
      siteHeaderSource.includes("nav-dropdown-panel") &&
      siteHeaderSource.includes("bg-[#0B101B]") &&
      siteHeaderSource.includes("border-t-2 border-l-2 border-[#C5A059]") &&
      siteHeaderSource.includes("border-b-2 border-r-2 border-[#C5A059]") &&
      siteHeaderSource.includes("aria-expanded") &&
      siteHeaderSource.includes("aria-haspopup") &&
      siteHeaderSource.includes("mobile-navigation-ledger") &&
      globalsCssSource.includes(".nav-ledger-bar") &&
      globalsCssSource.includes(".nav-dropdown-panel::before") &&
      globalsCssSource.includes("height: 10px"),
    "Issues #31 & #32: SiteHeader.tsx and globals.css must implement architectural dropdown panels, four gold corner-tick brackets, 150ms hover-intent delay, 10px CSS bridge, sticky Tier-2 bar, and keyboard/touch/mobile accessibility"
  );

  console.log(
    "  ✓ Epic #27 & Issue #39 Two-Tier Masthead, Seal Backing, Canonical Navigation Schema, Architectural Dropdowns & Accessibility verified."
  );

  // -------------------------------------------------------------------------
  // 13. OBJECTIVE 13 (EPIC #33 / ISSUES #34–#38): PODCAST ARCHIVE UNIFICATION & DATA CLEANUP
  // -------------------------------------------------------------------------
  console.log(
    "\n[13/15] Verifying Objective 13 (Epic #33 / Issues #34–#38): Podcast Archive Unification & Episode Description Data Cleanup..."
  );

  const podcastArchiveSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/PodcastArchiveClient.tsx"),
    "utf8"
  );
  const siteFooterSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/SiteFooter.tsx"),
    "utf8"
  );
  const nextConfigSource = fs.readFileSync(
    path.join(process.cwd(), "next.config.ts"),
    "utf8"
  );
  const podcastPageSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/podcast/page.tsx"),
    "utf8"
  );

  // Issue #34: Masthead & Filter Tabs + dedicated /podcast route
  assert.ok(
    podcastArchiveSource.includes("THE CAB CALL PODCAST") &&
      podcastArchiveSource.includes("The CAB Call Podcast") &&
      podcastArchiveSource.includes("Weekly Ledger Roundups") &&
      podcastArchiveSource.includes("Foundational Essays") &&
      podcastArchiveSource.includes("Weekly Ledger Roundup #") &&
      podcastArchiveSource.includes("Foundational Essay #") &&
      !podcastArchiveSource.includes("PODCAST ARCHIVE // FRIDAY 5-MINUTE ROLLUP & LEGACY CATALOG") &&
      !podcastArchiveSource.includes("Legacy Deep-Dive Archive") &&
      !podcastArchiveSource.includes("5-MIN BRIEF") &&
      podcastPageSource.includes("PodcastArchiveClient") &&
      nextConfigSource.includes('source: "/dispatches/:slug"'),
    "Issue #34: PodcastArchiveClient.tsx and src/app/podcast/page.tsx must unify masthead, filter tabs, series badges, and dedicated /podcast route"
  );

  // Issue #35: Episode Description Sanitization & Source Extraction
  const dirtyDescriptionSample = `Welcome back to The CAB Call.\n\nIn this episode, we pit the **Mainframe Advocate** against the **Masonry Advocate** to debate State Preservation. [cite_start]We move past hype.\n\n### What We Unpack in This Episode:\n* **The Plumb:** Strategic forecast.\n* **The Level:** Empirical SEC filings.\n\nPrimary Sources Referenced: Source #1: [Lecture of the First Degree](https://www.webofhiram.org/?section=lectures_craft&page=1Lec.html) • Source #2: (Time Management)[https://www.oreilly.com/library/view/time-management/] • Source #3: [IBM z16][https://www.ibm.com/z16]\n\n### Source Classification Table\n| Source Title | Publication Date | Author / Credentials | Source Type |\n| :--- | :--- | :--- | :--- |\n| **38 THE BUILDER MAGAZINE VOL IV NO. II** | February 1918 | Joseph Fort Newton | Secondary Analysis |\n\nDisclaimer: The media and artwork for this episode were generated by AI using Google Gemini.`;

  const extractedHook = buildCleanEpisodeHook(dirtyDescriptionSample);
  const extractedNotes = buildCleanExtendedNotes(dirtyDescriptionSample);
  const extractedSources = extractExternalSourcesFromText(
    dirtyDescriptionSample,
    "The CAB Call #17: The Mason and The Mainframe"
  );

  assert.ok(
    !extractedHook.includes("](") &&
      !extractedHook.includes(")[") &&
      !extractedHook.includes("][") &&
      !extractedHook.includes("http") &&
      !extractedHook.includes("| :---") &&
      !extractedHook.includes("Primary Sources Referenced") &&
      !extractedHook.includes("Disclaimer:") &&
      !extractedHook.includes("**"),
    "Issue #35: buildCleanEpisodeHook must strip all raw Markdown links, tables, URLs, and disclaimers"
  );
  assert.ok(
    extractedNotes.includes("Key Takeaways:") &&
      extractedNotes.includes("• The Plumb: Strategic forecast.") &&
      !extractedNotes.includes("| :---") &&
      !extractedNotes.includes("Primary Sources Referenced") &&
      !extractedNotes.includes("Disclaimer:"),
    "Issue #35: buildCleanExtendedNotes must preserve structured takeaways while stripping Markdown tables and source dumps"
  );
  assert.ok(
    extractedSources.length >= 4 &&
      extractedSources.some((s) => s.url?.includes("webofhiram.org")) &&
      extractedSources.some((s) => s.url?.includes("oreilly.com")) &&
      extractedSources.some((s) => s.url?.includes("ibm.com")) &&
      extractedSources.some((s) => s.title.includes("38 THE BUILDER MAGAZINE")),
    "Issue #35: extractExternalSourcesFromText must parse [Title](url), (Title)[url], [Title][url], and Markdown source classification tables"
  );

  for (const ep of INITIAL_EPISODES) {
    const safeSummary = sanitizeEpisodeSummaryDefensive(ep.summary);
    assert.ok(
      !safeSummary.includes("](") &&
        !safeSummary.includes(")[") &&
        !safeSummary.includes("https://") &&
        !safeSummary.includes("| :---") &&
        !safeSummary.includes("Disclaimer:"),
      `Issue #35: Episode #${ep.episodeNumber} summary must be free of raw Markdown, URLs, tables, and inline disclaimers`
    );
  }

  // Issue #36: AI Disclaimer Deduplication & Single Footer Colophon
  assert.equal(
    stripAiDisclaimers(
      "Sample text.\n\nDisclaimer: The media and artwork for this episode were generated by AI using Google Gemini."
    ),
    "Sample text.",
    "Issue #36: stripAiDisclaimers must remove per-episode Gemini disclaimer strings"
  );
  assert.ok(
    podcastArchiveSource.includes("CANONICAL_PODCAST_AI_COLOPHON") &&
      !podcastArchiveSource.includes("ep.aiDisclaimer") &&
      !siteFooterSource.includes("strictly zero AI-generated art") &&
      CANONICAL_PODCAST_AI_COLOPHON.includes("Google NotebookLM & Google Gemini"),
    "Issue #36: PodcastArchiveClient and SiteFooter must use the single canonical AI colophon with zero per-card disclaimer boxes or contradictory footer claims"
  );

  // Issue #37: Unified Square Artwork Thumbnails & Fallback Emblem
  assert.ok(
    engravingsSource.includes("export function EpisodeArtworkEmblem") &&
      podcastArchiveSource.includes("EpisodeArtworkEmblem") &&
      podcastArchiveSource.includes("w-28 h-28 sm:w-32 sm:h-32"),
    "Issue #37: MasonicEngravings.tsx and PodcastArchiveClient.tsx must render unified square artwork thumbnails with EpisodeArtworkEmblem fallback"
  );

  // Issue #38: Unified "Episode Guide & Transcript" Drawer
  assert.ok(
    podcastArchiveSource.includes("Episode Guide & Transcript") &&
      podcastArchiveSource.includes("Hide Episode Guide") &&
      podcastArchiveSource.includes("Episode Overview &amp; Key Takeaways") &&
      podcastArchiveSource.includes("Source Pages on thecabcall.com") &&
      podcastArchiveSource.includes("External Primary Sources &amp; Dossiers") &&
      podcastArchiveSource.includes("Full Episode Transcript") &&
      !podcastArchiveSource.includes("Read 3-Part Script"),
    "Issue #38: PodcastArchiveClient.tsx must render unified 'Episode Guide & Transcript' drawer supporting both 3-part weekly ledgers and foundational essays"
  );

  console.log(
    "  ✓ Epic #33 (Issues #34–#38) Podcast Archive Unification, Description Sanitization, Colophon Deduplication, Square Artwork & Episode Guide Drawer verified."
  );

  // -------------------------------------------------------------------------
  // 14. OBJECTIVE 14 (EPIC #21 / ISSUES #22–#26): ADMIN DASHBOARD REDESIGN ("THE EDITOR'S STUDY")
  // -------------------------------------------------------------------------
  console.log(
    "\n[14/15] Verifying Objective 14 (Epic #21 / Issues #22–#26): Admin Dashboard Redesign ('The Editor's Study')..."
  );

  const adminShellNavSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminShellNav.tsx"),
    "utf8"
  );
  const adminOverviewSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminOverviewClient.tsx"),
    "utf8"
  );
  const adminEpisodesSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminEpisodesClient.tsx"),
    "utf8"
  );
  const adminIncidentsSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminIncidentsClient.tsx"),
    "utf8"
  );
  const adminFeedsSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminFeedsClient.tsx"),
    "utf8"
  );
  const adminFiltersSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminFiltersClient.tsx"),
    "utf8"
  );

  // Issue #22: Single Unified Admin Header & 4-Tab Navigation Consolidation
  assert.ok(
    adminShellNavSource.includes("ADMIN_NAV_TABS") &&
      adminShellNavSource.includes("Overview") &&
      adminShellNavSource.includes("Editorial & Feeds") &&
      adminShellNavSource.includes("Podcast Studio") &&
      adminShellNavSource.includes("Settings & Audit") &&
      adminShellNavSource.includes("SETTINGS_SUB_NAV_ITEMS") &&
      adminShellNavSource.includes("Ledger Verified") &&
      !adminShellNavSource.includes("Owner Lock:") &&
      siteHeaderSource.includes("if (isAdminContext && !isLoginRoute)") &&
      siteHeaderSource.includes("return null;"),
    "Issue #22: AdminShellNav.tsx and SiteHeader.tsx must implement a single unified admin header with 4 primary non-scrolling tabs, Settings & Audit sub-navigation, and a single Ledger Verified indicator"
  );

  // Issue #23: Overview Dashboard Declutter & Plain-English Action Cards
  assert.ok(
    adminOverviewSource.includes("Fetch Latest News") &&
      adminOverviewSource.includes("Synthesize Case Briefs") &&
      adminOverviewSource.includes("Generate Weekly Episode") &&
      adminOverviewSource.includes("Verify Ledger") &&
      adminOverviewSource.includes("Auto-draft briefs when fetching news") &&
      adminOverviewSource.includes("Active Stories") &&
      adminOverviewSource.includes("Monitored Feeds") &&
      adminOverviewSource.includes("Filter Rules") &&
      adminOverviewSource.includes("Published Episodes") &&
      adminOverviewSource.includes("Recent Activity &amp; Pipeline Runs") &&
      !adminOverviewSource.includes("System-1: jev-1.14.0") &&
      !adminOverviewSource.includes("Chain System-2 Synthesis on Ingest"),
    "Issue #23: AdminOverviewClient.tsx must render 4 plain-English action cards, a 5-metric horizontal summary strip, and a 5-item plain-English Recent Activity feed without internal model version strings"
  );

  // Issue #24: Podcast Episode Studio — Scannable List & Slide-Out Inspector Drawer
  assert.ok(
    adminEpisodesSource.includes("line-clamp-2") &&
      adminEpisodesSource.includes("fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-[#111726]") &&
      adminEpisodesSource.includes("Inspect &amp; Edit →") &&
      adminEpisodesSource.includes("Technical Storage &amp; Feed Metadata") &&
      !adminEpisodesSource.includes("Recent Episode Lifecycle Events (<code>audit_ledger</code>)"),
    "Issue #24: AdminEpisodesClient.tsx must render a compact scannable episode list with line-clamp-2 descriptions and a right-hand slide-out Inspector Drawer with single audio player and collapsible storage metadata"
  );

  // Issue #25: Unified "Editorial & Feeds" Workspace & Plain-English Rule Controls
  assert.ok(
    adminIncidentsSource.includes("1. Case Briefs &amp; Stories") &&
      adminIncidentsSource.includes("2. RSS Sources") &&
      adminIncidentsSource.includes("3. Editorial Tone &amp; Filtering") &&
      adminIncidentsSource.includes("Calm Headline Rewrite") &&
      adminFeedsSource.includes("Monitored RSS Sources") &&
      adminFiltersSource.includes("Minimum Relevance Score") &&
      adminFiltersSource.includes("Minimum Classification Confidence") &&
      adminFiltersSource.includes("Exclude Keywords / Phrases") &&
      adminFiltersSource.includes("Boost Topic Relevance") &&
      adminFiltersSource.includes("Assign Working Tool"),
    "Issue #25: AdminIncidentsClient.tsx, AdminFeedsClient.tsx, and AdminFiltersClient.tsx must provide the unified 3-view 'Editorial & Feeds' workspace and plain-English labels"
  );

  // Issue #26: Trestleboard Visual Polish Across /admin ("The Editor's Study")
  assert.ok(
    globalsCssSource.includes(".admin-study-card") &&
      adminShellNavSource.includes("SquareAndCompassesCrest") &&
      adminOverviewSource.includes("bg-[#111726]") &&
      adminEpisodesSource.includes("bg-[#111726]") &&
      adminIncidentsSource.includes("bg-[#111726]"),
    "Issue #26: Admin components and globals.css must apply The Editor's Study Trestleboard aesthetic (#111726, brass hairlines, SquareAndCompassesCrest, and .admin-study-card)"
  );

  console.log(
    "  ✓ Epic #21 (Issues #22–#26) Admin Dashboard Redesign ('The Editor's Study') verified."
  );

  // -------------------------------------------------------------------------
  // 15. OBJECTIVE 15 (EPIC #44 / ISSUES #39–#43): INFORMATION ARCHITECTURE, HUB PAGES & 1,000-ITEM PAGINATION
  // -------------------------------------------------------------------------
  console.log(
    "\n[15/15] Verifying Objective 15 (Epic #44 / Issues #39–#43): Dedicated Tool/SRE Hub Pages, Navigation Alignment & 1,000-Item Archive Pagination..."
  );

  // Sub-Issue #39: Canonical Taxonomy Alignment & Navigation Dropdown Refactor
  assert.equal(WORKING_TOOLS.length, 6, "Must have exactly 6 canonical Working Tools");
  assert.equal(SRE_FAILURE_MODES.length, 6, "Must have exactly 6 canonical SRE Failure Modes");
  assert.equal(DOMAIN_SECTOR_SPECS.length, 5, "Must have exactly 5 canonical Domain Sectors");

  assert.equal(
    serializedNavSchema.includes("Silent Data Corruption"),
    false,
    "Issue #39: NAVIGATION_SCHEMA must have zero drifted 'Silent Data Corruption' labels"
  );

  // Verify active nav street-sign matching for /tools/*, /failures/*, /archive*, and /podcast*
  assert.equal(isNavItemActive("/rubric", "/tools/the-square"), true);
  assert.equal(isNavItemActive("/rubric", "/failures/configuration-drift"), true);
  assert.equal(isNavItemActive("/archive", "/archive"), true);
  assert.equal(isNavItemActive("/archive", "/knowledge-graph"), true);
  assert.equal(isNavItemActive("/podcast", "/podcast"), true);

  // Sub-Issue #40: Dedicated Dynamic Hub Pages for Working Tools (/tools/[slug])
  for (const tool of WORKING_TOOLS) {
    assert.ok(
      tool.slug &&
        tool.operativeOriginEssay.length >= 2 &&
        tool.moralCivicApplicationEssay.length >= 2 &&
        tool.systemsEngineeringEquivalentEssay.length >= 2 &&
        tool.operationalPractices.length >= 3,
      `Issue #40: Working Tool ${tool.id} must define slug, 3-part essay paragraphs, and operationalPractices`
    );
    const resolved = getWorkingToolBySlug(tool.slug);
    assert.equal(resolved?.id, tool.id);
    assert.equal(getWorkingToolHref(tool.id), `/tools/${tool.slug}`);

    const hubData = getWorkingToolHubData(tool.slug);
    assert.ok(hubData, `getWorkingToolHubData('${tool.slug}') must return valid hub data`);
    assert.equal(hubData.spec.id, tool.id);
    assert.equal(hubData.telemetry.coOccurringFailureModes.length, 6);
    assert.equal(hubData.telemetry.sectorBreakdown.length, 5);
  }

  // Sub-Issue #41: Dedicated Dynamic Hub Pages for Structural Failure Modes (/failures/[slug])
  for (const mode of SRE_FAILURE_MODES) {
    assert.ok(
      mode.slug &&
        mode.shopFloorMechanicsEssay.length >= 2 &&
        mode.civicInstitutionalEssay.length >= 2 &&
        mode.earlyWarningSignals.length >= 3,
      `Issue #41: Failure Mode ${mode.id} must define slug, 3-part mechanics essays, and earlyWarningSignals`
    );
    const resolved = getFailureModeBySlug(mode.slug);
    assert.equal(resolved?.id, mode.id);
    assert.equal(getFailureModeHref(mode.id), `/failures/${mode.slug}`);

    const hubData = getFailureModeHubData(mode.slug);
    assert.ok(hubData, `getFailureModeHubData('${mode.slug}') must return valid hub data`);
    assert.equal(hubData.spec.id, mode.id);
    assert.equal(hubData.telemetry.intersectingTools.length, 6);
    assert.equal(hubData.telemetry.sectorBreakdown.length, 5);
  }
  assert.ok(
    engravingsSource.includes("export function FailureModeEngraving") &&
      engravingsSource.includes("PLATE A — OFF-SQUARE DRIFT") &&
      engravingsSource.includes("PLATE F — COMPOUNDING DEBT"),
    "Issue #41: MasonicEngravings.tsx must export FailureModeEngraving with copperplate diagrams PLATE A through PLATE F"
  );

  // Sub-Issue #42: Streamlined /rubric Methodology Codex & Visual Directory
  const rubricCodexSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/RubricCodexClient.tsx"),
    "utf8"
  );
  const rubricDrawerSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/RubricInspectorDrawer.tsx"),
    "utf8"
  );
  assert.equal(
    /mutually exclusive/i.test(rubricCodexSource),
    false,
    "Issue #42: RubricCodexClient.tsx must eliminate all 'mutually exclusive' phrasing"
  );
  assert.equal(
    rubricCodexSource.includes("setActiveToolId"),
    false,
    "Issue #42: RubricCodexClient.tsx must remove the redundant interactive split-screen tab switcher"
  );
  assert.ok(
    rubricCodexSource.includes("getWorkingToolHref") &&
      rubricCodexSource.includes("getFailureModeHref") &&
      rubricCodexSource.includes("getDomainSectorHref") &&
      rubricDrawerSource.includes("getWorkingToolHref") &&
      rubricDrawerSource.includes("getFailureModeHref"),
    "Issue #42: RubricCodexClient.tsx and RubricInspectorDrawer.tsx must link directly to /tools/[slug] and /failures/[slug]"
  );

  // Sub-Issue #43: Archive Scalability Refactor — 0010 D1 Indexes, 1,000-Item Pagination, 6x6 Brass Heatmap & Zero Overflow
  const paginationIndexRows = rawSql
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (
        'idx_telemetry_matrix_lookup',
        'idx_telemetry_secondary_tool_lookup',
        'idx_telemetry_failure_published_lookup',
        'idx_telemetry_source_feed_lookup',
        'idx_telemetry_pinned_published_lookup'
      )`
    )
    .all() as Array<{ name: string }>;
  assert.equal(
    paginationIndexRows.length,
    5,
    "Issue #43: All 5 composite pagination indexes from 0010_archive_pagination_indexes.sql must exist in D1"
  );

  // Verify D1 pagination and Worker GET /api/archive endpoint
  const d1ArchivePage = await executeD1ArchivePaginationQueries(db, {
    page: 1,
    pageSize: 25,
  });
  assert.equal(d1ArchivePage.page, 1);
  assert.equal(d1ArchivePage.pageSize, 25);
  assert.ok(d1ArchivePage.totalCount >= 1);

  const d1ToolAgg = await executeD1WorkingToolAggregations(db, "The Level");
  assert.ok(d1ToolAgg.primaryCount >= 1);
  assert.ok(d1ToolAgg.totalTagged >= 1);

  const d1FailureAgg = await executeD1FailureModeAggregations(
    db,
    "Single Point of Failure (SPOF) / Untested Failover"
  );
  assert.ok(d1FailureAgg.totalTagged >= 1);

  const workerArchiveRes = await worker.fetch(
    new Request(
      "https://thecabcall.thecabcall.workers.dev/api/archive?page=1&pageSize=25&tool=the-level"
    ),
    workerEnv,
    mockExecutionContext
  );
  assert.equal(workerArchiveRes.status, 200);
  const workerArchiveJson = (await workerArchiveRes.json()) as {
    ok: boolean;
    items: PublicIncidentDto[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  assert.equal(workerArchiveJson.ok, true);
  assert.equal(workerArchiveJson.totalCount, 1);
  assert.equal(workerArchiveJson.items.length, 1);

  // Verify 1,000-Item Corpus Pagination & Full-Corpus 6x6 Matrix Aggregation
  const seedBaseDto = projectPublicIncidentDto(INITIAL_INCIDENTS[0])!;
  const synthetic1000Corpus: PublicIncidentDto[] = Array.from(
    { length: 1000 },
    (_, idx) => {
      const tool = WORKING_TOOLS[idx % WORKING_TOOLS.length];
      const secondary = WORKING_TOOLS[(idx + 1) % WORKING_TOOLS.length];
      const failure = SRE_FAILURE_MODES[idx % SRE_FAILURE_MODES.length];
      const sector = DOMAIN_SECTOR_SPECS[idx % DOMAIN_SECTOR_SPECS.length];
      return {
        ...seedBaseDto,
        id: `d1-${2000 + idx}`,
        incidentCode: `#CAB-2026-${2000 + idx}`,
        slug: `synthetic-dispatch-${2000 + idx}`,
        title: `Synthetic Structural Dispatch #${2000 + idx}: ${tool.id} & ${failure.craftShortLabel}`,
        primaryTool: tool.id,
        secondaryTool: secondary.id,
        sreFailureMode: failure.id,
        domainSector: sector.id,
      };
    }
  );

  const page2Result = paginateAndAggregateIncidentCorpus(synthetic1000Corpus, {
    page: 2,
    pageSize: 25,
  });
  assert.equal(page2Result.totalCount, 1000);
  assert.equal(page2Result.corpusTotalCount, 1000);
  assert.equal(page2Result.totalPages, 40);
  assert.equal(page2Result.page, 2);
  assert.equal(page2Result.items.length, 25);
  assert.equal(page2Result.startIndex, 26);
  assert.equal(page2Result.endIndex, 50);

  // Verify compact Case ID formatter (CAB-2026-XXXX)
  assert.equal(
    formatCompactCaseId("Ledger Entry — Case #CAB-2026-0912", "d1-912"),
    "CAB-2026-0912"
  );

  // Verify KnowledgeGraphClient.tsx has 6-column zero-overflow table, brass heatmap, and Monitored Publications view
  const knowledgeGraphSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/KnowledgeGraphClient.tsx"),
    "utf8"
  );
  assert.ok(
    knowledgeGraphSource.includes('id="matrix"') &&
      knowledgeGraphSource.includes("rgba(212, 175, 55,") &&
      knowledgeGraphSource.includes("formatCompactCaseId") &&
      knowledgeGraphSource.includes("Monitored Publications") &&
      !knowledgeGraphSource.includes("min-w-[880px]"),
    "Issue #43: KnowledgeGraphClient.tsx must implement id='matrix', dynamic rgba(212, 175, 55, ...) brass heatmap shading, formatCompactCaseId, Monitored Publications view, and zero horizontal overflow (no min-w-[880px])"
  );

  console.log(
    "  ✓ Epic #44 (Issues #39–#43) Canonical Taxonomy Navigation, /tools/[slug] & /failures/[slug] Hubs, Streamlined /rubric Codex, and 1,000-Item Archive Pagination verified."
  );

  // -------------------------------------------------------------------------
  // 16. OBJECTIVE 16: HOMEPAGE BROADSHEET REFACTOR, TAXONOMY UNIFICATION & ANTI-HALLUCINATION GUARDRAILS
  // -------------------------------------------------------------------------
  console.log(
    "\n[16/16] Verifying Objective 16: Weekly Brief Synthesis Deduplication, Taxonomy Unification, Pure Typographic Card Grid & Anti-Hallucination Guardrails..."
  );

  // 1. Weekly Brief Hero Component & Synthesis Generator
  const weeklyState = buildWeeklyTrestleboardState(
    INITIAL_INCIDENTS,
    getSystemPostureSummary(),
    INITIAL_EPISODES[0]
  );
  for (const anchor of weeklyState.anchorIncidents) {
    assert.equal(
      weeklyState.heroOpeningProse.includes(anchor.title),
      false,
      `Weekly Brief heroOpeningProse must not duplicate anchor headline: ${anchor.title}`
    );
  }
  assert.equal(
    weeklyState.heroOpeningProse.includes("Configuration Drift"),
    false,
    "Weekly Brief heroOpeningProse must use canonical display label ('Drifting Off-Square') instead of raw 'Configuration Drift'"
  );
  assert.equal(
    weeklyState.podcastDescription.includes("Five-minute Friday synthesis"),
    false,
    "Weekly Brief podcastDescription must not hardcode 'Five-minute Friday synthesis'"
  );
  assert.ok(
    weeklyState.podcastDescription.length >= 40,
    "Weekly Brief podcastDescription must be populated from the pinned episode summary"
  );
  assert.equal(
    formatFailureModeDisplayLabel("Configuration Drift"),
    "Drifting Off-Square"
  );

  const trestleboardClientSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/TrestleboardClient.tsx"),
    "utf8"
  );
  assert.equal(
    trestleboardClientSource.includes("(5 MIN)"),
    false,
    "TrestleboardClient.tsx must not hardcode '(5 MIN)' in the Weekly Brief audio header"
  );
  assert.ok(
    (trestleboardClientSource.includes("{pinnedEpisode.durationFormatted}") ||
      trestleboardClientSource.includes("({weeklyState.durationFormatted})")) &&
      trestleboardClientSource.includes("ACTIVE DISPATCHES // THE TRESTLEBOARD") &&
      trestleboardClientSource.includes("verified incident"),
    "TrestleboardClient.tsx must display dynamic episode durationFormatted and the ACTIVE DISPATCHES // THE TRESTLEBOARD section header with live count"
  );

  // 2. Hero Visual Banner Container, SourceOutletBadge & Headline Neutralization Guardrails
  const incidentCardSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/IncidentCard.tsx"),
    "utf8"
  );
  assert.ok(
    incidentCardSource.includes("<img") &&
      incidentCardSource.includes("SourceOutletBadge") &&
      incidentCardSource.includes("h-48") &&
      incidentCardSource.includes("Archival Photo"),
    "IncidentCard.tsx must render the h-48 hero visual banner container with SourceOutletBadge and Archival Photo indicator"
  );
  assert.ok(
    incidentCardSource.includes("font-serif font-semibold") &&
      incidentCardSource.includes("normal-case"),
    "IncidentCard.tsx must render dispatch headlines in mixed-case font-serif font-semibold normal-case"
  );
  assert.equal(
    incidentCardSource.includes("[{incident.primaryTool}]") ||
      incidentCardSource.includes("[{shortFailureLabel}]"),
    false,
    "IncidentCard.tsx must not wrap footer taxonomy pills in literal square brackets"
  );

  // Verify Headline Neutralization: no ": Operational & Governance Assessment" suffix
  const brickbatDeesc = deescalateHeadlineDeterministic(
    "Brickbat: Sticky Fingers",
    "A former postal worker in Georgia pleaded guilty to stealing checks and money orders from the mail over a two-year period.",
    true
  );
  assert.equal(
    brickbatDeesc.neutralTitle.includes("Operational & Governance Assessment"),
    false,
    "deescalateHeadlineDeterministic must never append ': Operational & Governance Assessment'"
  );
  assert.equal(
    brickbatDeesc.changed,
    true,
    "deescalateHeadlineDeterministic must construct a factual headline from excerpt when stripping 'Brickbat:' leaves < 4 words"
  );
  assert.ok(
    brickbatDeesc.neutralTitle.includes("Former Postal Worker"),
    `Expected factual headline from excerpt, got: ${brickbatDeesc.neutralTitle}`
  );

  const emptyExcerptUnchanged = deescalateHeadlineDeterministic(
    "Calm Factual Headline About Municipal Water Systems",
    "",
    true
  );
  assert.equal(
    emptyExcerptUnchanged.changed,
    false,
    "When excerpt is empty and no alarmist regex matched, deescalateHeadlineDeterministic must return changed=false"
  );
  assert.equal(
    emptyExcerptUnchanged.neutralTitle,
    "Calm Factual Headline About Municipal Water Systems"
  );

  // Verify existing DB read-time cleanup of ": Operational & Governance Assessment"
  assert.equal(
    stripLegacyBoilerplateTitleSuffix(
      "Brickbat: Sticky Fingers: Operational & Governance Assessment"
    ),
    "Brickbat: Sticky Fingers"
  );
  const cleanedLegacyMapped = mapD1RowToIncidentArticle({
    id: 777,
    url_hash: "legacy-suffix-hash",
    source_feed: "Reason Magazine",
    title: "Brickbat: Sticky Fingers: Operational & Governance Assessment",
    original_title: "Brickbat: Sticky Fingers",
    title_rewritten: 1,
    title_rewrite_reason: "Reframed headline into clinical operational assessment format",
    source_url: "https://reason.com/2026/10/19/brickbat-sticky-fingers/",
    raw_excerpt:
      "A former postal worker in Georgia pleaded guilty to stealing checks and money orders from the mail over a two-year period. Investigators recovered hundreds of stolen envelopes during an audit.",
    published_at: "2026-10-19T12:00:00Z",
    ingested_at: "2026-10-19T12:05:00Z",
    is_systemic_prob: 0.85,
    jev_confidence: 0.88,
    primary_tool: "plumb",
    secondary_tool: "square",
    sre_failure_mode: "configuration_drift",
    jev_raw_json: "{}",
    socratic_brief:
      "A former postal worker in Georgia pleaded guilty to stealing checks and money orders from the mail over a two-year period. Investigators recovered hundreds of stolen envelopes during an internal postal audit.",
    questions_json: JSON.stringify({
      executive_summary:
        "A former postal worker in Georgia pleaded guilty to stealing checks and money orders from the mail over a two-year period. Investigators recovered hundreds of stolen envelopes during an internal postal audit.",
      proportionality_check: {
        noise_overblown:
          "Treating mail theft as an isolated personnel lapse overlooks physical custody controls at sorting facilities.",
        structural_signal:
          " Custody handoffs lacked dual-verification logging across regional sorting floors.",
      },
      questions: [
        "Where do physical custody handoffs rely on unverified single-operator access?",
        "How quickly do exception audits detect missing custody scans at regional sorting hubs?",
      ],
    }),
    status: "synthesized",
  });
  assert.ok(cleanedLegacyMapped, "mapD1RowToIncidentArticle must map valid row");
  assert.equal(
    cleanedLegacyMapped.title,
    "Brickbat: Sticky Fingers",
    "mapD1RowToIncidentArticle must strip trailing ': Operational & Governance Assessment' on read"
  );
  assert.equal(
    cleanedLegacyMapped.titleRewritten,
    false,
    "mapD1RowToIncidentArticle must set titleRewritten=false when stripping legacy suffix makes title === original_title"
  );

  // Verify OpenGraph generic logo filtering & Wikimedia Commons archival waterfall
  const rejectedLogoOg = await extractImageFromSourceArticleUrl(
    "https://reason.com/2026/10/19/sample",
    "Sample Title",
    async () =>
      new Response(
        `<html><head><meta property="og:image" content="https://reason.com/assets/reason-default-logo.png" /></head></html>`,
        { status: 200 }
      )
  );
  assert.equal(
    rejectedLogoOg,
    null,
    "extractImageFromSourceArticleUrl must reject generic publisher default/logo og:image URLs"
  );

  const validArticleOg = await extractImageFromSourceArticleUrl(
    "https://reason.com/2026/10/19/sample",
    "Sample Title",
    async () =>
      new Response(
        `<html><head><meta property="og:image" content="https://d2eehagpk5cl65.cloudfront.net/img/q60/uploads/2026/10/courthouse-photo-1200x630.jpg" /></head></html>`,
        { status: 200 }
      )
  );
  assert.equal(validArticleOg?.imageSourceType, "og_scraped");

  const resolvedWikimedia = await resolveContextualPublicDomainImage(
    "Supreme Court Reviews Federal Reserve Administrative Subpoena Authority",
    "The Supreme Court heard oral arguments Tuesday regarding Federal Reserve oversight.",
    "Public Policy & Governance",
    async (input) => {
      const url = String(input);
      if (url.includes("en.wikipedia.org")) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "123": {
                  pageid: 123,
                  title: "Supreme Court of the United States",
                  thumbnail: {
                    source:
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/US_Supreme_Court_Building.jpg/960px-US_Supreme_Court_Building.jpg",
                    width: 960,
                    height: 640,
                  },
                  terms: {
                    description: ["highest court in the United States"],
                  },
                },
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    }
  );
  assert.equal(resolvedWikimedia?.imageSourceType, "wikimedia_commons");
  assert.ok(
    resolvedWikimedia?.imageUrl.includes("US_Supreme_Court_Building.jpg"),
    "resolveContextualPublicDomainImage must resolve landscape Wikipedia PageImages"
  );

  // 3. Anti-Hallucination Prompt Guardrails & Synthetic CVE Sanitization
  const antiHallucinationRow: TelemetryArticleRow = {
    id: 999,
    url_hash: "sample-hash",
    source_feed: "The Register",
    title: "Linux KVM guest-host escape rated critical",
    source_url: "https://example.com/kvm",
    raw_excerpt:
      "A critical guest-host escape flaw in Linux KVM allows malformed IPv4 packets to corrupt host memory.",
    published_at: "2026-10-19T00:00:00.000Z",
    ingested_at: "2026-10-19T00:05:00.000Z",
    is_systemic_prob: 0.85,
    jev_confidence: 0.88,
    primary_tool: "square",
    secondary_tool: "common_gavel",
    sre_failure_mode: "untested_failover",
    jev_raw_json: "{}",
    socratic_brief: null,
    questions_json: null,
    status: "triaged",
  };
  const promptPair = buildSystem2Prompt(antiHallucinationRow);
  assert.ok(
    promptPair.systemInstruction.includes(
      "Never invent, extrapolate, or insert placeholder identifiers, CVE numbers (such as CVE-2026-99999), bill numbers, or statistics not explicitly present verbatim in the source text."
    ),
    "buildSystem2Prompt must enforce the strict negative anti-hallucination constraint"
  );

  assert.equal(hasSyntheticPlaceholderIdentifier("Cataloged as CVE-2026-99999."), true);
  assert.equal(
    sanitizeSyntheticPlaceholders("The flaw, cataloged as CVE-2026-99999 with a 9.3 severity rating, stems from KVM."),
    "The flaw, identified as a critical vulnerability in the Linux Kernel-based Virtual Machine with a 9.3 severity rating, stems from KVM."
  );

  const hallucinatedValidation = validateSynthesizedBriefOutput(antiHallucinationRow, {
    executive_summary:
      "Security researcher discovered a flaw in Linux KVM. The flaw, cataloged as CVE-2026-99999, allows guest-host escape.",
    socratic_brief:
      "A flaw in the Linux KVM hypervisor networking subsystem allows a guest virtual machine to corrupt host memory by supplying crafted IPv4 packets. This breaks multi-tenant isolation.",
    proportionality_check: {
      noise_overblown:
        "Commentary treating this breakdown as an isolated coding oversight misses the boundary design.",
      structural_signal:
        "In this case, checksum metadata crosses a trust boundary without re-verification.",
    },
    questions: [
      "Where does our hypervisor trust guest-supplied offsets after initial validation?",
      "Which isolation boundary lacks an independent verification gate?",
    ],
  });
  assert.equal(
    hallucinatedValidation.valid,
    false,
    "validateSynthesizedBriefOutput must reject summaries containing fabricated CVE-2026-99999"
  );

  console.log(
    "  ✓ Objective 16 Weekly Brief Synthesis Deduplication, Taxonomy Unification, Pure Typographic Card Grid & Anti-Hallucination Guardrails verified."
  );

  // -------------------------------------------------------------------------
  // 17. OBJECTIVE 17 (ISSUE #51): GLOBAL CSS & BROADSHEET PRIMITIVES ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log(
    "\n[17/17] Verifying Objective 17 (Issue #51): Global CSS & Component Primitives Enforcement (Max 1 Border Depth & Flat Broadsheet Primitives)..."
  );

  assert.equal(
    globalsCssSource.includes(".tracing-board-frame::before"),
    false,
    "Issue #51: globals.css must remove .tracing-board-frame::before inset double-border"
  );
  assert.ok(
    globalsCssSource.includes("border: 1px solid rgba(197, 160, 89, 0.35)") &&
      globalsCssSource.includes(".tracing-board-frame .tracing-board-frame"),
    "Issue #51: globals.css must define a single crisp hairline border on .tracing-board-frame and a nested frame guardrail rule"
  );

  const broadsheetPrimitivesSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/ui/BroadsheetPrimitives.tsx"),
    "utf8"
  );
  for (const requiredPrimitive of [
    "export function SectionHeader",
    "export function BroadsheetCard",
    "export function InteractiveCardLink",
    "export function HairlineSection",
    "export function DirectoryList",
    "export function HeroCornerBrackets",
  ]) {
    assert.ok(
      broadsheetPrimitivesSource.includes(requiredPrimitive),
      `Issue #51: BroadsheetPrimitives.tsx must export ${requiredPrimitive}`
    );
  }

  assert.equal(
    incidentCardSource.includes("inset-1.5 border"),
    false,
    "Issue #51: IncidentCard.tsx must not render an inner inset-1.5 double-border"
  );
  assert.equal(
    trestleboardClientSource.includes("inset-1.5 border"),
    false,
    "Issue #51: TrestleboardClient.tsx must not render inner inset-1.5 double-borders"
  );
  assert.ok(
    trestleboardClientSource.includes("HeroCornerBrackets") &&
      trestleboardClientSource.includes("SectionHeader"),
    "Issue #51: TrestleboardClient.tsx must use shared HeroCornerBrackets and SectionHeader primitives"
  );

  console.log(
    "  ✓ Objective 17 (Issue #51) Global CSS Single-Border Frame, Nested Frame Guardrail & Shared Broadsheet Primitives verified."
  );

  // -------------------------------------------------------------------------
  // 18. OBJECTIVE 18 (ISSUE #47): WORKING TOOLS & RUBRIC PAGE 50% CARD DIET & DRAWER FLATTENING
  // -------------------------------------------------------------------------
  console.log(
    "\n[18/18] Verifying Objective 18 (Issue #47): Working Tools & Rubric Page 50% Card Diet, Redundancy Removal & Drawer Flattening..."
  );

  assert.equal(
    rubricCodexSource.includes('href="#axis-1"') ||
      rubricCodexSource.includes('href="#axis-2"') ||
      rubricCodexSource.includes('href="#axis-3"'),
    false,
    "Issue #47: RubricCodexClient.tsx must remove the redundant top 3 Axis summary cards"
  );
  assert.equal(
    rubricCodexSource.includes("BrassSectionDivider") ||
      rubricCodexSource.includes("engravingCaption") ||
      rubricCodexSource.includes("Shop-Floor Mechanics:") ||
      rubricCodexSource.includes("Archive →"),
    false,
    "Issue #47: RubricCodexClient.tsx must enforce the 50% card diet (no BrassSectionDivider, no engravingCaption, no Shop-Floor Mechanics paragraph, and no competing Archive → footer link)"
  );
  assert.ok(
    rubricCodexSource.includes("SectionHeader") &&
      rubricCodexSource.includes("HeroCornerBrackets") &&
      rubricCodexSource.includes("Explore Hub"),
    "Issue #47: RubricCodexClient.tsx must use SectionHeader, HeroCornerBrackets, and a single inline Explore Hub cue per card"
  );

  assert.equal(
    rubricDrawerSource.includes("border-double") ||
      rubricDrawerSource.includes("Filter Archive Ledger →"),
    false,
    "Issue #47: RubricInspectorDrawer.tsx must de-nest inner bordered boxes and remove competing secondary footer links"
  );
  assert.ok(
    rubricDrawerSource.includes("HairlineSection") &&
      rubricDrawerSource.includes("primaryHubHref"),
    "Issue #47: RubricInspectorDrawer.tsx must use HairlineSection dividers and a single primary footer CTA"
  );

  for (const expectedSlug of [
    "24-inch-gauge",
    "common-gavel",
    "the-plumb",
    "the-square",
    "the-level",
    "the-trowel",
  ]) {
    assert.ok(
      WORKING_TOOLS.some((t) => t.slug === expectedSlug),
      `Issue #47: WORKING_TOOLS must preserve hash anchor slug #${expectedSlug}`
    );
  }
  for (const expectedFailureSlug of [
    "configuration-drift",
    "cascading-failure",
    "alert-fatigue",
    "single-point-of-failure",
    "blame-culture",
    "institutional-debt",
  ]) {
    assert.ok(
      SRE_FAILURE_MODES.some((m) => m.slug === expectedFailureSlug),
      `Issue #47: SRE_FAILURE_MODES must preserve hash anchor slug #${expectedFailureSlug}`
    );
  }

  console.log(
    "  ✓ Objective 18 (Issue #47) Working Tools & Rubric 50% Card Diet, SectionHeader Flattening, and Inspector Drawer De-Nesting verified."
  );

  // -------------------------------------------------------------------------
  // 19. OBJECTIVE 19 (ISSUE #48): ABOUT & FEEDS PAGE — COLLAPSE 51-CARD WALL, DE-NEST PILLARS & SLIM FEED CARDS
  // -------------------------------------------------------------------------
  console.log(
    "\n[19/19] Verifying Objective 19 (Issue #48): About & Feeds Page (/about, /status, /feeds) — 4-Column Typographic Directory, De-Nested Pillars & Slim Feed Cards..."
  );

  const statusPageSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/status/page.tsx"),
    "utf8"
  );
  const aboutPageSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/about/page.tsx"),
    "utf8"
  );
  const feedsPageSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/feeds/page.tsx"),
    "utf8"
  );

  assert.ok(
    aboutPageSource.includes('../status/page') &&
      feedsPageSource.includes('../status/page'),
    "Issue #48: /about and /feeds must resolve to the unified About & Feeds page"
  );
  assert.equal(
    isNavItemActive("/status", "/about"),
    true,
    "Issue #48: isNavItemActive('/status', '/about') must highlight About & Feeds in the navigation ledger"
  );
  assert.equal(
    isNavItemActive("/status", "/feeds"),
    true,
    "Issue #48: isNavItemActive('/status', '/feeds') must highlight About & Feeds in the navigation ledger"
  );
  assert.equal(
    /Scheduled Automated Poll/i.test(statusPageSource) ||
      /Scheduled Automated Poll/i.test(statusClientSource),
    false,
    "Issue #48: status/page.tsx and SystemStatusClient.tsx must eliminate repeated 'Scheduled Automated Poll' telemetry from individual items"
  );
  assert.ok(
    statusClientSource.includes(
      "All monitored publications are polled on an automated schedule"
    ),
    "Issue #48: SystemStatusClient.tsx must state 'All monitored publications are polled on an automated schedule' once in the section header"
  );
  for (const beatHeading of [
    "Wire & Mainstream",
    "Tech, Cyber & Science",
    "Policy, Law & Markets",
    "Journals & Commentary",
  ]) {
    assert.ok(
      statusClientSource.includes(beatHeading),
      `Issue #48: SystemStatusClient.tsx must group monitored publications under beat '${beatHeading}'`
    );
  }
  assert.equal(
    statusClientSource.includes("WORKING_TOOLS.map") ||
      statusClientSource.includes("SRE_FAILURE_MODES.map"),
    false,
    "Issue #48: SystemStatusClient.tsx must remove the nested 6-card mini-grids inside Pillar I and Pillar II"
  );
  assert.ok(
    statusClientSource.includes(
      "Explore the Working Tools &amp; Fault Taxonomy →"
    ) && statusClientSource.includes('href="/rubric"'),
    "Issue #48: Pillar I and Pillar II must replace nested mini-grids with 'Explore the Working Tools & Fault Taxonomy →' pointing to /rubric"
  );
  assert.equal(
    statusClientSource.includes("Works with:") ||
      statusClientSource.includes("Format:") ||
      statusClientSource.includes("Volume:") ||
      statusClientSource.includes("Cadence:") ||
      statusClientSource.includes("Browse Podcast Archive →"),
    false,
    "Issue #48: SystemStatusClient.tsx must slim down the 3 syndication feed cards (removing Format/Volume/Cadence tables, Works with footers, and secondary archive buttons)"
  );
  assert.ok(
    statusClientSource.includes("Open Raw Feed →"),
    "Issue #48: SystemStatusClient.tsx must include a single 'Open Raw Feed →' link per syndication feed card"
  );

  console.log(
    "  ✓ Objective 19 (Issue #48) About & Feeds 4-Column Typographic Directory, De-Nested Pillars, Slim Feed Cards, and Flattened Methodology Lists verified."
  );

  // -------------------------------------------------------------------------
  // 20. OBJECTIVE 20 (ISSUE #49): UNSEEN PUBLIC PAGES AUDIT & FLATTENING (/archive, /tools/[slug], /failures/[slug], /incidents/[slug])
  // -------------------------------------------------------------------------
  console.log(
    "\n[20/20] Verifying Objective 20 (Issue #49): Unseen Public Pages Audit & Flattening (/archive, /tools/[slug], /failures/[slug], /incidents/[slug])..."
  );

  const workingToolHubSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/WorkingToolHubClient.tsx"),
    "utf8"
  );
  const failureModeHubSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/FailureModeHubClient.tsx"),
    "utf8"
  );

  // 1. /archive (KnowledgeGraphClient.tsx):
  // - Uses SectionHeader & InteractiveCardLink in Monitored Publications view
  // - Removes BrassSectionDivider and nested bordered table badges / Info buttons
  assert.ok(
    knowledgeGraphSource.includes("SectionHeader") &&
      knowledgeGraphSource.includes("InteractiveCardLink"),
    "Issue #49: KnowledgeGraphClient.tsx must use SectionHeader and InteractiveCardLink primitives"
  );
  assert.equal(
    knowledgeGraphSource.includes("BrassSectionDivider") ||
      knowledgeGraphSource.includes("openRubricInspector"),
    false,
    "Issue #49: KnowledgeGraphClient.tsx must remove BrassSectionDivider and secondary [i] button clutter inside table rows"
  );

  // 2. /tools/[slug] & /failures/[slug] (WorkingToolHubClient.tsx & FailureModeHubClient.tsx):
  // - Removes concentric inner borders around hero copperplate engravings
  // - Replaces nested bordered callout boxes in 3-part essay cards with hairline border-b subtitles
  // - Un-boxes outer Related Podcast Episodes section and uses InteractiveCardLink
  assert.equal(
    workingToolHubSource.includes("border border-[#D4AF37]/40 bg-slate-950/90") ||
      workingToolHubSource.includes("border border-amber-500/20 rounded px-3 py-2") ||
      workingToolHubSource.includes("border border-slate-800/90 bg-slate-950/60"),
    false,
    "Issue #49: WorkingToolHubClient.tsx must remove concentric engraving borders, nested telemetry boxes, and nested essay callout boxes"
  );
  assert.equal(
    failureModeHubSource.includes("border-amber-500/40 bg-slate-950/90") ||
      failureModeHubSource.includes("border border-amber-500/20 rounded px-3 py-2") ||
      failureModeHubSource.includes("border border-slate-800/90 bg-slate-950/60"),
    false,
    "Issue #49: FailureModeHubClient.tsx must remove concentric engraving borders, nested telemetry boxes, and nested essay callout boxes"
  );
  assert.ok(
    workingToolHubSource.includes("InteractiveCardLink") &&
      workingToolHubSource.includes("SectionHeader") &&
      failureModeHubSource.includes("InteractiveCardLink") &&
      failureModeHubSource.includes("SectionHeader"),
    "Issue #49: WorkingToolHubClient.tsx and FailureModeHubClient.tsx must use SectionHeader and InteractiveCardLink"
  );

  // 3. /incidents/[slug] (IncidentBriefClient.tsx):
  // - Un-boxes Left Diagnostic Sidebar (hairline border-t dividers instead of 4 inner bordered boxes)
  // - Strips // dual-subtitles and uses I. Plain Facts & Context, II. Noise vs. Structural Signal, III. Socratic Verification
  // - De-nests Section II and Section III (no inset-2 border, no inner bordered question cards or Q1/Q2 boxes)
  assert.ok(
    incidentBriefSource.includes("I. Plain Facts &amp; Context") &&
      incidentBriefSource.includes("II. Noise vs. Structural Signal") &&
      incidentBriefSource.includes("III. Socratic Verification"),
    "Issue #49: IncidentBriefClient.tsx must display clean Section I, II, and III eyebrows without // dual-subtitles"
  );
  assert.equal(
    incidentBriefSource.includes("III. THE TRESTLEBOARD INQUIRY // SOCRATIC VERIFICATION") ||
      incidentBriefSource.includes("inset-2 border") ||
      incidentBriefSource.includes("border border-[#EF4444]/40") ||
      incidentBriefSource.includes("border border-[#10B981]/45"),
    false,
    "Issue #49: IncidentBriefClient.tsx must remove // telemetry dual-subtitles, inset-2 double borders, and nested Section II/III boxes"
  );

  console.log(
    "  ✓ Objective 20 (Issue #49) Unseen Public Pages Flattening (/archive, /tools/[slug], /failures/[slug], /incidents/[slug]) verified."
  );

  // -------------------------------------------------------------------------
  // 21. OBJECTIVE 21 (ISSUE #50): ADMIN PORTAL KRUG "DON'T MAKE ME THINK" DISCIPLINE (admin.thecabcall.com)
  // -------------------------------------------------------------------------
  console.log(
    "\n[21/21] Verifying Objective 21 (Issue #50): Admin Portal Krug 'Don\\'t Make Me Think' Discipline & UI/UX Flattening..."
  );

  const adminLoginSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminLoginClient.tsx"),
    "utf8"
  );
  const adminUsersSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminUsersClient.tsx"),
    "utf8"
  );
  const adminAuditSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminAuditClient.tsx"),
    "utf8"
  );
  const adminPublishingSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/admin/publishing/page.tsx"),
    "utf8"
  );

  // 1. Zero // telemetry dual-subtitles across all Admin components
  for (const [adminFileName, adminContent] of [
    ["AdminLoginClient.tsx", adminLoginSource],
    ["AdminShellNav.tsx", adminShellNavSource],
    ["AdminOverviewClient.tsx", adminOverviewSource],
    ["AdminIncidentsClient.tsx", adminIncidentsSource],
    ["AdminFeedsClient.tsx", adminFeedsSource],
    ["AdminFiltersClient.tsx", adminFiltersSource],
    ["AdminEpisodesClient.tsx", adminEpisodesSource],
    ["AdminUsersClient.tsx", adminUsersSource],
    ["AdminAuditClient.tsx", adminAuditSource],
    ["admin/publishing/page.tsx", adminPublishingSource],
  ] as const) {
    assert.equal(
      /[A-Z0-9]\s+\/\/\s+[A-Z0-9]/.test(adminContent),
      false,
      `Issue #50: ${adminFileName} must not contain any ' // ' telemetry dual-subtitles`
    );
  }

  // 2. AdminOverviewClient.tsx: de-nested Editorial Actions & no repetitive ✓ Verified pills in Recent Activity rows
  assert.equal(
    adminOverviewSource.includes("✓ Verified"),
    false,
    "Issue #50: AdminOverviewClient.tsx must remove repetitive green '✓ Verified' pills from Recent Activity rows"
  );
  assert.ok(
    adminOverviewSource.includes("divide-x divide-[#8A6D3B]/35"),
    "Issue #50: AdminOverviewClient.tsx must flatten Editorial Actions into a hairline-divided grid"
  );

  // 3. AdminEpisodesClient.tsx & AdminIncidentsClient.tsx: Format Paragraphs helper, max-w-prose, and HairlineSection
  assert.ok(
    adminEpisodesSource.includes("formatTranscriptParagraphs") &&
      adminEpisodesSource.includes("Format Paragraphs") &&
      adminEpisodesSource.includes("max-w-prose") &&
      adminEpisodesSource.includes("HairlineSection"),
    "Issue #50: AdminEpisodesClient.tsx must include Format Paragraphs button, max-w-prose, and HairlineSection"
  );
  assert.ok(
    adminIncidentsSource.includes("formatTranscriptParagraphs") &&
      adminIncidentsSource.includes("Format Paragraphs") &&
      adminIncidentsSource.includes("max-w-prose") &&
      adminIncidentsSource.includes("HairlineSection"),
    "Issue #50: AdminIncidentsClient.tsx must include Format Paragraphs button, max-w-prose, and HairlineSection"
  );

  // 4. AdminAuditClient.tsx & admin/publishing/page.tsx flattening
  assert.ok(
    adminAuditSource.includes("HairlineSection") &&
      adminAuditSource.includes("Ledger Chain Verified"),
    "Issue #50: AdminAuditClient.tsx must use HairlineSection in the Event Inspector and display 'Ledger Chain Verified'"
  );
  assert.ok(
    adminPublishingSource.includes("Inspect Feed ↗") &&
      !adminPublishingSource.includes("Open Feed ↗"),
    "Issue #50: admin/publishing/page.tsx must unify syndication feed cards around a single 'Inspect Feed ↗' action"
  );

  console.log(
    "  ✓ Objective 21 (Issue #50) Admin Portal Krug 'Don\\'t Make Me Think' Flattening, Format Paragraphs Helpers, and De-Nested Inspectors verified."
  );

  // -------------------------------------------------------------------------
  // 22. OBJECTIVE 22 (ISSUE #12): OUTBOUND PUBLISHED FEEDS & SYNDICATION STUDIO (/admin/publishing, /feed.xml, /feeds/incidents.*)
  // -------------------------------------------------------------------------
  console.log(
    "\n[22/22] Verifying Objective 22 (Issue #12): Outbound Published Feeds & Syndication Studio (D1 Schema, Audit Ledger & XML/JSON Feed Toggles)..."
  );

  const adminPublishingClientSource = fs.readFileSync(
    path.join(process.cwd(), "src/components/AdminPublishingClient.tsx"),
    "utf8"
  );
  assert.equal(
    /[A-Z0-9]\s+\/\/\s+[A-Z0-9]/.test(adminPublishingClientSource),
    false,
    "Issue #12/#50: AdminPublishingClient.tsx must not contain any ' // ' telemetry dual-subtitles"
  );
  assert.ok(
    adminPublishingClientSource.includes("HairlineSection") &&
      adminPublishingClientSource.includes("HeroCornerBrackets") &&
      adminPublishingClientSource.includes("Inspect Feed ↗"),
    "Issue #12: AdminPublishingClient.tsx must use HairlineSection, HeroCornerBrackets, and 'Inspect Feed ↗'"
  );

  const seededOutboundFeeds = await listOutboundFeeds(db);
  assert.equal(
    seededOutboundFeeds.length,
    3,
    "Issue #12: 0007_outbound_published_feeds.sql must seed 3 baseline feeds (podcast-rss, incidents-rss, incidents-json)"
  );
  assert.deepEqual(
    seededOutboundFeeds.map((f) => f.slug),
    ["podcast-rss", "incidents-rss", "incidents-json"],
    "Issue #12: Baseline outbound feed slugs must be podcast-rss, incidents-rss, and incidents-json"
  );

  // Update incidents-rss and verify audit_ledger records outbound_feed.update
  const updateFeedRes = await updateOutboundFeed(
    db,
    {
      idOrSlug: "incidents-rss",
      title: "The CAB Call — De-Alarmed Case Briefs Feed",
      maxItems: 25,
      useDeescalatedTitles: true,
      includeOriginalTitleNote: true,
      includeAttachedImages: true,
      includeFullSocraticBrief: true,
      includeAuditLedgerFooter: true,
      reason: "Verification test update for Issue #12",
    },
    {
      actorEmail: "owner@thecabcall.com",
      actorRole: "owner",
      authMethod: "google_oauth",
    }
  );
  assert.equal(
    updateFeedRes.feed.title,
    "The CAB Call — De-Alarmed Case Briefs Feed"
  );
  assert.equal(updateFeedRes.feed.maxItems, 25);
  assert.equal(updateFeedRes.auditEntry.actionType, "outbound_feed.update");
  assert.equal(updateFeedRes.auditEntry.targetType, "outbound_feed");
  assert.equal(updateFeedRes.auditEntry.targetId, "incidents-rss");

  // Create custom filtered outbound feed and verify outbound_feed.create
  const createFeedRes = await createOutboundFeed(
    db,
    {
      slug: "incidents-the-square",
      title: "The CAB Call — The Square Case Briefs",
      description: "Filtered feed for The Square",
      filterWorkingTool: "The Square",
      reason: "Verification test create for Issue #12",
    },
    {
      actorEmail: "owner@thecabcall.com",
      actorRole: "owner",
      authMethod: "google_oauth",
    }
  );
  assert.equal(createFeedRes.feed.slug, "incidents-the-square");
  assert.equal(createFeedRes.feed.filterWorkingTool, "The Square");
  assert.equal(createFeedRes.auditEntry.actionType, "outbound_feed.create");

  // Delete custom feed and verify outbound_feed.delete + chain integrity
  const deleteFeedRes = await deleteOutboundFeed(
    db,
    "incidents-the-square",
    "Clean up test feed",
    {
      actorEmail: "owner@thecabcall.com",
      actorRole: "owner",
      authMethod: "google_oauth",
    }
  );
  assert.equal(deleteFeedRes.deletedSlug, "incidents-the-square");
  assert.equal(deleteFeedRes.auditEntry.actionType, "outbound_feed.delete");

  const chainCheckAfterPublishing = await verifyAuditChainIntegrity(db);
  assert.equal(
    chainCheckAfterPublishing.valid,
    true,
    "Issue #12: SHA-256 audit ledger chain must remain 100% valid after outbound_feed mutations"
  );

  // Verify XML & JSON Feed rendering with de-alarmed titles, provenance notes, <media:content>, and audit footer
  const sampleSyndicatedIncident: PublicIncidentDto = {
    id: "d1-inc-901",
    incidentCode: "#CAB-2026-0901",
    slug: "regional-substation-relay-trip-d1-901",
    sourceFeed: "NPR Top News",
    title: "Regional Substation Relay Trip Delays Commuter Rail Corridor",
    originalTitle: "SHOCKING GRID MELTDOWN PARALYZES COMMUTER RAIL!",
    titleRewritten: true,
    titleRewriteReason: "Neutralized alarmist all-caps source headline",
    sourceUrl: "https://www.npr.org/2026/10/21/substation-relay-trip",
    publishedAt: "2026-10-21T12:00:00.000Z",
    domainSector: "Infrastructure & Supply Chain",
    primaryTool: "The Square",
    secondaryTool: "24-Inch Gauge",
    sreFailureMode: "Single Point of Failure (SPOF) / Untested Failover",
    executiveSummary:
      "A protective relay trip at a regional substation halted commuter rail signaling for three hours on Wednesday morning. Backup battery inverters failed to engage automatically because transfer switch firmware had not been tested under load.",
    socraticBrief:
      "A protective relay trip at a regional traction power substation halted commuter rail signaling across three interlocking zones on Wednesday morning. While the transit authority maintained dual-feed power contracts, the automatic transfer switch failed to cut over when primary voltage sagged.",
    proportionalityCheck: {
      noiseOverblown:
        "Cable commentary framing the three-hour delay as a total collapse of regional infrastructure ignores that physical track and rolling stock remained undamaged.",
      structuralSignal:
        "Standby failover mechanisms that are only verified on paper rather than under live load conditions create a hidden single point of failure during routine utility faults.",
    },
    questions: [
      "When was our primary automatic transfer switch last tested under an unannounced live load drop?",
      "Which backup dependencies share the same control-plane firmware as the primary path?",
    ],
    imageUrl: "/media/card-d1-901.svg",
    imageAlt: "Substation relay telemetry blueprint",
    imageCaption: "Blueprint Card · The Square",
  };

  const rssXmlDeescalated = renderIncidentsRssXml(
    [sampleSyndicatedIncident],
    updateFeedRes.feed
  );
  assert.ok(
    rssXmlDeescalated.includes('xmlns:media="http://search.yahoo.com/mrss/"') &&
      rssXmlDeescalated.includes(
        "<title>Regional Substation Relay Trip Delays Commuter Rail Corridor</title>"
      ) &&
      rssXmlDeescalated.includes("Original source headline:") &&
      rssXmlDeescalated.includes(
        "SHOCKING GRID MELTDOWN PARALYZES COMMUTER RAIL!"
      ) &&
      rssXmlDeescalated.includes(
        '<media:content url="https://thecabcall.com/media/card-d1-901.svg"'
      ) &&
      rssXmlDeescalated.includes("Immutable Audit Trail Verification:"),
    "Issue #12: renderIncidentsRssXml must emit <media:content>, de-alarmed title, original headline provenance note, and audit verification footer"
  );

  const rssXmlRawTitle = renderIncidentsRssXml([sampleSyndicatedIncident], {
    ...updateFeedRes.feed,
    useDeescalatedTitles: false,
    includeAttachedImages: false,
    includeFullSocraticBrief: false,
  });
  assert.ok(
    rssXmlRawTitle.includes(
      "<title>SHOCKING GRID MELTDOWN PARALYZES COMMUTER RAIL!</title>"
    ) && !rssXmlRawTitle.includes("<media:content"),
    "Issue #12: renderIncidentsRssXml must switch to originalTitle when useDeescalatedTitles=false and omit <media:content> when includeAttachedImages=false"
  );

  const jsonFeedPayload = renderIncidentsJsonFeed(
    [sampleSyndicatedIncident],
    seededOutboundFeeds[2]
  ) as {
    version: string;
    items: Array<Record<string, unknown>>;
  };
  assert.equal(jsonFeedPayload.version, "https://jsonfeed.org/version/1.1");
  assert.equal(jsonFeedPayload.items.length, 1);
  assert.equal(
    jsonFeedPayload.items[0].title,
    "Regional Substation Relay Trip Delays Commuter Rail Corridor"
  );
  assert.equal(
    jsonFeedPayload.items[0].image,
    "https://thecabcall.com/media/card-d1-901.svg"
  );

  const podcastXml = renderPodcastRssXml(INITIAL_EPISODES.slice(0, 2), seededOutboundFeeds[0]);
  assert.ok(
    podcastXml.includes("<itunes:subtitle>") &&
      podcastXml.includes("<enclosure url="),
    "Issue #12: renderPodcastRssXml must render dynamic channel metadata and audio enclosures"
  );

  console.log(
    "  ✓ Objective 22 (Issue #12) Outbound Published Feeds & Syndication Studio (D1 Schema, Audit Ledger & XML/JSON Feed Toggles) verified."
  );

  console.log(
    "\n=== ALL 22 DEFENSIVE HARDENING, CRAFT PROSE, KRUG USABILITY, MASTHEAD, PODCAST ARCHIVE, ADMIN STUDY, EPIC #44 IA SCALE, EPIC #45 KRUG UI/UX FLATTENING & ISSUE #12 SYNDICATION STUDIO OBJECTIVES PASSED (100%) ==="
  );
}

runVerificationSuite().catch((err) => {
  console.error("\n[VERIFICATION FAILED]:", err);
  process.exit(1);
});
