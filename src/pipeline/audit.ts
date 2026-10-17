import { D1DatabaseLike } from "./ingest";

export type AuditAuthMethod =
  | "google_oauth"
  | "magic_link"
  | "admin_secret"
  | "system_bootstrap";

export type AuditActionType =
  | "system.bootstrap"
  | "user.invite"
  | "user.revoke"
  | "user.role_change"
  | "user.update"
  | "auth.unauthorized_attempt"
  | "episode.generate"
  | "episode.delete"
  | "episode.update"
  | "feed.create"
  | "feed.update"
  | "feed.delete"
  | "filter.create"
  | "filter.update"
  | "filter.delete"
  | "incident.rewrite_title"
  | "incident.attach_image"
  | "incident.override_brief"
  | "incident.status_change"
  | "outbound_feed.update"
  | "pipeline_transform.update"
  | "audit.replay"
  | string;

export type AuditTargetType =
  | "audit_ledger"
  | "user"
  | "episode"
  | "ingest_feed"
  | "ingest_filter"
  | "incident_article"
  | "outbound_feed"
  | "pipeline_transform"
  | "system_settings"
  | string;

export interface AuditLedgerRow {
  id: number;
  event_id: string;
  timestamp: string;
  actor_email: string;
  actor_role: string;
  auth_method: AuditAuthMethod;
  actor_ip_hash: string | null;
  action_type: AuditActionType;
  target_type: AuditTargetType;
  target_id: string;
  reason: string;
  before_state_json: string | null;
  after_state_json: string | null;
  replay_command_json: string;
  prev_hash: string;
  entry_hash: string;
}

export interface AuditLedgerEntry {
  id: number;
  eventId: string;
  timestamp: string;
  actorEmail: string;
  actorRole: string;
  authMethod: AuditAuthMethod;
  actorIpHash: string | null;
  actionType: AuditActionType;
  targetType: AuditTargetType;
  targetId: string;
  reason: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  beforeStateJson: string | null;
  afterStateJson: string | null;
  replayCommand: Record<string, unknown>;
  replayCommandJson: string;
  prevHash: string;
  entryHash: string;
}

export interface AppendAuditEntryInput {
  eventId?: string;
  timestamp?: string;
  actorEmail: string;
  actorRole?: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
  actionType: AuditActionType;
  targetType: AuditTargetType;
  targetId: string | number;
  reason?: string;
  beforeState?: unknown | null;
  afterState?: unknown | null;
  replayCommand?: Record<string, unknown>;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  genesisHash: string | null;
  headHash: string;
  headTimestamp: string | null;
  brokenAtId?: number;
  brokenAtEventId?: string;
  expectedHash?: string;
  actualHash?: string;
  error?: string;
  verifiedAt: string;
}

export interface AuditQueryFilters {
  actionType?: string;
  targetType?: string;
  targetId?: string;
  actorEmail?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditReplayActor {
  actorEmail: string;
  actorRole?: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
  reason?: string;
}

export interface AuditReplayResult {
  ok: boolean;
  replayedEventId: string;
  mode: "revert_to_before" | "reapply_after";
  targetType: AuditTargetType;
  targetId: string;
  appliedOperation: "insert" | "update" | "delete" | "noop";
  restoredState: Record<string, unknown> | null;
  auditEntry: AuditLedgerEntry;
}

export interface AuditDisclosureBundle {
  schemaVersion: "cabcall-disclosure-v1";
  generatedAt: string;
  site: "https://thecabcall.com";
  chainIntegrity: AuditChainVerificationResult;
  filtersApplied: AuditQueryFilters;
  entryCount: number;
  bundleSignatureHash: string;
  entries: AuditLedgerEntry[];
  markdownReport: string;
}

/**
 * Generates a RFC 4122 v4 UUID using Web Crypto.
 */
export function generateAuditUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

/**
 * Computes SHA-256 hex digest using Web Crypto (`crypto.subtle`).
 */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes an anonymized SHA-256 prefix hash of a client IP address for audit attribution
 * without storing raw PII IP addresses.
 */
export async function hashActorIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip || !ip.trim()) return null;
  const full = await sha256Hex(`cabcall-ip-salt:${ip.trim()}`);
  return `ip_${full.slice(0, 16)}`;
}

