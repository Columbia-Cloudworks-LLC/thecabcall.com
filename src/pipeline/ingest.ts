import {
  appendAuditEntry,
  AuditAuthMethod,
  AuditLedgerEntry,
} from "./audit";
import {
  buildDroppedByFilterJevResult,
  evaluateArticleWithJev,
  JevDispositionStatus,
  JevEvaluationOptions,
  JevEvaluationResult,
  JevWorkingToolKey,
  validateJevEvaluationOutput,
} from "./jev";
import {
  normalizeCanonicalUrl,
  stripUnsafeHtmlAndCdata,
  validateAndNormalizeIncidentSummary,
} from "../lib/sanitize";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<T>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  batch?<T = unknown>(statements: D1PreparedStatementLike[]): Promise<T[]>;
}

/**
 * Executes an array of parameterized D1 prepared statements using `db.batch()` when available,
 * falling back to sequential execution only on minimal mock objects.
 */
export async function executeD1Batch(
  db: D1DatabaseLike,
  statements: D1PreparedStatementLike[]
): Promise<void> {
  if (statements.length === 0) return;
  if (typeof db.batch === "function") {
    await db.batch(statements);
    return;
  }
  for (const stmt of statements) {
    await stmt.run();
  }
}

export const DEFAULT_FEED_FETCH_TIMEOUT_MS = 8_000;
export const DEFAULT_MAX_FEED_RESPONSE_BYTES = 1_048_576; // 1 MiB strict cap

export interface FeedConfig {
  id?: number;
  name: string;
  focusArea: string;
  url: string;
  domainSectorOverride?: string | null;
  itemsPerPoll?: number;
}

export const US_HIGH_IMPACT_FEEDS: FeedConfig[] = [
  {
    id: 1,
    name: "NPR Top News",
    focusArea: "Broad US Top Stories",
    url: "https://feeds.npr.org/1001/rss.xml",
    domainSectorOverride: "Public Policy & Governance",
    itemsPerPoll: 5,
  },
  {
    id: 2,
    name: "PBS NewsHour Nation",
    focusArea: "Institutional & Policy",
    url: "https://www.pbs.org/newshour/feeds/rss/nation",
    domainSectorOverride: "Public Policy & Governance",
    itemsPerPoll: 5,
  },
  {
    id: 3,
    name: "NYT HomePage",
    focusArea: "Mainstream Agenda-Setting",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    domainSectorOverride: "Public Policy & Governance",
    itemsPerPoll: 5,
  },
  {
    id: 4,
    name: "WSJ US Business",
    focusArea: "Corporate, Supply Chain & Fed",
    url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",
    domainSectorOverride: "Economics & Markets",
    itemsPerPoll: 5,
  },
  {
    id: 5,
    name: "Ars Technica",
    focusArea: "Tech, Infrastructure & Security",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    domainSectorOverride: "Technology & Cyber",
    itemsPerPoll: 5,
  },
];

export interface IngestFeedRow {
  id: number;
  name: string;
  url: string;
  focus_area: string;
  domain_sector_override: string | null;
  items_per_poll: number;
  enabled: number;
  last_polled_at: string | null;
  last_status: string | null;
  last_error: string | null;
  total_ingested: number;
  created_at: string;
  updated_at: string;
}

export interface IngestFeedRecord {
  id: number;
  name: string;
  url: string;
  focusArea: string;
  domainSectorOverride: string | null;
  itemsPerPoll: number;
  enabled: boolean;
  lastPolledAt: string | null;
  lastStatus: "nominal" | "degraded" | "error" | string;
  lastError: string | null;
  totalIngested: number;
  createdAt: string;
  updatedAt: string;
}

export type IngestFilterType =
  | "Drop_Keyword_Regex"
  | "Require_Keyword_Regex"
  | "Boost_Systemic_Prob"
  | "Block_Source_Pattern"
  | "Force_Working_Tool";

export type IngestFilterMatchTarget =
  | "title"
  | "excerpt"
  | "title_and_excerpt"
  | "url";

export interface IngestFilterRow {
  id: number;
  name: string;
  description: string;
  filter_type: IngestFilterType;
  match_target: IngestFilterMatchTarget;
  pattern: string;
  scope_feed_id: number | null;
  action_value: string | null;
  enabled: number;
  hit_count: number;
  created_at: string;
  updated_at: string;
}

