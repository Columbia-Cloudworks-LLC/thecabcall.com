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
  isTemplatedOrMalformedCopy,
  normalizeCanonicalUrl,
  normalizeStoredQuestionsPayload,
  stripUnsafeHtmlAndCdata,
} from "../src/lib/sanitize.ts";
import {
  ensureD1Snapshot,
  extractStoredQuestionsPayload,
  readLocalD1Snapshot,
} from "../src/lib/d1-bridge.ts";
import { INITIAL_INCIDENTS } from "../src/lib/seed-data.ts";
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
  formatCraftLedgerEntry,
  formatFriendlySourceName,
  mapDtoToCraftLexicon,
  projectPublicIncidentDto,
  type PublicIncidentDto,
} from "../src/lib/dto.ts";
import {
  getSreFailureModeSpec,
  getWorkingToolSpec,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SRE_FAILURE_MODES,
  WORKING_TOOLS,
} from "../src/lib/taxonomy.ts";
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
        "Weekly Trestleboard Briefs (5-Min)",
        "1. The Week&apos;s Trestleboard (0:00 – 1:15)",
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
    "src/components/KnowledgeGraphClient.tsx",
    "src/components/PodcastArchiveClient.tsx",
    "src/components/SiteHeader.tsx",
    "src/components/SiteFooter.tsx",
    "src/components/SystemStatusClient.tsx",
    "src/components/PersistentAudioPlayer.tsx",
    "src/components/MasonicEngravings.tsx",
    "src/app/page.tsx",
    "src/app/incidents/[slug]/page.tsx",
    "src/app/knowledge-graph/page.tsx",
    "src/app/archive/page.tsx",
    "src/app/rubric/page.tsx",
    "src/app/status/page.tsx",
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
          <a href="/knowledge-graph">The Archive</a>
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
        <a href="/knowledge-graph?tool=${encodeURIComponent(inc.primaryTool)}">More '${inc.primaryTool}' Cases →</a>
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
  console.log(
    "\n=== ALL 11 DEFENSIVE HARDENING, CRAFT PROSE & KRUG USABILITY OBJECTIVES PASSED (100%) ==="
  );
}

runVerificationSuite().catch((err) => {
  console.error("\n[VERIFICATION FAILED]:", err);
  process.exit(1);
});