/**
 * Canonical string representation for computing `entry_hash`:
 * `prev_hash | timestamp | actor_email | action_type | target_type | target_id | reason | before_state_json | after_state_json`
 */
export function buildCanonicalAuditPayload(fields: {
  prev_hash: string;
  timestamp: string;
  actor_email: string;
  action_type: string;
  target_type: string;
  target_id: string;
  reason: string;
  before_state_json: string | null;
  after_state_json: string | null;
}): string {
  return [
    fields.prev_hash,
    fields.timestamp,
    fields.actor_email,
    fields.action_type,
    fields.target_type,
    fields.target_id,
    fields.reason ?? "",
    fields.before_state_json ?? "null",
    fields.after_state_json ?? "null",
  ].join("|");
}

export async function computeAuditEntryHash(fields: {
  prev_hash: string;
  timestamp: string;
  actor_email: string;
  action_type: string;
  target_type: string;
  target_id: string;
  reason: string;
  before_state_json: string | null;
  after_state_json: string | null;
}): Promise<string> {
  const payload = buildCanonicalAuditPayload(fields);
  return sha256Hex(payload);
}

function serializeAuditState(state: unknown | null | undefined): string | null {
  if (state === undefined || state === null) {
    return null;
  }
  if (typeof state === "string") {
    const trimmed = state.trim();
    if (!trimmed) return null;
    try {
      // Normalize if valid JSON
      return JSON.stringify(JSON.parse(trimmed));
    } catch {
      return JSON.stringify({ value: state });
    }
  }
  return JSON.stringify(state);
}

function safeParseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

export function mapAuditRowToEntry(row: AuditLedgerRow): AuditLedgerEntry {
  return {
    id: Number(row.id),
    eventId: row.event_id,
    timestamp: row.timestamp,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    authMethod: row.auth_method,
    actorIpHash: row.actor_ip_hash,
    actionType: row.action_type,
    targetType: row.target_type,
    targetId: String(row.target_id),
    reason: row.reason || "",
    beforeState: safeParseJsonObject(row.before_state_json),
    afterState: safeParseJsonObject(row.after_state_json),
    beforeStateJson: row.before_state_json,
    afterStateJson: row.after_state_json,
    replayCommand: safeParseJsonObject(row.replay_command_json) || { op: "noop" },
    replayCommandJson: row.replay_command_json,
    prevHash: row.prev_hash,
    entryHash: row.entry_hash,
  };
}

/**
 * Ensures the `audit_ledger` table, immutability triggers, and GENESIS row exist.
 */