export interface IngestFilterRecord {
  id: number;
  name: string;
  description: string;
  filterType: IngestFilterType;
  matchTarget: IngestFilterMatchTarget;
  pattern: string;
  scopeFeedId: number | null;
  actionValue: string | null;
  enabled: boolean;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettingsMap {
  jevMinSystemicProb: number;
  jevMinConfidence: number;
  maxNetNewPerRun: number;
  defaultItemsPerPoll: number;
}

export interface FeedFilterAdminActor {
  actorEmail: string;
  actorRole?: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
}

export interface ParsedRssItem {
  urlHash: string;
  guid?: string;
  sourceFeed: string;
  feedId?: number;
  title: string;
  sourceUrl: string;
  rawExcerpt: string;
  publishedAt: string;
}

export interface FeedTestPreviewResult {
  ok: boolean;
  url: string;
  feedTitle?: string;
  feedFormat?: "rss2" | "atom" | "rdf" | "unknown";
  httpStatus?: number;
  latencyMs: number;
  itemCount: number;
  items: ParsedRssItem[];
  error?: string;
}

export interface FilterMatchTrace {
  filterId: number;
  filterName: string;
  filterType: IngestFilterType;
  matchTarget: IngestFilterMatchTarget;
  pattern: string;
  actionValue: string | null;
  matched: boolean;
  matchedSnippet: string | null;
  effect: string;
}

export interface FilterDryRunItemResult {
  title: string;
  sourceFeed: string;
  sourceUrl: string;
  excerptSnippet: string;
  baseSystemicProb: number;
  adjustedSystemicProb: number;
  thresholdApplied: number;
  basePrimaryTool: string;
  finalPrimaryTool: string;
  preFilterDropped: boolean;
  finalOutcome: "triaged" | "dropped";
  matchedFilters: FilterMatchTrace[];
}

export interface FilterDryRunResult {
  ok: boolean;
  evaluatedAt: string;
  thresholds: SystemSettingsMap;
  totalTested: number;
  triagedCount: number;
  droppedCount: number;
  candidateFilterSummary?: {
    name: string;
    filterType: IngestFilterType;
    matchTarget: IngestFilterMatchTarget;
    pattern: string;
    actionValue?: string | null;
    matchCount: number;
  };
  results: FilterDryRunItemResult[];
}

export type ArticleIngestionStatus =
  | "triaged"
  | "QUARANTINED"
  | "PENDING_RETRY"
  | "dropped";

export interface IngestedArticleSummary {
  id?: number;
  url_hash: string;
  guid?: string;
  source_feed: string;
  title: string;
  source_url: string;
  published_at: string;
  is_systemic_prob: number;
  jev_confidence: number;
  primary_tool: string;
  secondary_tool: string;
  sre_failure_mode: string;
  status: ArticleIngestionStatus;
  quarantine_reason?: string;
  matched_filters?: string[];
}

export interface IngestRunSummary {
  startedAt: string;
  completedAt: string;
  feedsPolled: number;
  itemsFetched: number;
  skippedDuplicates: number;
  ingestedCount: number;
  triagedCount: number;
  quarantinedCount: number;
  pendingRetryCount: number;
  droppedCount: number;
  preFilterDroppedCount?: number;
  avgLatencyMs: number;
  thresholdsUsed?: SystemSettingsMap;
  articles: IngestedArticleSummary[];
  feedErrors?: { feed: string; error: string }[];
}

export function mapFeedRowToRecord(row: IngestFeedRow): IngestFeedRecord {
  return {
    id: Number(row.id),
    name: row.name,
    url: row.url,
    focusArea: row.focus_area,
    domainSectorOverride: row.domain_sector_override || null,
    itemsPerPoll: Number(row.items_per_poll || 5),
    enabled: Number(row.enabled) === 1,
    lastPolledAt: row.last_polled_at || null,
    lastStatus: row.last_status || "nominal",
    lastError: row.last_error || null,
    totalIngested: Number(row.total_ingested || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFilterRowToRecord(row: IngestFilterRow): IngestFilterRecord {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || "",
    filterType: row.filter_type,
    matchTarget: row.match_target || "title_and_excerpt",
    pattern: row.pattern,
    scopeFeedId:
      row.scope_feed_id !== null && row.scope_feed_id !== undefined
        ? Number(row.scope_feed_id)
        : null,
    actionValue: row.action_value || null,
    enabled: Number(row.enabled) === 1,
    hitCount: Number(row.hit_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Ensures `ingest_feeds`, `ingest_filters`, and `system_settings` tables exist and are seeded
 * if migration 0005 has not yet run on an isolated SQLite instance.
 */
export async function ensureFeedsAndFiltersTables(
  db: D1DatabaseLike
): Promise<void> {
  try {
    const check = await db
      .prepare("SELECT COUNT(*) as cnt FROM ingest_feeds")
      .first<{ cnt: number }>();
    if (check !== null) {
      return;
    }
  } catch {
    // Table does not exist yet; create and seed below
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ingest_feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL UNIQUE,
        focus_area TEXT NOT NULL,
        domain_sector_override TEXT,
        items_per_poll INTEGER NOT NULL DEFAULT 5,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_polled_at TEXT,
        last_status TEXT DEFAULT 'nominal',
        last_error TEXT,
        total_ingested INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  const feedSeedStatements = US_HIGH_IMPACT_FEEDS.map((f) =>
    db
      .prepare(
        `INSERT INTO ingest_feeds (name, url, focus_area, domain_sector_override, items_per_poll, enabled, last_status)
         VALUES (?, ?, ?, ?, ?, 1, 'nominal')
         ON CONFLICT(url) DO NOTHING`
      )
      .bind(
        f.name,
        f.url,
        f.focusArea,
        f.domainSectorOverride || null,
        f.itemsPerPoll || 5
      )
  );
  await executeD1Batch(db, feedSeedStatements);

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ingest_filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        filter_type TEXT NOT NULL,
        match_target TEXT NOT NULL DEFAULT 'title_and_excerpt',
        pattern TEXT NOT NULL,
        scope_feed_id INTEGER,
        action_value TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        hit_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  const existingFilters = await db
    .prepare("SELECT COUNT(*) as cnt FROM ingest_filters")
    .first<{ cnt: number }>();
  if (Number(existingFilters?.cnt ?? 0) === 0) {
    const baselineFilters: Array<{
      name: string;
      description: string;
      filter_type: IngestFilterType;
      match_target: IngestFilterMatchTarget;
      pattern: string;
      action_value: string;
    }> = [
      {
        name: "Sports & Athletic Scores Drop",
        description:
          "Immediately drops routine sports game recaps, league scores, and playoff brackets before System-2 synthesis.",
        filter_type: "Drop_Keyword_Regex",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(nfl|nba|mlb|nhl|touchdown|playoff|super bowl|world series|premier league|ncaa tournament|quarterback)\\b",
        action_value: "drop",
      },
      {
        name: "Celebrity, Red Carpet & Box Office Drop",
        description:
          "Excludes entertainment gossip, award shows, red carpet coverage, and box office tallies.",
        filter_type: "Drop_Keyword_Regex",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(box office|red carpet|celebrity|oscars|grammys|emmys|kardashian|met gala|movie review|album review)\\b",
        action_value: "drop",
      },
      {
        name: "Lifestyle, Recipes, Horoscopes & Puzzles Drop",
        description:
          "Filters daily puzzles, horoscopes, recipes, and personal lifestyle advice columns.",
        filter_type: "Drop_Keyword_Regex",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(recipe|horoscope|wordle|crossword|connections hint|strands hint|sudoku|cooking tip|hot flashes|night sweats)\\b",
        action_value: "drop",
      },
      {
        name: "Retail Deal Alerts & Consumer Product Roundups",
        description:
          "Drops e-commerce shopping guides, affiliate product reviews, and seasonal deal alerts.",
        filter_type: "Drop_Keyword_Regex",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(deal alert|best headphones|promo code|gift guide|prime day|black friday deals|wirecutter|buying guide|review:)\\b",
        action_value: "drop",
      },
      {
        name: "Market Ticker & Ephemeral Roundup Noise",
        description:
          "Drops generic intraday stock ticker roundups lacking structural or institutional telemetry.",
        filter_type: "Drop_Keyword_Regex",
        match_target: "title",
        pattern: "\\b(market talk|roundup:|stock market today: live)\\b",
        action_value: "drop",
      },
      {
        name: "Federal & Constitutional Governance Boost",
        description:
          "Boosts systemic probability for Supreme Court rulings, federal agency actions, congressional oversight, and statutory friction.",
        filter_type: "Boost_Systemic_Prob",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(supreme court|federal reserve|pentagon|doj|faa|sec|fcc|congress|senate|inspector general|constitutional|executive order|subpoena)\\b",
        action_value: "+0.18",
      },
      {
        name: "Critical Infrastructure, Grid & Cyber Outage Boost",
        description:
          "Boosts systemic probability for cascading infrastructure failures, power grid strain, aviation outages, and cyber incidents.",
        filter_type: "Boost_Systemic_Prob",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(outage|power grid|cascading failure|ransomware|zero-day|air traffic|supply chain|pipeline|derailment|water system|telecom)\\b",
        action_value: "+0.20",
      },
      {
        name: "Audit, Whistleblower & Post-Mortem Signal Boost",
        description:
          "Elevates dispatches involving formal audits, whistleblower disclosures, skipped inspections, and post-mortem investigations.",
        filter_type: "Boost_Systemic_Prob",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(whistleblower|audit finds|inspector general|post-mortem|safety violation|skipped maintenance|regulatory filing|consent decree)\\b",
        action_value: "+0.15",
      },
      {
        name: "Sponsored & Affiliate URL Block",
        description:
          "Blocks outbound article URLs matching known commerce, coupon, or sponsored content path segments.",
        filter_type: "Block_Source_Pattern",
        match_target: "url",
        pattern: "(/sponsored/|/affiliate/|/coupons/|/deals/|utm_medium=affiliate)",
        action_value: "drop",
      },
      {
        name: "Force Plumb on Whistleblower & Ethics Breaches",
        description:
          "Assigns The Plumb as primary Working Tool when dispatches document falsified logs, bribery, or whistleblower retaliation.",
        filter_type: "Force_Working_Tool",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(whistleblower|falsified logs|bribery|inspector general audit|cover-up|ethics violation)\\b",
        action_value: "plumb",
      },
      {
        name: "Force Square on Constitutional & Statutory Drift",
        description:
          "Assigns The Square as primary Working Tool when dispatches focus on injunctions, statutory authority, or constitutional compliance.",
        filter_type: "Force_Working_Tool",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(unconstitutional|statutory authority|court blocks|injunction|violates federal law|regulatory compliance)\\b",
        action_value: "square",
      },
      {
        name: "Force 24-Inch Gauge on Maintenance & Budget Backlog",
        description:
          "Assigns the 24-Inch Gauge when dispatches center on deferred maintenance, staffing shortages, or appropriations lapses.",
        filter_type: "Force_Working_Tool",
        match_target: "title_and_excerpt",
        pattern:
          "\\b(deferred maintenance|staffing shortage|appropriations lapse|government shutdown|budget backlog)\\b",
        action_value: "twenty_four_inch_gauge",
      },
    ];

    const filterSeedStatements = baselineFilters.map((bf) =>
      db
        .prepare(
          `INSERT INTO ingest_filters (name, description, filter_type, match_target, pattern, scope_feed_id, action_value, enabled, hit_count)
           VALUES (?, ?, ?, ?, ?, NULL, ?, 1, 0)`
        )
        .bind(
          bf.name,
          bf.description,
          bf.filter_type,
          bf.match_target,
          bf.pattern,
          bf.action_value
        )
    );
    await executeD1Batch(db, filterSeedStatements);
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  const defaults: Array<[string, string, string]> = [
    [
      "jev_min_systemic_prob",
      "0.70",
      "Minimum Jev (jev-1.14.0) systemic probability threshold [0.50 - 0.95] required to triage an article into System-2 synthesis.",
    ],
    [
      "jev_min_confidence",
      "0.50",
      "Minimum Jev working-tool classification confidence threshold.",
    ],
    [
      "max_net_new_per_run",
      "10",
      "Maximum net-new articles evaluated per scheduled or manual ingestion pass.",
    ],
    [
      "default_items_per_poll",
      "5",
      "Default number of latest RSS/Atom items inspected per feed poll when not overridden on the feed.",
    ],
  ];

  const settingsStatements = defaults.map(([k, v, desc]) =>
    db
      .prepare(
        "INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING"
      )
      .bind(k, v, desc)
  );
  await executeD1Batch(db, settingsStatements);
}

export const INGEST_FEEDS_COLUMNS = `
  id,
  name,
  url,
  focus_area,
  domain_sector_override,
  items_per_poll,
  enabled,
  last_polled_at,
  last_status,
  last_error,
  items_ingested_total,
  created_at,
  updated_at
`;

export const INGEST_FILTERS_COLUMNS = `
  id,
  name,
  description,
  filter_type,
  match_target,
  pattern,
  scope_feed_id,
  action_value,
  enabled,
  hit_count,
  created_at,
  updated_at
`;

/**
 * Lists all configured `ingest_feeds` from D1.
 */
export async function listIngestFeeds(
  db: D1DatabaseLike,
  options?: { enabledOnly?: boolean }
): Promise<IngestFeedRecord[]> {
  await ensureFeedsAndFiltersTables(db);
  const sql = options?.enabledOnly
    ? `SELECT ${INGEST_FEEDS_COLUMNS} FROM ingest_feeds WHERE enabled = 1 ORDER BY id ASC`
    : `SELECT ${INGEST_FEEDS_COLUMNS} FROM ingest_feeds ORDER BY id ASC`;
  const res = await db.prepare(sql).all<IngestFeedRow>();
  return (res.results || []).map(mapFeedRowToRecord);
}

/**
 * Creates a new `ingest_feeds` row and appends a `feed.create` audit entry.
 */
export async function createIngestFeed(
  db: D1DatabaseLike,
  input: {
    name: string;
    url: string;
    focusArea: string;
    domainSectorOverride?: string | null;
    itemsPerPoll?: number;
    enabled?: boolean;
    reason?: string;
  },
  actor: FeedFilterAdminActor
): Promise<{ feed: IngestFeedRecord; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const name = input.name.trim();
  const url = input.url.trim();
  const focusArea = input.focusArea.trim() || "General US Telemetry";
  const domainSectorOverride = input.domainSectorOverride?.trim() || null;
  const itemsPerPoll = Math.min(25, Math.max(1, Number(input.itemsPerPoll ?? 5)));
  const enabled = input.enabled === false ? 0 : 1;

  if (!name || !url) {
    throw new Error("Feed name and URL are required.");
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Feed URL must start with http:// or https://");
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO ingest_feeds (
        name,
        url,
        focus_area,
        domain_sector_override,
        items_per_poll,
        enabled,
        last_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'nominal', ?, ?)`
    )
    .bind(
      name,
      url,
      focusArea,
      domainSectorOverride,
      itemsPerPoll,
      enabled,
      now,
      now
    )
    .run();

  const inserted = await db
    .prepare(`SELECT ${INGEST_FEEDS_COLUMNS} FROM ingest_feeds WHERE url = ?`)
    .bind(url)
    .first<IngestFeedRow>();

  if (!inserted) {
    throw new Error("Failed to read back created ingest_feeds row.");
  }

  const feed = mapFeedRowToRecord(inserted);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "feed.create",
    targetType: "ingest_feed",
    targetId: String(inserted.id),
    reason:
      input.reason?.trim() ||
      `Added inbound RSS/Atom feed "${feed.name}" (${feed.url})`,
    beforeState: null,
    afterState: inserted,
  });

  return { feed, auditEntry };
}

/**
 * Updates an existing `ingest_feeds` row and appends a `feed.update` audit entry.
 */
export async function updateIngestFeed(
  db: D1DatabaseLike,
  id: number,
  input: {
    name?: string;
    url?: string;
    focusArea?: string;
    domainSectorOverride?: string | null;
    itemsPerPoll?: number;
    enabled?: boolean;
    reason?: string;
  },
  actor: FeedFilterAdminActor
): Promise<{ feed: IngestFeedRecord; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const existing = await db
    .prepare(`SELECT ${INGEST_FEEDS_COLUMNS} FROM ingest_feeds WHERE id = ?`)
    .bind(id)
    .first<IngestFeedRow>();

  if (!existing) {
    throw new Error(`Inbound feed #${id} not found.`);
  }

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const url = input.url !== undefined ? input.url.trim() : existing.url;
  const focusArea =
    input.focusArea !== undefined ? input.focusArea.trim() : existing.focus_area;
  const domainSectorOverride =
    input.domainSectorOverride !== undefined
      ? input.domainSectorOverride?.trim() || null
      : existing.domain_sector_override;
  const itemsPerPoll =
    input.itemsPerPoll !== undefined
      ? Math.min(25, Math.max(1, Number(input.itemsPerPoll)))
      : Number(existing.items_per_poll || 5);
  const enabled =
    input.enabled !== undefined
      ? input.enabled
        ? 1
        : 0
      : Number(existing.enabled);

  if (!name || !url) {
    throw new Error("Feed name and URL cannot be empty.");
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE ingest_feeds
       SET name = ?,
           url = ?,
           focus_area = ?,
           domain_sector_override = ?,
           items_per_poll = ?,
           enabled = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(
      name,
      url,
      focusArea,
      domainSectorOverride,
      itemsPerPoll,
      enabled,
      now,
      id
    )
    .run();

  const updated = await db
    .prepare(`SELECT ${INGEST_FEEDS_COLUMNS} FROM ingest_feeds WHERE id = ?`)
    .bind(id)
    .first<IngestFeedRow>();

  if (!updated) {
    throw new Error(`Failed to read back updated feed #${id}.`);
  }

  const feed = mapFeedRowToRecord(updated);
  const toggleNote =
    existing.enabled !== updated.enabled
      ? updated.enabled === 1
        ? `Enabled feed "${feed.name}"`
        : `Paused feed "${feed.name}"`
      : `Updated inbound feed "${feed.name}"`;

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "feed.update",
    targetType: "ingest_feed",
    targetId: String(id),
    reason: input.reason?.trim() || toggleNote,
    beforeState: existing,
    afterState: updated,
  });

  return { feed, auditEntry };
}

/**
 * Deletes an `ingest_feeds` row and appends a `feed.delete` audit entry with full `before_state_json`.
 */
export async function deleteIngestFeed(
  db: D1DatabaseLike,
  id: number,
  reason: string,
  actor: FeedFilterAdminActor
): Promise<{ deletedId: number; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const existing = await db
    .prepare(`SELECT ${INGEST_FEEDS_COLUMNS} FROM ingest_feeds WHERE id = ?`)
    .bind(id)
    .first<IngestFeedRow>();

  if (!existing) {
    throw new Error(`Inbound feed #${id} not found.`);
  }

  await db.prepare("DELETE FROM ingest_feeds WHERE id = ?").bind(id).run();

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "feed.delete",
    targetType: "ingest_feed",
    targetId: String(id),
    reason:
      reason.trim() ||
      `Removed inbound RSS/Atom feed "${existing.name}" (${existing.url})`,
    beforeState: existing,
    afterState: null,
  });

  return { deletedId: id, auditEntry };
}

/**
 * Lists all configured `ingest_filters` from D1.
 */
export async function listIngestFilters(
  db: D1DatabaseLike,
  options?: { enabledOnly?: boolean }
): Promise<IngestFilterRecord[]> {
  await ensureFeedsAndFiltersTables(db);
  const sql = options?.enabledOnly
    ? `SELECT ${INGEST_FILTERS_COLUMNS} FROM ingest_filters WHERE enabled = 1 ORDER BY id ASC`
    : `SELECT ${INGEST_FILTERS_COLUMNS} FROM ingest_filters ORDER BY id ASC`;
  const res = await db.prepare(sql).all<IngestFilterRow>();
  return (res.results || []).map(mapFilterRowToRecord);
}

/**
 * Creates a new `ingest_filters` rule and appends a `filter.create` audit entry.
 */
export async function createIngestFilter(
  db: D1DatabaseLike,
  input: {
    name: string;
    description?: string;
    filterType: IngestFilterType;
    matchTarget?: IngestFilterMatchTarget;
    pattern: string;
    scopeFeedId?: number | null;
    actionValue?: string | null;
    enabled?: boolean;
    reason?: string;
  },
  actor: FeedFilterAdminActor
): Promise<{ filter: IngestFilterRecord; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const name = input.name.trim();
  const description = (input.description || "").trim();
  const filterType = input.filterType;
  const matchTarget: IngestFilterMatchTarget =
    input.matchTarget || "title_and_excerpt";
  const pattern = input.pattern.trim();
  const scopeFeedId =
    input.scopeFeedId !== undefined && input.scopeFeedId !== null
      ? Number(input.scopeFeedId)
      : null;
  const actionValue =
    input.actionValue?.trim() ||
    (filterType === "Boost_Systemic_Prob"
      ? "+0.15"
      : filterType === "Force_Working_Tool"
        ? "square"
        : "drop");
  const enabled = input.enabled === false ? 0 : 1;

  if (!name || !pattern) {
    throw new Error("Filter name and pattern are required.");
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO ingest_filters (
        name,
        description,
        filter_type,
        match_target,
        pattern,
        scope_feed_id,
        action_value,
        enabled,
        hit_count,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    )
    .bind(
      name,
      description,
      filterType,
      matchTarget,
      pattern,
      scopeFeedId,
      actionValue,
      enabled,
      now,
      now
    )
    .run();

  const inserted = await db
    .prepare(
      `SELECT ${INGEST_FILTERS_COLUMNS} FROM ingest_filters ORDER BY id DESC LIMIT 1`
    )
    .first<IngestFilterRow>();

  if (!inserted) {
    throw new Error("Failed to read back created ingest_filters row.");
  }

  const filter = mapFilterRowToRecord(inserted);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "filter.create",
    targetType: "ingest_filter",
    targetId: String(inserted.id),
    reason:
      input.reason?.trim() ||
      `Created triage filter "${filter.name}" (${filter.filterType} on ${filter.matchTarget})`,
    beforeState: null,
    afterState: inserted,
  });

  return { filter, auditEntry };
}

/**
 * Updates an existing `ingest_filters` row and appends a `filter.update` audit entry.
 */
export async function updateIngestFilter(
  db: D1DatabaseLike,
  id: number,
  input: {
    name?: string;
    description?: string;
    filterType?: IngestFilterType;
    matchTarget?: IngestFilterMatchTarget;
    pattern?: string;
    scopeFeedId?: number | null;
    actionValue?: string | null;
    enabled?: boolean;
    reason?: string;
  },
  actor: FeedFilterAdminActor
): Promise<{ filter: IngestFilterRecord; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const existing = await db
    .prepare(`SELECT ${INGEST_FILTERS_COLUMNS} FROM ingest_filters WHERE id = ?`)
    .bind(id)
    .first<IngestFilterRow>();

  if (!existing) {
    throw new Error(`Triage filter #${id} not found.`);
  }

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const description =
    input.description !== undefined
      ? input.description.trim()
      : existing.description;
  const filterType = input.filterType ?? existing.filter_type;
  const matchTarget = input.matchTarget ?? existing.match_target;
  const pattern =
    input.pattern !== undefined ? input.pattern.trim() : existing.pattern;
  const scopeFeedId =
    input.scopeFeedId !== undefined
      ? input.scopeFeedId !== null
        ? Number(input.scopeFeedId)
        : null
      : existing.scope_feed_id;
  const actionValue =
    input.actionValue !== undefined
      ? input.actionValue?.trim() || null
      : existing.action_value;
  const enabled =
    input.enabled !== undefined
      ? input.enabled
        ? 1
        : 0
      : Number(existing.enabled);

  if (!name || !pattern) {
    throw new Error("Filter name and pattern cannot be empty.");
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE ingest_filters
       SET name = ?,
           description = ?,
           filter_type = ?,
           match_target = ?,
           pattern = ?,
           scope_feed_id = ?,
           action_value = ?,
           enabled = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(
      name,
      description,
      filterType,
      matchTarget,
      pattern,
      scopeFeedId,
      actionValue,
      enabled,
      now,
      id
    )
    .run();

  const updated = await db
    .prepare(`SELECT ${INGEST_FILTERS_COLUMNS} FROM ingest_filters WHERE id = ?`)
    .bind(id)
    .first<IngestFilterRow>();

  if (!updated) {
    throw new Error(`Failed to read back updated filter #${id}.`);
  }

  const filter = mapFilterRowToRecord(updated);
  const toggleNote =
    existing.enabled !== updated.enabled
      ? updated.enabled === 1
        ? `Enabled triage filter "${filter.name}"`
        : `Paused triage filter "${filter.name}"`
      : `Updated triage filter "${filter.name}"`;

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "filter.update",
    targetType: "ingest_filter",
    targetId: String(id),
    reason: input.reason?.trim() || toggleNote,
    beforeState: existing,
    afterState: updated,
  });

  return { filter, auditEntry };
}

/**
 * Deletes an `ingest_filters` row and appends a `filter.delete` audit entry.
 */
export async function deleteIngestFilter(
  db: D1DatabaseLike,
  id: number,
  reason: string,
  actor: FeedFilterAdminActor
): Promise<{ deletedId: number; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const existing = await db
    .prepare(`SELECT ${INGEST_FILTERS_COLUMNS} FROM ingest_filters WHERE id = ?`)
    .bind(id)
    .first<IngestFilterRow>();

  if (!existing) {
    throw new Error(`Triage filter #${id} not found.`);
  }

  await db.prepare("DELETE FROM ingest_filters WHERE id = ?").bind(id).run();

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "filter.delete",
    targetType: "ingest_filter",
    targetId: String(id),
    reason:
      reason.trim() ||
      `Deleted triage filter "${existing.name}" (${existing.filter_type})`,
    beforeState: existing,
    afterState: null,
  });

  return { deletedId: id, auditEntry };
}

/**
 * Reads global ingestion & Jev systemic thresholds from `system_settings`.
 */
export async function getSystemThresholds(
  db: D1DatabaseLike
): Promise<SystemSettingsMap> {
  await ensureFeedsAndFiltersTables(db);
  const res = await db
    .prepare("SELECT key, value FROM system_settings")
    .all<{ key: string; value: string }>();
  const map: Record<string, string> = {};
  for (const row of res.results || []) {
    map[row.key] = row.value;
  }

  const jevMinSystemicProb = Math.min(
    0.95,
    Math.max(0.5, parseFloat(map.jev_min_systemic_prob || "0.70") || 0.7)
  );
  const jevMinConfidence = Math.min(
    0.95,
    Math.max(0.3, parseFloat(map.jev_min_confidence || "0.50") || 0.5)
  );
  const maxNetNewPerRun = Math.min(
    50,
    Math.max(1, parseInt(map.max_net_new_per_run || "10", 10) || 10)
  );
  const defaultItemsPerPoll = Math.min(
    25,
    Math.max(1, parseInt(map.default_items_per_poll || "5", 10) || 5)
  );

  return {
    jevMinSystemicProb: Math.round(jevMinSystemicProb * 100) / 100,
    jevMinConfidence: Math.round(jevMinConfidence * 100) / 100,
    maxNetNewPerRun,
    defaultItemsPerPoll,
  };
}

/**
 * Updates global thresholds in `system_settings` and emits a `settings.threshold_update` audit entry.
 */
export async function updateSystemThresholds(
  db: D1DatabaseLike,
  input: {
    jevMinSystemicProb?: number;
    jevMinConfidence?: number;
    maxNetNewPerRun?: number;
    defaultItemsPerPoll?: number;
    reason?: string;
  },
  actor: FeedFilterAdminActor
): Promise<{ settings: SystemSettingsMap; auditEntry: AuditLedgerEntry }> {
  await ensureFeedsAndFiltersTables(db);

  const beforeSettings = await getSystemThresholds(db);
  const now = new Date().toISOString();

  if (input.jevMinSystemicProb !== undefined) {
    const val = Math.min(
      0.95,
      Math.max(0.5, Number(input.jevMinSystemicProb))
    ).toFixed(2);
    await db
      .prepare(
        "UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'jev_min_systemic_prob'"
      )
      .bind(val, now)
      .run();
  }

  if (input.jevMinConfidence !== undefined) {
    const val = Math.min(
      0.95,
      Math.max(0.3, Number(input.jevMinConfidence))
    ).toFixed(2);
    await db
      .prepare(
        "UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'jev_min_confidence'"
      )
      .bind(val, now)
      .run();
  }

  if (input.maxNetNewPerRun !== undefined) {
    const val = String(
      Math.min(50, Math.max(1, Math.round(Number(input.maxNetNewPerRun))))
    );
    await db
      .prepare(
        "UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'max_net_new_per_run'"
      )
      .bind(val, now)
      .run();
  }

  if (input.defaultItemsPerPoll !== undefined) {
    const val = String(
      Math.min(25, Math.max(1, Math.round(Number(input.defaultItemsPerPoll))))
    );
    await db
      .prepare(
        "UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'default_items_per_poll'"
      )
      .bind(val, now)
      .run();
  }

  const afterSettings = await getSystemThresholds(db);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "settings.threshold_update",
    targetType: "system_settings",
    targetId: "jev_min_systemic_prob",
    reason:
      input.reason?.trim() ||
      `Updated Jev systemic probability threshold from ${beforeSettings.jevMinSystemicProb.toFixed(
        2
      )} to ${afterSettings.jevMinSystemicProb.toFixed(2)}`,
    beforeState: {
      key: "jev_min_systemic_prob",
      value: beforeSettings.jevMinSystemicProb.toFixed(2),
      ...beforeSettings,
    },
    afterState: {
      key: "jev_min_systemic_prob",
      value: afterSettings.jevMinSystemicProb.toFixed(2),
      ...afterSettings,
    },
  });

  return { settings: afterSettings, auditEntry };
}

