import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  cleanRssText,
  normalizeCanonicalUrl,
  stripUnsafeHtmlAndCdata,
} from "../src/lib/sanitize.ts";
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
  mapDtoToCraftLexicon,
} from "../src/lib/dto.ts";
import {
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
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

  console.log(
    "  ✓ Craft Lexicon mapper, 'Structural Friction' safe fallback, and plain-spoken UI labels verified."
  );
  console.log(
    "\n=== ALL 6 DEFENSIVE HARDENING & CRAFT LEXICON OBJECTIVES PASSED (100%) ==="
  );
}

runVerificationSuite().catch((err) => {
  console.error("\n[VERIFICATION FAILED]:", err);
  process.exit(1);
});