export async function ensureGenesisAuditRow(db: D1DatabaseLike): Promise<void> {
  let cnt = 0;
  try {
    const countRow = await db
      .prepare("SELECT COUNT(*) as cnt FROM audit_ledger")
      .first<{ cnt: number }>();
    cnt = Number(countRow?.cnt ?? 0);
  } catch {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS audit_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE,
          timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          actor_email TEXT NOT NULL,
          actor_role TEXT NOT NULL DEFAULT 'owner',
          auth_method TEXT NOT NULL,
          actor_ip_hash TEXT,
          action_type TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          reason TEXT NOT NULL DEFAULT '',
          before_state_json TEXT,
          after_state_json TEXT,
          replay_command_json TEXT NOT NULL,
          prev_hash TEXT NOT NULL,
          entry_hash TEXT NOT NULL UNIQUE
        )`
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_audit_ledger_timestamp ON audit_ledger(timestamp DESC, id DESC)"
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_audit_ledger_target ON audit_ledger(target_type, target_id)"
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_audit_ledger_action ON audit_ledger(action_type)"
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_audit_ledger_actor ON audit_ledger(actor_email)"
      )
      .run();
    await db
      .prepare(
        `CREATE TRIGGER IF NOT EXISTS trg_audit_ledger_no_update
         BEFORE UPDATE ON audit_ledger
         BEGIN
           SELECT RAISE(ABORT, 'Immutable audit_ledger cannot be updated');
         END`
      )
      .run();
    await db
      .prepare(
        `CREATE TRIGGER IF NOT EXISTS trg_audit_ledger_no_delete
         BEFORE DELETE ON audit_ledger
         BEGIN
           SELECT RAISE(ABORT, 'Immutable audit_ledger cannot be deleted');
         END`
      )
      .run();
    cnt = 0;
  }

  if (cnt > 0) return;

  const afterStateJson = JSON.stringify({
    ledger: "audit_ledger",
    hash_algorithm: "SHA-256",
    immutability_triggers: [
      "trg_audit_ledger_no_update",
      "trg_audit_ledger_no_delete",
    ],
    status: "active",
  });
  const replayCommandJson = JSON.stringify({
    op: "noop",
    target_table: "audit_ledger",
    target_id: "cabcall-db",
    note: "Genesis ledger initialization cannot be reverted",
  });
  const timestamp = "2026-10-17T00:00:00.000Z";
  const reason =
    "Initialized immutable SHA-256 hash-chained audit ledger with BEFORE UPDATE and BEFORE DELETE triggers.";
  const entryHash = await computeAuditEntryHash({
    prev_hash: "GENESIS",
    timestamp,
    actor_email: "system@thecabcall.com",
    action_type: "system.bootstrap",
    target_type: "audit_ledger",
    target_id: "cabcall-db",
    reason,
    before_state_json: null,
    after_state_json: afterStateJson,
  });

  await db
    .prepare(
      `INSERT INTO audit_ledger (
        event_id,
        timestamp,
        actor_email,
        actor_role,
        auth_method,
        actor_ip_hash,
        action_type,
        target_type,
        target_id,
        reason,
        before_state_json,
        after_state_json,
        replay_command_json,
        prev_hash,
        entry_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      "00000000-0000-4000-8000-000000000001",
      timestamp,
      "system@thecabcall.com",
      "owner",
      "system_bootstrap",
      "GENESIS",
      "system.bootstrap",
      "audit_ledger",
      "cabcall-db",
      reason,
      null,
      afterStateJson,
      replayCommandJson,
      "GENESIS",
      entryHash
    )
    .run();
}

/**
 * Appends a new cryptographically hash-chained entry to `audit_ledger`.
 */