/**
 * Evaluates a single filter pattern (either a regular expression or comma-separated keywords)
 * against a target string. Never throws on invalid regex syntax.
 */
export function evaluateFilterPatternMatch(
  pattern: string,
  targetText: string
): { matched: boolean; matchedSnippet: string | null } {
  const trimmed = pattern.trim();
  if (!trimmed || !targetText) {
    return { matched: false, matchedSnippet: null };
  }

  // Strip optional /.../flags wrapper if provided
  let regexSource = trimmed;
  let flags = "i";
  const slashMatch = trimmed.match(/^\/([\s\S]+)\/([gimsuy]*)$/);
  if (slashMatch) {
    regexSource = slashMatch[1];
    flags = slashMatch[2].includes("i") ? slashMatch[2] : `${slashMatch[2]}i`;
  }

  const hasRegexMeta = /[\\()[\]|^$*+?{}]/.test(regexSource);
  if (!hasRegexMeta && regexSource.includes(",")) {
    const parts = regexSource
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const lowerTarget = targetText.toLowerCase();
    for (const kw of parts) {
      const idx = lowerTarget.indexOf(kw.toLowerCase());
      if (idx !== -1) {
        return {
          matched: true,
          matchedSnippet: targetText.slice(idx, idx + kw.length),
        };
      }
    }
    return { matched: false, matchedSnippet: null };
  }

  try {
    const rx = new RegExp(regexSource, flags);
    const m = rx.exec(targetText);
    if (m) {
      return {
        matched: true,
        matchedSnippet: m[0]?.slice(0, 80) || trimmed.slice(0, 40),
      };
    }
    return { matched: false, matchedSnippet: null };
  } catch {
    // Fallback to case-insensitive substring search if pattern is malformed regex
    const lowerTarget = targetText.toLowerCase();
    const idx = lowerTarget.indexOf(regexSource.toLowerCase());
    if (idx !== -1) {
      return {
        matched: true,
        matchedSnippet: targetText.slice(idx, idx + regexSource.length),
      };
    }
    return { matched: false, matchedSnippet: null };
  }
}

function getTargetTextForFilter(
  item: { title: string; rawExcerpt: string; sourceUrl: string },
  matchTarget: IngestFilterMatchTarget
): string {
  switch (matchTarget) {
    case "title":
      return item.title;
    case "excerpt":
      return item.rawExcerpt;
    case "url":
      return item.sourceUrl;
    case "title_and_excerpt":
    default:
      return `${item.title}\n${item.rawExcerpt}`;
  }
}

function normalizeWorkingToolActionValue(
  val: string | null | undefined
): JevWorkingToolKey | undefined {
  if (!val) return undefined;
  const v = val.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, JevWorkingToolKey> = {
    twenty_four_inch_gauge: "twenty_four_inch_gauge",
    "24_inch_gauge": "twenty_four_inch_gauge",
    gauge: "twenty_four_inch_gauge",
    common_gavel: "common_gavel",
    gavel: "common_gavel",
    plumb: "plumb",
    the_plumb: "plumb",
    square: "square",
    the_square: "square",
    level: "level",
    the_level: "level",
    trowel: "trowel",
    the_trowel: "trowel",
  };
  return map[v];
}

/**
 * Evaluates a set of active `IngestFilterRecord` rules against an item and returns:
 * - whether a pre-Jev drop rule triggered (`preFilterDropped`)
 * - the cumulative `systemicProbDelta` from `Boost_Systemic_Prob` rules
 * - any `forcedPrimaryTool` from `Force_Working_Tool` rules
 * - the list of `matchedFilterIds` (to increment `hit_count` in D1) and `traces`.
 */