export async function appendAuditEntry(
  db: D1DatabaseLike,
  input: AppendAuditEntryInput
): Promise<AuditLedgerEntry> {
  await ensureGenesisAuditRow(db);

  const headRow = await db
    .prepare("SELECT entry_hash FROM audit_ledger ORDER BY id DESC LIMIT 1")
    .first<{ entry_hash: string }>();

  const prevHash = headRow?.entry_hash || "GENESIS";
  const eventId = input.eventId || generateAuditUuid();
  const timestamp = input.timestamp || new Date().toISOString();
  const actorEmail = (input.actorEmail || "system@thecabcall.com").trim().toLowerCase();
  const actorRole = (input.actorRole || "owner").trim().toLowerCase();
  const authMethod = input.authMethod || "admin_secret";
  const actorIpHash = input.actorIpHash ?? null;
  const actionType = input.actionType;
  const targetType = input.targetType;
  const targetId = String(input.targetId);
  const reason = (input.reason || "").trim();

  const beforeStateJson = serializeAuditState(input.beforeState);
  const afterStateJson = serializeAuditState(input.afterState);

  const defaultReplayCommand = {
    op:
      beforeStateJson === null && afterStateJson !== null
        ? "create"
        : beforeStateJson !== null && afterStateJson === null
        ? "delete"
        : "update",
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    invertible: true,
  };

  const replayCommandJson = JSON.stringify(
    input.replayCommand || defaultReplayCommand
  );

  const entryHash = await computeAuditEntryHash({
    prev_hash: prevHash,
    timestamp,
    actor_email: actorEmail,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    reason,
    before_state_json: beforeStateJson,
    after_state_json: afterStateJson,
  });

  await db
    .prepare(
      `INSERT INTO audit_ledger (
        event_id,
        timestamp,
        actor_email,
        actor_role,
        auth_method,
        actor_ip_hash,
        action_type,
        target_type,
        target_id,
        reason,
        before_state_json,
        after_state_json,
        replay_command_json,
        prev_hash,
        entry_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      eventId,
      timestamp,
      actorEmail,
      actorRole,
      authMethod,
      actorIpHash,
      actionType,
      targetType,
      targetId,
      reason,
      beforeStateJson,
      afterStateJson,
      replayCommandJson,
      prevHash,
      entryHash
    )
    .run();

  const inserted = await db
    .prepare("SELECT * FROM audit_ledger WHERE event_id = ?")
    .bind(eventId)
    .first<AuditLedgerRow>();

  if (!inserted) {
    throw new Error(`Failed to read back inserted audit_ledger row for ${eventId}`);
  }

  return mapAuditRowToEntry(inserted);
}

/**
 * Walks every row in `audit_ledger` from `GENESIS` to head, recomputes each SHA-256 digest,
 * and verifies that no entry or `prev_hash` link has been tampered with.
 */
export async function verifyAuditChainIntegrity(
  db: D1DatabaseLike
): Promise<AuditChainVerificationResult> {
  await ensureGenesisAuditRow(db);

  const allRes = await db
    .prepare("SELECT * FROM audit_ledger ORDER BY id ASC")
    .all<AuditLedgerRow>();
  const rows = allRes.results || [];
  const verifiedAt = new Date().toISOString();

  if (rows.length === 0) {
    return {
      valid: true,
      totalEntries: 0,
      genesisHash: null,
      headHash: "GENESIS",
      headTimestamp: null,
      verifiedAt,
    };
  }

  let expectedPrevHash = "GENESIS";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: rows.length,
        genesisHash: rows[0].entry_hash,
        headHash: rows[rows.length - 1].entry_hash,
        headTimestamp: rows[rows.length - 1].timestamp,
        brokenAtId: row.id,
        brokenAtEventId: row.event_id,
        expectedHash: expectedPrevHash,
        actualHash: row.prev_hash,
        error: `Chain link mismatch at id=${row.id} (${row.event_id}): expected prev_hash=${expectedPrevHash}, found ${row.prev_hash}`,
        verifiedAt,
      };
    }

    const recomputedHash = await computeAuditEntryHash({
      prev_hash: row.prev_hash,
      timestamp: row.timestamp,
      actor_email: row.actor_email,
      action_type: row.action_type,
      target_type: row.target_type,
      target_id: String(row.target_id),
      reason: row.reason ?? "",
      before_state_json: row.before_state_json ?? null,
      after_state_json: row.after_state_json ?? null,
    });

    if (recomputedHash !== row.entry_hash) {
      return {
        valid: false,
        totalEntries: rows.length,
        genesisHash: rows[0].entry_hash,
        headHash: rows[rows.length - 1].entry_hash,
        headTimestamp: rows[rows.length - 1].timestamp,
        brokenAtId: row.id,
        brokenAtEventId: row.event_id,
        expectedHash: recomputedHash,
        actualHash: row.entry_hash,
        error: `SHA-256 digest mismatch at id=${row.id} (${row.event_id}): recomputed=${recomputedHash}, stored=${row.entry_hash}`,
        verifiedAt,
      };
    }

    expectedPrevHash = row.entry_hash;
  }

  const headRow = rows[rows.length - 1];
  return {
    valid: true,
    totalEntries: rows.length,
    genesisHash: rows[0].entry_hash,
    headHash: headRow.entry_hash,
    headTimestamp: headRow.timestamp,
    verifiedAt,
  };
}

/**
 * Lists and filters `audit_ledger` entries in reverse chronological order.
 */
export async function listAuditEntries(
  db: D1DatabaseLike,
  filters: AuditQueryFilters = {}
): Promise<{ entries: AuditLedgerEntry[]; total: number }> {
  await ensureGenesisAuditRow(db);

  const clauses: string[] = [];
  const bindings: unknown[] = [];

  if (filters.actionType && filters.actionType !== "all") {
    clauses.push("action_type = ?");
    bindings.push(filters.actionType);
  }
  if (filters.targetType && filters.targetType !== "all") {
    clauses.push("target_type = ?");
    bindings.push(filters.targetType);
  }
  if (filters.targetId) {
    clauses.push("target_id = ?");
    bindings.push(filters.targetId);
  }
  if (filters.actorEmail) {
    clauses.push("LOWER(actor_email) = LOWER(?)");
    bindings.push(filters.actorEmail);
  }
  if (filters.fromDate) {
    clauses.push("timestamp >= ?");
    bindings.push(filters.fromDate);
  }
  if (filters.toDate) {
    clauses.push("timestamp <= ?");
    bindings.push(filters.toDate);
  }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim()}%`;
    clauses.push(
      "(event_id LIKE ? OR action_type LIKE ? OR target_type LIKE ? OR target_id LIKE ? OR actor_email LIKE ? OR reason LIKE ? OR before_state_json LIKE ? OR after_state_json LIKE ?)"
    );
    bindings.push(q, q, q, q, q, q, q, q);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM audit_ledger ${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = Number(countRow?.total ?? 0);

  const limit = Math.min(500, Math.max(1, Number(filters.limit ?? 100)));
  const offset = Math.max(0, Number(filters.offset ?? 0));

  const rowsRes = await db
    .prepare(
      `SELECT * FROM audit_ledger ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`
    )
    .bind(...bindings, limit, offset)
    .all<AuditLedgerRow>();

  const entries = (rowsRes.results || []).map(mapAuditRowToEntry);
  return { entries, total };
}

const TARGET_TYPE_TO_TABLE: Record<
  string,
  { table: string; primaryKey: string; alternateKey?: string }
> = {
  episode: { table: "episodes", primaryKey: "id", alternateKey: "slug" },
  incident_article: {
    table: "telemetry_articles",
    primaryKey: "id",
    alternateKey: "url_hash",
  },
  ingest_feed: { table: "ingest_feeds", primaryKey: "id", alternateKey: "url" },
  ingest_filter: { table: "ingest_filters", primaryKey: "id" },
  user: { table: "admin_users", primaryKey: "id", alternateKey: "email" },
  outbound_feed: {
    table: "outbound_feeds",
    primaryKey: "id",
    alternateKey: "slug",
  },
  pipeline_transform: {
    table: "pipeline_transforms",
    primaryKey: "id",
    alternateKey: "transform_key",
  },
  system_settings: {
    table: "system_settings",
    primaryKey: "key",
  },
};

/**
 * Restores a target entity in D1 to its `before_state_json` (`revert_to_before`)
 * or `after_state_json` (`reapply_after`) and appends a new `audit.replay` entry
 * to `audit_ledger` referencing the original `event_id`.
 */
export async function replayAuditEntry(
  db: D1DatabaseLike,
  eventId: string,
  mode: "revert_to_before" | "reapply_after",
  actor: AuditReplayActor
): Promise<AuditReplayResult> {
  await ensureGenesisAuditRow(db);

  const targetAuditRow = await db
    .prepare("SELECT * FROM audit_ledger WHERE event_id = ?")
    .bind(eventId)
    .first<AuditLedgerRow>();

  if (!targetAuditRow) {
    throw new Error(`Audit ledger event not found: ${eventId}`);
  }

  if (targetAuditRow.action_type === "system.bootstrap") {
    throw new Error("The GENESIS system.bootstrap audit entry cannot be reverted.");
  }

  const targetSpec = TARGET_TYPE_TO_TABLE[targetAuditRow.target_type];
  const desiredStateJson =
    mode === "revert_to_before"
      ? targetAuditRow.before_state_json
      : targetAuditRow.after_state_json;
  const desiredState = safeParseJsonObject(desiredStateJson);

  let currentRow: Record<string, unknown> | null = null;
  let restoredRow: Record<string, unknown> | null = null;
  let appliedOperation: "insert" | "update" | "delete" | "noop" = "noop";

  if (targetSpec) {
    const { table, primaryKey, alternateKey } = targetSpec;

    // Check table columns via PRAGMA table_info
    const pragmaRes = await db
      .prepare(`PRAGMA table_info(${table})`)
      .all<{ name: string }>();
    const validColumns = new Set((pragmaRes.results || []).map((c) => c.name));

    if (validColumns.size > 0) {
      // Locate current row in target table
      const lookupPkValue =
        desiredState?.[primaryKey] ??
        safeParseJsonObject(targetAuditRow.before_state_json)?.[primaryKey] ??
        safeParseJsonObject(targetAuditRow.after_state_json)?.[primaryKey] ??
        targetAuditRow.target_id;

      if (lookupPkValue !== undefined && lookupPkValue !== null) {
        currentRow = await db
          .prepare(`SELECT * FROM ${table} WHERE ${primaryKey} = ?`)
          .bind(lookupPkValue)
          .first<Record<string, unknown>>();
      }

      if (!currentRow && alternateKey && validColumns.has(alternateKey)) {
        const altValue =
          desiredState?.[alternateKey] ??
          safeParseJsonObject(targetAuditRow.before_state_json)?.[alternateKey] ??
          safeParseJsonObject(targetAuditRow.after_state_json)?.[alternateKey] ??
          targetAuditRow.target_id;
        if (altValue !== undefined && altValue !== null) {
          currentRow = await db
            .prepare(`SELECT * FROM ${table} WHERE ${alternateKey} = ?`)
            .bind(altValue)
            .first<Record<string, unknown>>();
        }
      }

      if (desiredState === null) {
        // Desired state is null -> delete existing row if present
        if (currentRow && currentRow[primaryKey] !== undefined) {
          await db
            .prepare(`DELETE FROM ${table} WHERE ${primaryKey} = ?`)
            .bind(currentRow[primaryKey])
            .run();
          appliedOperation = "delete";
        } else {
          appliedOperation = "noop";
        }
        restoredRow = null;
      } else {
        // Filter desiredState keys to columns that exist in the table
        const cols = Object.keys(desiredState).filter((k) =>
          validColumns.has(k)
        );

        if (currentRow && currentRow[primaryKey] !== undefined) {
          const updateCols = cols.filter((k) => k !== primaryKey);
          if (updateCols.length > 0) {
            const setClause = updateCols.map((c) => `${c} = ?`).join(", ");
            const values = updateCols.map((c) => desiredState[c] ?? null);
            await db
              .prepare(
                `UPDATE ${table} SET ${setClause} WHERE ${primaryKey} = ?`
              )
              .bind(...values, currentRow[primaryKey])
              .run();
            appliedOperation = "update";
          }
          restoredRow = await db
            .prepare(`SELECT * FROM ${table} WHERE ${primaryKey} = ?`)
            .bind(currentRow[primaryKey])
            .first<Record<string, unknown>>();
        } else if (cols.length > 0) {
          try {
            const placeholders = cols.map(() => "?").join(", ");
            const values = cols.map((c) => desiredState[c] ?? null);
            await db
              .prepare(
                `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`
              )
              .bind(...values)
              .run();
            appliedOperation = "insert";

            const insertedLookupVal =
              desiredState[primaryKey] ??
              (alternateKey ? desiredState[alternateKey] : undefined);
            if (desiredState[primaryKey] !== undefined) {
              restoredRow = await db
                .prepare(`SELECT * FROM ${table} WHERE ${primaryKey} = ?`)
                .bind(desiredState[primaryKey])
                .first<Record<string, unknown>>();
            } else if (
              alternateKey &&
              insertedLookupVal !== undefined &&
              validColumns.has(alternateKey)
            ) {
              restoredRow = await db
                .prepare(`SELECT * FROM ${table} WHERE ${alternateKey} = ?`)
                .bind(insertedLookupVal)
                .first<Record<string, unknown>>();
            } else {
              restoredRow = desiredState;
            }
          } catch {
            // Partial snapshot where target row does not exist in table
            appliedOperation = "noop";
            restoredRow = desiredState;
          }
        }
      }
    } else {
      restoredRow = desiredState;
    }
  } else {
    restoredRow = desiredState;
  }

  const defaultReason =
    mode === "revert_to_before"
      ? `Reverted ${targetAuditRow.target_type}:${targetAuditRow.target_id} to state prior to event ${eventId} (${targetAuditRow.action_type})`
      : `Re-applied after-state of event ${eventId} (${targetAuditRow.action_type}) on ${targetAuditRow.target_type}:${targetAuditRow.target_id}`;

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole || "owner",
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "audit.replay",
    targetType: targetAuditRow.target_type,
    targetId: targetAuditRow.target_id,
    reason: actor.reason?.trim() || defaultReason,
    beforeState: currentRow,
    afterState: restoredRow,
    replayCommand: {
      op: "audit.replay",
      replayed_event_id: eventId,
      original_action_type: targetAuditRow.action_type,
      mode,
      applied_operation: appliedOperation,
      target_type: targetAuditRow.target_type,
      target_id: targetAuditRow.target_id,
    },
  });

  return {
    ok: true,
    replayedEventId: eventId,
    mode,
    targetType: targetAuditRow.target_type,
    targetId: String(targetAuditRow.target_id),
    appliedOperation,
    restoredState: restoredRow,
    auditEntry,
  };
}