export function evaluateFiltersOnItem(
  item: {
    title: string;
    rawExcerpt: string;
    sourceUrl: string;
    feedId?: number;
  },
  filters: IngestFilterRecord[]
): {
  preFilterDropped: boolean;
  systemicProbDelta: number;
  forcedPrimaryTool?: JevWorkingToolKey;
  matchedFilterIds: number[];
  matchedFilterNames: string[];
  traces: FilterMatchTrace[];
} {
  let preFilterDropped = false;
  let systemicProbDelta = 0;
  let forcedPrimaryTool: JevWorkingToolKey | undefined = undefined;
  const matchedFilterIds: number[] = [];
  const matchedFilterNames: string[] = [];
  const traces: FilterMatchTrace[] = [];

  const applicableFilters = filters.filter(
    (f) =>
      f.enabled &&
      (f.scopeFeedId === null ||
        f.scopeFeedId === undefined ||
        (item.feedId !== undefined && f.scopeFeedId === item.feedId))
  );

  for (const filter of applicableFilters) {
    const targetText = getTargetTextForFilter(item, filter.matchTarget);
    const { matched, matchedSnippet } = evaluateFilterPatternMatch(
      filter.pattern,
      targetText
    );

    if (filter.filterType === "Drop_Keyword_Regex") {
      if (matched) {
        preFilterDropped = true;
        if (filter.id > 0) matchedFilterIds.push(filter.id);
        matchedFilterNames.push(filter.name);
        traces.push({
          filterId: filter.id,
          filterName: filter.name,
          filterType: filter.filterType,
          matchTarget: filter.matchTarget,
          pattern: filter.pattern,
          actionValue: filter.actionValue || "drop",
          matched: true,
          matchedSnippet,
          effect: `Dropped immediately (matched "${matchedSnippet}")`,
        });
      }
    } else if (filter.filterType === "Block_Source_Pattern") {
      if (matched) {
        preFilterDropped = true;
        if (filter.id > 0) matchedFilterIds.push(filter.id);
        matchedFilterNames.push(filter.name);
        traces.push({
          filterId: filter.id,
          filterName: filter.name,
          filterType: filter.filterType,
          matchTarget: filter.matchTarget,
          pattern: filter.pattern,
          actionValue: filter.actionValue || "drop",
          matched: true,
          matchedSnippet,
          effect: `Blocked source pattern ("${matchedSnippet}")`,
        });
      }
    } else if (filter.filterType === "Require_Keyword_Regex") {
      if (!matched) {
        preFilterDropped = true;
        if (filter.id > 0) matchedFilterIds.push(filter.id);
        matchedFilterNames.push(filter.name);
        traces.push({
          filterId: filter.id,
          filterName: filter.name,
          filterType: filter.filterType,
          matchTarget: filter.matchTarget,
          pattern: filter.pattern,
          actionValue: filter.actionValue || "require",
          matched: true,
          matchedSnippet: null,
          effect: "Dropped because required pattern was not present",
        });
      }
    } else if (filter.filterType === "Boost_Systemic_Prob") {
      if (matched) {
        const delta = parseFloat(filter.actionValue || "+0.15") || 0.15;
        systemicProbDelta += delta;
        if (filter.id > 0) matchedFilterIds.push(filter.id);
        matchedFilterNames.push(filter.name);
        traces.push({
          filterId: filter.id,
          filterName: filter.name,
          filterType: filter.filterType,
          matchTarget: filter.matchTarget,
          pattern: filter.pattern,
          actionValue: filter.actionValue || "+0.15",
          matched: true,
          matchedSnippet,
          effect: `Systemic probability ${delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} (matched "${matchedSnippet}")`,
        });
      }
    } else if (filter.filterType === "Force_Working_Tool") {
      if (matched) {
        const toolKey = normalizeWorkingToolActionValue(filter.actionValue);
        if (toolKey) {
          forcedPrimaryTool = toolKey;
        }
        if (filter.id > 0) matchedFilterIds.push(filter.id);
        matchedFilterNames.push(filter.name);
        traces.push({
          filterId: filter.id,
          filterName: filter.name,
          filterType: filter.filterType,
          matchTarget: filter.matchTarget,
          pattern: filter.pattern,
          actionValue: filter.actionValue || "square",
          matched: true,
          matchedSnippet,
          effect: `Forced primary Working Tool → ${toolKey || filter.actionValue} (matched "${matchedSnippet}")`,
        });
      }
    }
  }

  return {
    preFilterDropped,
    systemicProbDelta,
    forcedPrimaryTool,
    matchedFilterIds,
    matchedFilterNames,
    traces,
  };
}

/**
 * Runs a non-destructive dry-run test of all active `ingest_filters` (plus an optional candidate rule)
 * against recent D1 `telemetry_articles` or custom sample headlines.
 */
export async function testIngestFiltersDryRun(
  db: D1DatabaseLike,
  input?: {
    candidateFilter?: {
      name?: string;
      filterType: IngestFilterType;
      matchTarget?: IngestFilterMatchTarget;
      pattern: string;
      actionValue?: string | null;
      scopeFeedId?: number | null;
    };
    customSamples?: Array<{
      title: string;
      excerpt?: string;
      sourceFeed?: string;
      sourceUrl?: string;
    }>;
    minSystemicProbOverride?: number;
    limit?: number;
  }
): Promise<FilterDryRunResult> {
  await ensureFeedsAndFiltersTables(db);
  const [activeFilters, thresholds] = await Promise.all([
    listIngestFilters(db, { enabledOnly: true }),
    getSystemThresholds(db),
  ]);

  const effectiveThreshold =
    input?.minSystemicProbOverride !== undefined
      ? Math.min(0.95, Math.max(0.5, Number(input.minSystemicProbOverride)))
      : thresholds.jevMinSystemicProb;

  const filtersToRun: IngestFilterRecord[] = [...activeFilters];
  let candidateRecord: IngestFilterRecord | null = null;
  if (input?.candidateFilter && input.candidateFilter.pattern?.trim()) {
    candidateRecord = {
      id: -1,
      name:
        input.candidateFilter.name?.trim() || "Candidate Dry-Run Rule (Preview)",
      description: "Live dry-run preview rule",
      filterType: input.candidateFilter.filterType,
      matchTarget: input.candidateFilter.matchTarget || "title_and_excerpt",
      pattern: input.candidateFilter.pattern.trim(),
      scopeFeedId: input.candidateFilter.scopeFeedId ?? null,
      actionValue:
        input.candidateFilter.actionValue ||
        (input.candidateFilter.filterType === "Boost_Systemic_Prob"
          ? "+0.15"
          : input.candidateFilter.filterType === "Force_Working_Tool"
            ? "square"
            : "drop"),
      enabled: true,
      hitCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    filtersToRun.unshift(candidateRecord);
  }

  interface SampleArticle {
    title: string;
    rawExcerpt: string;
    sourceFeed: string;
    sourceUrl: string;
    baseSystemicProb: number;
    basePrimaryTool: string;
  }

  const samples: SampleArticle[] = [];

  if (input?.customSamples && input.customSamples.length > 0) {
    for (const s of input.customSamples) {
      if (!s.title?.trim()) continue;
      const evalRes = await evaluateArticleWithJev({
        title: s.title.trim(),
        source: s.sourceFeed || "Dry-Run Sample",
        excerpt: s.excerpt?.trim() || s.title.trim(),
      });
      samples.push({
        title: s.title.trim(),
        rawExcerpt: s.excerpt?.trim() || s.title.trim(),
        sourceFeed: s.sourceFeed || "Dry-Run Sample",
        sourceUrl: s.sourceUrl || "https://thecabcall.com/dry-run-sample",
        baseSystemicProb: evalRes.isSystemicProb,
        basePrimaryTool: evalRes.primaryTool,
      });
    }
  }

  const limit = Math.min(40, Math.max(5, Number(input?.limit ?? 20)));
  if (samples.length < limit) {
    try {
      const d1Rows = await db
        .prepare(
          `SELECT title, raw_excerpt, source_feed, source_url, is_systemic_prob, primary_tool
           FROM telemetry_articles
           ORDER BY published_at DESC, id DESC
           LIMIT ?`
        )
        .bind(limit - samples.length)
        .all<{
          title: string;
          raw_excerpt: string;
          source_feed: string;
          source_url: string;
          is_systemic_prob: number;
          primary_tool: string;
        }>();

      for (const r of d1Rows.results || []) {
        samples.push({
          title: r.title,
          rawExcerpt: r.raw_excerpt || r.title,
          sourceFeed: r.source_feed,
          sourceUrl: r.source_url,
          baseSystemicProb: Number(r.is_systemic_prob || 0.75),
          basePrimaryTool: r.primary_tool || "square",
        });
      }
    } catch {
      // Fallback if telemetry_articles is empty
    }
  }

  // Always include 3 synthetic low-signal noise items so drop filters are visibly demonstrated in dry runs
  const syntheticNoiseSamples: SampleArticle[] = [
    {
      title: "NFL Playoff Picture: Quarterback Injury Reshapes Super Bowl Odds",
      rawExcerpt:
        "A fourth-quarter touchdown in Sunday's game shifted the conference bracket heading into the wildcard round.",
      sourceFeed: "NPR Top News (Synthetic Noise Control)",
      sourceUrl: "https://feeds.npr.org/sports/nfl-playoff-bracket",
      baseSystemicProb: 0.34,
      basePrimaryTool: "common_gavel",
    },
    {
      title: "Today's Wordle Hints, Connections Clues, and Best Espresso Deal Alert",
      rawExcerpt:
        "Need a hint for today's puzzle or looking for the best headphones on sale during our seasonal buying guide roundup?",
      sourceFeed: "NYT HomePage (Synthetic Noise Control)",
      sourceUrl: "https://www.nytimes.com/deals/wordle-connections-hint",
      baseSystemicProb: 0.28,
      basePrimaryTool: "twenty_four_inch_gauge",
    },
    {
      title: "FAA Inspector General Audit Finds Deferred Maintenance Before Air Traffic Outage",
      rawExcerpt:
        "Whistleblower disclosures to Senate investigators revealed staffing shortages and skipped failover drills across regional control centers.",
      sourceFeed: "PBS NewsHour Nation (Synthetic Signal Control)",
      sourceUrl: "https://www.pbs.org/newshour/nation/faa-inspector-general-audit",
      baseSystemicProb: 0.82,
      basePrimaryTool: "plumb",
    },
  ];

  for (const syn of syntheticNoiseSamples) {
    if (!samples.some((s) => s.title === syn.title)) {
      samples.push(syn);
    }
  }

  let triagedCount = 0;
  let droppedCount = 0;
  let candidateMatchCount = 0;
  const results: FilterDryRunItemResult[] = [];

  for (const sample of samples) {
    const evalTraces = evaluateFiltersOnItem(sample, filtersToRun);
    if (
      candidateRecord &&
      evalTraces.traces.some((t) => t.filterId === -1 && t.matched)
    ) {
      candidateMatchCount++;
    }

    const adjustedSystemicProb = evalTraces.preFilterDropped
      ? 0.08
      : Math.min(
          0.99,
          Math.max(
            0.01,
            Math.round(
              (sample.baseSystemicProb + evalTraces.systemicProbDelta) * 1000
            ) / 1000
          )
        );

    const finalOutcome: "triaged" | "dropped" =
      !evalTraces.preFilterDropped && adjustedSystemicProb >= effectiveThreshold
        ? "triaged"
        : "dropped";

    if (finalOutcome === "triaged") {
      triagedCount++;
    } else {
      droppedCount++;
    }

    results.push({
      title: sample.title,
      sourceFeed: sample.sourceFeed,
      sourceUrl: sample.sourceUrl,
      excerptSnippet: truncateCleanly(sample.rawExcerpt, 220),
      baseSystemicProb: sample.baseSystemicProb,
      adjustedSystemicProb,
      thresholdApplied: effectiveThreshold,
      basePrimaryTool: sample.basePrimaryTool,
      finalPrimaryTool: evalTraces.forcedPrimaryTool || sample.basePrimaryTool,
      preFilterDropped: evalTraces.preFilterDropped,
      finalOutcome,
      matchedFilters: evalTraces.traces,
    });
  }

  return {
    ok: true,
    evaluatedAt: new Date().toISOString(),
    thresholds: {
      ...thresholds,
      jevMinSystemicProb: effectiveThreshold,
    },
    totalTested: results.length,
    triagedCount,
    droppedCount,
    candidateFilterSummary: candidateRecord
      ? {
          name: candidateRecord.name,
          filterType: candidateRecord.filterType,
          matchTarget: candidateRecord.matchTarget,
          pattern: candidateRecord.pattern,
          matchCount: candidateMatchCount,
        }
      : undefined,
    results,
  };
}

/**
 * Normalizes a raw RSS `<guid>` or Atom `<id>` value for canonical hashing.
 * If the GUID is itself an HTTP(S) URL, normalizes it to strip tracking parameters.
 */
export function normalizeCanonicalGuid(
  rawGuid: string | null | undefined,
  fallbackNormalizedUrl = ""
): string {
  const cleaned = stripUnsafeHtmlAndCdata(rawGuid || "").trim();
  if (!cleaned) {
    return fallbackNormalizedUrl;
  }
  if (/^https?:\/\//i.test(cleaned)) {
    return normalizeCanonicalUrl(cleaned) || cleaned;
  }
  return cleaned.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Computes a deterministic canonical SHA-256 hex digest from the normalized article URL
 * and normalized GUID prior to processing, guaranteeing idempotent ingestion across headline edits.
 */
export async function computeCanonicalArticleHash(
  rawUrl: string,
  rawGuid?: string | null
): Promise<string> {
  const normalizedUrl = normalizeCanonicalUrl(rawUrl) || rawUrl.trim();
  const normalizedGuid = normalizeCanonicalGuid(rawGuid, normalizedUrl);
  const canonicalPayload = `${normalizedUrl}::${normalizedGuid}`;
  const data = new TextEncoder().encode(canonicalPayload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a SHA-256 hex digest of the canonical article URL (+ optional GUID) using Web Crypto.
 */
export async function computeUrlSha256(
  url: string,
  guid?: string | null
): Promise<string> {
  return computeCanonicalArticleHash(url, guid);
}

/**
 * Strips CDATA wrappers, unsafe HTML tags (script/style/iframe/object/svg), and HTML entities.
 */
export function stripHtmlAndCdata(raw: string): string {
  return stripUnsafeHtmlAndCdata(raw);
}

/**
 * Truncates text cleanly to a maximum character length (default 2,500 chars) without splitting words mid-token.
 */
export function truncateCleanly(text: string, maxChars = 2500): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxChars) {
    return cleaned;
  }
  const sliced = cleaned.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.8) {
    return sliced.slice(0, lastSpace).trim();
  }
  return sliced.trim();
}

function extractTagValue(itemXml: string, tagPattern: string): string {
  const regex = new RegExp(
    `<${tagPattern}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagPattern}>`,
    "i"
  );
  const match = itemXml.match(regex);
  return match ? match[1] : "";
}

export interface HardenedFeedFetchOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Fetches an RSS/Atom XML feed using an isolated `AbortController` timeout and enforces a strict
 * maximum response byte limit (`maxResponseBytes`, default 1 MiB) via streaming chunk inspection
 * so hung sockets or oversized XML payloads can never exhaust Worker memory.
 */
export async function fetchFeedXmlWithLimits(
  url: string,
  options?: HardenedFeedFetchOptions
): Promise<{ xml: string; status: number; byteLength: number }> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_FEED_FETCH_TIMEOUT_MS;
  const maxBytes = options?.maxResponseBytes ?? DEFAULT_MAX_FEED_RESPONSE_BYTES;
  const fetchFn = options?.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Feed fetch timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const response = await fetchFn(url, {
      headers: {
        "User-Agent":
          "TheCABCall-Telemetry/1.0 (+https://thecabcall.com; system-incident-collector)",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentLengthHeader = response.headers?.get?.("content-length");
    if (contentLengthHeader) {
      const declaredBytes = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
        controller.abort();
        throw new Error(
          `Feed Content-Length (${declaredBytes} bytes) exceeds maximum limit of ${maxBytes} bytes`
        );
      }
    }

    if (!response.body || typeof response.body.getReader !== "function") {
      const text = await response.text();
      const byteLength = new TextEncoder().encode(text).byteLength;
      if (byteLength > maxBytes) {
        throw new Error(
          `Feed payload (${byteLength} bytes) exceeds maximum limit of ${maxBytes} bytes`
        );
      }
      return { xml: text, status: response.status, byteLength };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel("Response exceeded maxResponseBytes").catch(() => {});
          controller.abort();
          throw new Error(
            `Feed stream exceeded maximum limit of ${maxBytes} bytes`
          );
        }
        chunks.push(value);
      }
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const xml = new TextDecoder("utf-8", { fatal: false }).decode(combined);
    return { xml, status: response.status, byteLength: totalBytes };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses an RSS 2.0 (`<item>`) or Atom 1.0 (`<entry>`) XML payload and extracts up to `maxItems` (default 5) items.
 * Strips all unsafe HTML, CDATA wrappers, and URL tracking parameters during initial normalization,
 * and computes deterministic canonical SHA-256 hashes (normalized URL + GUID) prior to processing.
 */
export async function parseRssFeedItems(
  xml: string,
  sourceFeed: string,
  maxItems = 5,
  feedId?: number
): Promise<ParsedRssItem[]> {
  if (!xml || typeof xml !== "string") {
    return [];
  }

  const items: ParsedRssItem[] = [];
  const blockRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1];
    const rawTitle = extractTagValue(block, "title");
    const rawGuid =
      extractTagValue(block, "guid") || extractTagValue(block, "id");
    let rawLink = extractTagValue(block, "link");
    if (!rawLink) {
      // Atom <link href="..." rel="alternate" /> or <link href="..." />
      const atomLinkMatch =
        block.match(
          /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i
        ) || block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
      if (atomLinkMatch?.[1]) {
        rawLink = atomLinkMatch[1];
      }
    }
    if (!rawLink && rawGuid && /https?:\/\//i.test(rawGuid)) {
      rawLink = rawGuid;
    }

    const rawDesc =
      extractTagValue(block, "description") || extractTagValue(block, "summary");
    const rawContentEncoded =
      extractTagValue(block, "content:encoded") ||
      extractTagValue(block, "content");
    const rawPubDate =
      extractTagValue(block, "pubDate") ||
      extractTagValue(block, "dc:date") ||
      extractTagValue(block, "published") ||
      extractTagValue(block, "updated");

    const title = stripHtmlAndCdata(rawTitle);
    const cleanedLink = stripHtmlAndCdata(rawLink);
    const sourceUrl = normalizeCanonicalUrl(cleanedLink);
    if (!title || !sourceUrl) {
      continue;
    }

    const guid = normalizeCanonicalGuid(rawGuid, sourceUrl);
    const urlHash = await computeCanonicalArticleHash(sourceUrl, guid);

    const cleanedDesc = stripHtmlAndCdata(rawDesc);
    const cleanedContent = stripHtmlAndCdata(rawContentEncoded);

    // Combine or prefer whichever payload gives richer multi-paragraph context
    let combinedBody = cleanedDesc;
    if (cleanedContent.length > cleanedDesc.length) {
      combinedBody =
        cleanedDesc && !cleanedContent.startsWith(cleanedDesc.slice(0, 40))
          ? `${cleanedDesc}\n\n${cleanedContent}`
          : cleanedContent;
    }

    const validation = validateAndNormalizeIncidentSummary({
      title,
      sourceFeed,
      rawExcerpt: combinedBody,
      logWarnings: true,
    });
    if (!validation.valid) {
      continue;
    }

    const rawExcerpt = truncateCleanly(validation.cleanedDescription, 2500);

    let publishedAt = new Date().toISOString();
    if (rawPubDate) {
      const parsedDate = new Date(stripHtmlAndCdata(rawPubDate));
      if (!Number.isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    items.push({
      urlHash,
      guid,
      sourceFeed,
      feedId,
      title,
      sourceUrl,
      rawExcerpt,
      publishedAt,
    });
  }

  return items;
}

/**
 * Fetches and parses any candidate RSS 2.0 or Atom 1.0 URL live and returns a 5-item preview
 * for the `/admin/feeds` "Test RSS URL" studio feature.
 */
export async function testCandidateRssFeed(
  candidateUrl: string,
  maxItems = 5,
  fetchOptions?: HardenedFeedFetchOptions
): Promise<FeedTestPreviewResult> {
  const startedMs = Date.now();
  const cleanUrl = candidateUrl.trim();
  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    return {
      ok: false,
      url: cleanUrl,
      latencyMs: 0,
      itemCount: 0,
      items: [],
      error: "URL must start with http:// or https://",
    };
  }

  try {
    const { xml, status } = await fetchFeedXmlWithLimits(cleanUrl, fetchOptions);
    const latencyMs = Date.now() - startedMs;

    const channelTitleMatch = xml.match(
      /<(?:channel|feed)[\s>][\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i
    );
    const feedTitle = channelTitleMatch
      ? stripHtmlAndCdata(channelTitleMatch[1])
      : cleanUrl;

    const feedFormat: "rss2" | "atom" | "rdf" | "unknown" = /<feed[\s>]/i.test(
      xml
    )
      ? "atom"
      : /<rss[\s>]/i.test(xml)
        ? "rss2"
        : /<rdf:RDF/i.test(xml)
          ? "rdf"
          : "unknown";

    const items = await parseRssFeedItems(
      xml,
      feedTitle || "Preview Feed",
      Math.min(10, Math.max(1, maxItems))
    );

    if (items.length === 0) {
      return {
        ok: false,
        url: cleanUrl,
        feedTitle,
        feedFormat,
        httpStatus: status,
        latencyMs,
        itemCount: 0,
        items: [],
        error:
          "Connected successfully, but no valid RSS <item> or Atom <entry> elements were found in the response.",
      };
    }

    return {
      ok: true,
      url: cleanUrl,
      feedTitle,
      feedFormat,
      httpStatus: status,
      latencyMs,
      itemCount: items.length,
      items,
    };
  } catch (err) {
    return {
      ok: false,
      url: cleanUrl,
      latencyMs: Date.now() - startedMs,
      itemCount: 0,
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Concurrently polls all active feeds in D1 `ingest_feeds` (`WHERE enabled = 1`, falling back to
 * `US_HIGH_IMPACT_FEEDS`) using isolated timeout controllers and strict response byte limits.
 * Updates `last_polled_at`, `last_status`, and `last_error` in a single parameterized `db.batch()`.
 */
export async function collectLatestUsRssItems(
  itemsPerFeed = 5,
  db?: D1DatabaseLike,
  fetchOptions?: HardenedFeedFetchOptions & { feedsOverride?: FeedConfig[] }
): Promise<{
  items: ParsedRssItem[];
  feedsPolled: number;
  feedErrors: { feed: string; error: string }[];
}> {
  let activeFeeds: FeedConfig[] = fetchOptions?.feedsOverride ?? US_HIGH_IMPACT_FEEDS;

  if (!fetchOptions?.feedsOverride && db) {
    try {
      const dbFeeds = await listIngestFeeds(db, { enabledOnly: true });
      if (dbFeeds.length > 0) {
        activeFeeds = dbFeeds.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          focusArea: f.focusArea,
          domainSectorOverride: f.domainSectorOverride,
          itemsPerPoll: f.itemsPerPoll || itemsPerFeed,
        }));
      }
    } catch {
      activeFeeds = US_HIGH_IMPACT_FEEDS;
    }
  }

  const allItems: ParsedRssItem[] = [];
  const feedErrors: { feed: string; error: string }[] = [];
  const feedStatusStatements: D1PreparedStatementLike[] = [];

  const settled = await Promise.allSettled(
    activeFeeds.map(async (feed) => {
      const polledAt = new Date().toISOString();
      const pollLimit = feed.itemsPerPoll || itemsPerFeed;
      try {
        const { xml } = await fetchFeedXmlWithLimits(feed.url, fetchOptions);
        const parsed = await parseRssFeedItems(
          xml,
          feed.name,
          pollLimit,
          feed.id
        );
        return {
          ok: true as const,
          feed,
          polledAt,
          items: parsed,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          ok: false as const,
          feed,
          polledAt,
          error: errMsg,
        };
      }
    })
  );

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      feedErrors.push({
        feed: "Unknown Feed",
        error:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
      });
      continue;
    }

    const res = outcome.value;
    if (res.ok) {
      allItems.push(...res.items);
      if (db && res.feed.id) {
        feedStatusStatements.push(
          db
            .prepare(
              "UPDATE ingest_feeds SET last_polled_at = ?, last_status = 'nominal', last_error = NULL, updated_at = ? WHERE id = ?"
            )
            .bind(res.polledAt, res.polledAt, res.feed.id)
        );
      }
    } else {
      feedErrors.push({
        feed: res.feed.name,
        error: res.error,
      });
      if (db && res.feed.id) {
        feedStatusStatements.push(
          db
            .prepare(
              "UPDATE ingest_feeds SET last_polled_at = ?, last_status = 'error', last_error = ?, updated_at = ? WHERE id = ?"
            )
            .bind(res.polledAt, res.error, res.polledAt, res.feed.id)
        );
      }
    }
  }

  if (db && feedStatusStatements.length > 0) {
    await executeD1Batch(db, feedStatusStatements).catch(() => {});
  }

  return {
    items: allItems,
    feedsPolled: activeFeeds.length,
    feedErrors,
  };
}