/**
 * Generates a signed JSON & Markdown public disclosure report of the immutable audit trail.
 */
export async function exportAuditDisclosureBundle(
  db: D1DatabaseLike,
  filters: AuditQueryFilters = {}
): Promise<AuditDisclosureBundle> {
  const chainIntegrity = await verifyAuditChainIntegrity(db);
  const { entries } = await listAuditEntries(db, {
    ...filters,
    limit: filters.limit ?? 500,
  });

  const generatedAt = new Date().toISOString();
  const signaturePayload = JSON.stringify({
    generatedAt,
    chainValid: chainIntegrity.valid,
    headHash: chainIntegrity.headHash,
    totalEntries: chainIntegrity.totalEntries,
    exportedEventIds: entries.map((e) => e.eventId),
  });
  const bundleSignatureHash = await sha256Hex(signaturePayload);

  const mdLines: string[] = [
    `# The CAB Call (\`thecabcall.com\`) — Public Governance & Editorial Audit Disclosure Report`,
    ``,
    `- **Generated At:** \`${generatedAt}\``,
    `- **Chain Integrity Status:** \`${
      chainIntegrity.valid ? "VERIFIED (SHA-256 HASH CHAIN INTACT)" : "BROKEN"
    }\``,
    `- **Total Ledger Entries:** \`${chainIntegrity.totalEntries}\``,
    `- **Genesis Digest:** \`${chainIntegrity.genesisHash || "N/A"}\``,
    `- **Current Head Digest:** \`${chainIntegrity.headHash}\``,
    `- **Disclosure Bundle SHA-256 Signature:** \`${bundleSignatureHash}\``,
    ``,
    `---`,
    ``,
    `## Audited Events Included in This Disclosure (${entries.length})`,
    ``,
  ];

  for (const entry of entries) {
    mdLines.push(
      `### [#${entry.id}] \`${entry.actionType}\` on \`${entry.targetType}:${entry.targetId}\``
    );
    mdLines.push(`- **Event UUID:** \`${entry.eventId}\``);
    mdLines.push(`- **Timestamp (UTC):** \`${entry.timestamp}\``);
    mdLines.push(
      `- **Actor:** \`${entry.actorEmail}\` (\`${entry.actorRole}\` via \`${entry.authMethod}\`)`
    );
    mdLines.push(
      `- **Disclosure Reason / Editorial Note:** ${
        entry.reason ? entry.reason : "_No additional note provided_"
      }`
    );
    mdLines.push(`- **Previous Hash (\`prev_hash\`):** \`${entry.prevHash}\``);
    mdLines.push(`- **Entry Hash (\`entry_hash\`):** \`${entry.entryHash}\``);
    mdLines.push(``);
    mdLines.push(`**Before State Snapshot:**`);
    mdLines.push("```json");
    mdLines.push(
      entry.beforeState ? JSON.stringify(entry.beforeState, null, 2) : "null"
    );
    mdLines.push("```");
    mdLines.push(``);
    mdLines.push(`**After State Snapshot:**`);
    mdLines.push("```json");
    mdLines.push(
      entry.afterState ? JSON.stringify(entry.afterState, null, 2) : "null"
    );
    mdLines.push("```");
    mdLines.push(``);
    mdLines.push(`---`);
    mdLines.push(``);
  }

  return {
    schemaVersion: "cabcall-disclosure-v1",
    generatedAt,
    site: "https://thecabcall.com",
    chainIntegrity,
    filtersApplied: filters,
    entryCount: entries.length,
    bundleSignatureHash,
    entries,
    markdownReport: mdLines.join("\n"),
  };
}