/**
 * Runs one full pass of the hardened RSS ingestion & `jev-1.14.0` classification pipeline:
 * 1. Polls all active feeds concurrently with isolated timeouts & byte limits.
 * 2. Decouples raw feed ingestion from Jev classification by batch-inserting raw normalized items
 *    into `telemetry_articles` with `ON CONFLICT(url_hash) DO NOTHING` and initial status `'PENDING_RETRY'`.
 * 3. Evaluates `jev-1.14.0` classification with strict runtime boundary validation:
 *    - Transient Jev API failures leave the record in `'PENDING_RETRY'` (never dropping ingested records).
 *    - Malformed or low-confidence Jev outputs transition the record to `'QUARANTINED'`.
 *    - Valid high-signal records transition to `'triaged'`.
 * 4. Persists all classification updates and counter increments via parameterized `db.batch()`.
 */
export async function runD1IngestPipeline(options: {
  db: D1DatabaseLike;
  typesafeApiKey?: string;
  maxNetNew?: number;
  itemsPerFeed?: number;
  fetchOptions?: HardenedFeedFetchOptions & { feedsOverride?: FeedConfig[] };
  jevOptions?: Partial<JevEvaluationOptions>;
  customArticle?: {
    title: string;
    description: string;
    sourceFeed: string;
    link?: string;
    guid?: string;
  };
}): Promise<IngestRunSummary> {
  const startedAt = new Date().toISOString();

  await ensureFeedsAndFiltersTables(options.db);
  const [thresholds, activeFilters] = await Promise.all([
    getSystemThresholds(options.db),
    listIngestFilters(options.db, { enabledOnly: true }),
  ]);

  const maxNetNew = options.maxNetNew ?? thresholds.maxNetNewPerRun ?? 10;
  const itemsPerFeed =
    options.itemsPerFeed ?? thresholds.defaultItemsPerPoll ?? 5;

  let items: ParsedRssItem[] = [];
  let feedsPolled = 1;
  let feedErrors: { feed: string; error: string }[] = [];

  if (options.customArticle) {
    const rawUrl =
      options.customArticle.link?.trim() ||
      `https://thecabcall.com/live-sim/${Date.now()}`;
    const sourceUrl = normalizeCanonicalUrl(rawUrl) || rawUrl;
    const guid = normalizeCanonicalGuid(options.customArticle.guid, sourceUrl);
    const urlHash = await computeCanonicalArticleHash(sourceUrl, guid);
    const customTitle = stripHtmlAndCdata(options.customArticle.title.trim());
    const customFeed =
      stripHtmlAndCdata(options.customArticle.sourceFeed?.trim() || "") ||
      "LIVE TELEMETRY SANDBOX";
    const validation = validateAndNormalizeIncidentSummary({
      title: customTitle,
      sourceFeed: customFeed,
      rawExcerpt: options.customArticle.description?.trim() || "",
      logWarnings: true,
    });
    if (validation.valid) {
      items = [
        {
          urlHash,
          guid,
          sourceFeed: customFeed,
          title: customTitle,
          sourceUrl,
          rawExcerpt: truncateCleanly(validation.cleanedDescription, 2500),
          publishedAt: new Date().toISOString(),
        },
      ];
    }
  } else {
    const collected = await collectLatestUsRssItems(
      itemsPerFeed,
      options.db,
      options.fetchOptions
    );
    items = collected.items;
    feedsPolled = collected.feedsPolled;
    feedErrors = collected.feedErrors;
  }

  let skippedDuplicates = 0;
  let triagedCount = 0;
  let quarantinedCount = 0;
  let pendingRetryCount = 0;
  let droppedCount = 0;
  let preFilterDroppedCount = 0;
  let totalJevLatencyMs = 0;
  const processedArticles: IngestedArticleSummary[] = [];
  const seenHashesInBatch = new Set<string>();
  const feedIngestedCounter = new Map<number, number>();
  const filterHitCounter = new Map<number, number>();

  // Deduplicate within batch and check existing records in D1
  const candidateItems: ParsedRssItem[] = [];
  for (const item of items) {
    if (candidateItems.length >= maxNetNew) {
      break;
    }
    if (seenHashesInBatch.has(item.urlHash)) {
      skippedDuplicates++;
      continue;
    }
    seenHashesInBatch.add(item.urlHash);

    const existing = await options.db
      .prepare(
        "SELECT id, url_hash, status FROM telemetry_articles WHERE url_hash = ?"
      )
      .bind(item.urlHash)
      .first<{ id: number; url_hash: string; status: string }>();

    if (existing && existing.status !== "PENDING_RETRY" && !options.customArticle) {
      skippedDuplicates++;
      continue;
    }

    candidateItems.push(item);
  }

  // Phase 1: Decoupled Raw Ingestion Persistence via parameterized db.batch()
  // Persist raw feed records with status = 'PENDING_RETRY' and ON CONFLICT(url_hash) DO NOTHING
  // BEFORE calling jev-1.14.0 so transient classification failures never drop ingested feed records.
  if (candidateItems.length > 0) {
    const rawInsertStatements = candidateItems.map((item) =>
      options.db
        .prepare(
          `INSERT INTO telemetry_articles (
            url_hash,
            source_feed,
            title,
            source_url,
            raw_excerpt,
            published_at,
            is_systemic_prob,
            jev_confidence,
            primary_tool,
            secondary_tool,
            sre_failure_mode,
            jev_raw_json,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'square', 'twenty_four_inch_gauge', 'configuration_drift', '{}', 'PENDING_RETRY')
          ON CONFLICT(url_hash) DO NOTHING`
        )
        .bind(
          item.urlHash,
          item.sourceFeed,
          item.title,
          item.sourceUrl,
          item.rawExcerpt,
          item.publishedAt
        )
    );
    await executeD1Batch(options.db, rawInsertStatements);
  }

  // Phase 2: Jev-1.14.0 Classification & Strict Runtime Boundary Validation
  const classificationStatements: D1PreparedStatementLike[] = [];

  for (const item of candidateItems) {
    if (item.feedId) {
      feedIngestedCounter.set(
        item.feedId,
        (feedIngestedCounter.get(item.feedId) || 0) + 1
      );
    }

    const filterEval = evaluateFiltersOnItem(item, activeFilters);
    for (const fId of filterEval.matchedFilterIds) {
      filterHitCounter.set(fId, (filterHitCounter.get(fId) || 0) + 1);
    }

    const evalStartMs = Date.now();
    let jevResult: JevEvaluationResult | null = null;
    let transientError: string | null = null;

    if (filterEval.preFilterDropped && !options.customArticle) {
      preFilterDroppedCount++;
      jevResult = buildDroppedByFilterJevResult(
        {
          title: item.title,
          source: item.sourceFeed,
          excerpt: item.rawExcerpt,
        },
        filterEval.matchedFilterNames
      );
      totalJevLatencyMs += Math.max(12, Date.now() - evalStartMs);
    } else {
      try {
        jevResult = await evaluateArticleWithJev(
          {
            title: item.title,
            source: item.sourceFeed,
            excerpt: item.rawExcerpt,
          },
          options.typesafeApiKey,
          {
            minSystemicProb: thresholds.jevMinSystemicProb,
            minConfidence: thresholds.jevMinConfidence,
            systemicProbDelta: filterEval.systemicProbDelta,
            forcedPrimaryTool: filterEval.forcedPrimaryTool,
            appliedFilterNames: filterEval.matchedFilterNames,
            ...options.jevOptions,
          }
        );
        totalJevLatencyMs += Math.max(85, Date.now() - evalStartMs);
      } catch (err) {
        // Transient Jev failure: do NOT drop the ingested record; keep it in PENDING_RETRY
        transientError = err instanceof Error ? err.message : String(err);
        totalJevLatencyMs += Math.max(25, Date.now() - evalStartMs);
      }
    }

    if (transientError || !jevResult) {
      pendingRetryCount++;
      const retryRawJson = JSON.stringify({
        status: "PENDING_RETRY",
        error: transientError || "Unknown transient Jev classification error",
        timestamp: new Date().toISOString(),
      });
      classificationStatements.push(
        options.db
          .prepare(
            `UPDATE telemetry_articles
             SET status = 'PENDING_RETRY',
                 jev_raw_json = ?
             WHERE url_hash = ?`
          )
          .bind(retryRawJson, item.urlHash)
      );

      processedArticles.push({
        url_hash: item.urlHash,
        guid: item.guid,
        source_feed: item.sourceFeed,
        title: item.title,
        source_url: item.sourceUrl,
        published_at: item.publishedAt,
        is_systemic_prob: 0,
        jev_confidence: 0,
        primary_tool: "square",
        secondary_tool: "twenty_four_inch_gauge",
        sre_failure_mode: "configuration_drift",
        status: "PENDING_RETRY",
        quarantine_reason: transientError || undefined,
      });
      continue;
    }

    // Enforce strict runtime boundary validation on jevResult
    const boundaryCheck = validateJevEvaluationOutput(jevResult, {
      minSystemicProb: thresholds.jevMinSystemicProb,
      minConfidence: thresholds.jevMinConfidence,
    });

    let finalStatus: ArticleIngestionStatus;
    if (!boundaryCheck.valid || boundaryCheck.quarantined || jevResult.status !== "triaged") {
      finalStatus = "QUARANTINED";
      quarantinedCount++;
      droppedCount++;
    } else {
      finalStatus = "triaged";
      triagedCount++;
    }

    classificationStatements.push(
      options.db
        .prepare(
          `UPDATE telemetry_articles
           SET is_systemic_prob = ?,
               jev_confidence = ?,
               primary_tool = ?,
               secondary_tool = ?,
               sre_failure_mode = ?,
               jev_raw_json = ?,
               status = ?
           WHERE url_hash = ?`
        )
        .bind(
          jevResult.isSystemicProb,
          jevResult.jevConfidence,
          jevResult.primaryTool,
          jevResult.secondaryTool,
          jevResult.sreFailureMode,
          jevResult.rawJson,
          finalStatus,
          item.urlHash
        )
    );

    processedArticles.push({
      url_hash: item.urlHash,
      guid: item.guid,
      source_feed: item.sourceFeed,
      title: item.title,
      source_url: item.sourceUrl,
      published_at: item.publishedAt,
      is_systemic_prob: jevResult.isSystemicProb,
      jev_confidence: jevResult.jevConfidence,
      primary_tool: jevResult.primaryTool,
      secondary_tool: jevResult.secondaryTool,
      sre_failure_mode: jevResult.sreFailureMode,
      status: finalStatus,
      quarantine_reason: boundaryCheck.reason || jevResult.quarantineReason,
      matched_filters:
        filterEval.matchedFilterNames.length > 0
          ? filterEval.matchedFilterNames
          : undefined,
    });
  }

  for (const [filterId, delta] of filterHitCounter.entries()) {
    classificationStatements.push(
      options.db
        .prepare(
          "UPDATE ingest_filters SET hit_count = hit_count + ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(delta, filterId)
    );
  }

  for (const [feedId, delta] of feedIngestedCounter.entries()) {
    classificationStatements.push(
      options.db
        .prepare(
          "UPDATE ingest_feeds SET total_ingested = total_ingested + ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(delta, feedId)
    );
  }

  if (classificationStatements.length > 0) {
    await executeD1Batch(options.db, classificationStatements);
  }

  if (processedArticles.length > 0) {
    const hashes = processedArticles.map((a) => a.url_hash);
    const placeholders = hashes.map(() => "?").join(", ");
    const idRows = await options.db
      .prepare(
        `SELECT id, url_hash FROM telemetry_articles WHERE url_hash IN (${placeholders})`
      )
      .bind(...hashes)
      .all<{ id: number; url_hash: string }>();
    const hashToId = new Map<string, number>();
    for (const r of idRows.results || []) {
      hashToId.set(r.url_hash, r.id);
    }
    for (const art of processedArticles) {
      const id = hashToId.get(art.url_hash);
      if (typeof id === "number") {
        art.id = id;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const avgLatencyMs =
    processedArticles.length > 0
      ? Math.round(totalJevLatencyMs / processedArticles.length)
      : 118;

  const notes = options.customArticle
    ? `Sandbox triage on "${options.customArticle.title.slice(0, 60)}": ${processedArticles[0]?.status || "QUARANTINED"}.`
    : processedArticles.length > 0
      ? `Ingested ${processedArticles.length} net-new dispatches across ${feedsPolled} active feeds: ${triagedCount} triaged, ${quarantinedCount} quarantined, ${pendingRetryCount} pending retry (${skippedDuplicates} duplicates skipped).`
      : `Polled ${feedsPolled} active RSS feeds (${items.length} items); all ${skippedDuplicates} items matched existing canonical hashes (0 net-new).`;

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
        "rss_ingest",
        startedAt,
        completedAt,
        processedArticles.length > 0 ? processedArticles.length : items.length,
        triagedCount,
        quarantinedCount,
        avgLatencyMs,
        feedErrors.length === feedsPolled && feedsPolled > 0
          ? "degraded"
          : "nominal",
        notes
      )
      .run();
  } catch (err) {
    console.warn("[Ingest Pipeline] Failed to log pipeline_runs row:", err);
  }

  return {
    startedAt,
    completedAt,
    feedsPolled,
    itemsFetched: items.length,
    skippedDuplicates,
    ingestedCount: processedArticles.length,
    triagedCount,
    quarantinedCount,
    pendingRetryCount,
    droppedCount,
    preFilterDroppedCount,
    avgLatencyMs,
    thresholdsUsed: thresholds,
    articles: processedArticles,
    feedErrors: feedErrors.length > 0 ? feedErrors : undefined,
  };
}

