import {
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  getEffectiveWorkerUrl,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
} from "./d1-bridge";
import {
  AppendAuditEntryInput,
  appendAuditEntry,
  AuditChainVerificationResult,
  AuditDisclosureBundle,
  AuditLedgerEntry,
  AuditQueryFilters,
  AuditReplayActor,
  AuditReplayResult,
  exportAuditDisclosureBundle,
  listAuditEntries,
  replayAuditEntry,
  verifyAuditChainIntegrity,
} from "@/pipeline/audit";

export * from "@/pipeline/audit";

/**
 * Lists and filters audit ledger entries across either the remote Cloudflare Worker or local D1 SQLite.
 */
export async function getAuditLedgerEntries(
  filters: AuditQueryFilters = {}
): Promise<{
  entries: AuditLedgerEntry[];
  total: number;
  chainIntegrity?: AuditChainVerificationResult;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const envVars = loadLocalEnvVars();
    const params = new URLSearchParams();
    if (filters.actionType) params.set("actionType", filters.actionType);
    if (filters.targetType) params.set("targetType", filters.targetType);
    if (filters.targetId) params.set("targetId", filters.targetId);
    if (filters.actorEmail) params.set("actorEmail", filters.actorEmail);
    if (filters.search) params.set("search", filters.search);
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));
    if (filters.offset !== undefined)
      params.set("offset", String(filters.offset));

    const qs = params.toString();
    const response = await fetch(
      `${workerUrl}/api/admin/audit${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-admin-secret": envVars.ADMIN_SECRET,
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      const data = (await response.json()) as {
        entries?: AuditLedgerEntry[];
        total?: number;
        chainIntegrity?: AuditChainVerificationResult;
      };
      return {
        entries: Array.isArray(data.entries) ? data.entries : [],
        total: Number(data.total ?? 0),
        chainIntegrity: data.chainIntegrity,
      };
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return { entries: [], total: 0 };
  }
  const [listRes, chainIntegrity] = await Promise.all([
    listAuditEntries(db, filters),
    verifyAuditChainIntegrity(db),
  ]);
  return {
    ...listRes,
    chainIntegrity,
  };
}

/**
 * Appends a new entry to the immutable `audit_ledger` (via remote Worker or local D1).
 */
export async function recordAuditEntry(
  input: AppendAuditEntryInput
): Promise<AuditLedgerEntry> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const envVars = loadLocalEnvVars();
    const response = await fetch(`${workerUrl}/api/admin/audit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      entry?: AuditLedgerEntry;
      error?: string;
    };

    if (!response.ok || !data.entry) {
      throw new Error(
        data.error || `Worker /api/admin/audit POST failed (${response.status})`
      );
    }

    return data.entry;
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available for audit logging");
  }
  return appendAuditEntry(db, input);
}

/**
 * Verifies the cryptographic SHA-256 hash chain across all `audit_ledger` entries.
 */
export async function verifyAuditLedgerChain(): Promise<AuditChainVerificationResult> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/audit/verify`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (response.ok) {
      return (await response.json()) as AuditChainVerificationResult;
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return {
      valid: false,
      totalEntries: 0,
      genesisHash: null,
      headHash: "UNAVAILABLE",
      headTimestamp: null,
      error: "Database connection unavailable",
      verifiedAt: new Date().toISOString(),
    };
  }
  return verifyAuditChainIntegrity(db);
}

/**
 * Replays or reverts an audit entry in D1 and records a new `audit.replay` entry in `audit_ledger`.
 */
export async function executeAuditReplay(
  eventId: string,
  mode: "revert_to_before" | "reapply_after",
  actor: AuditReplayActor
): Promise<AuditReplayResult> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const envVars = loadLocalEnvVars();
    const response = await fetch(`${workerUrl}/api/admin/audit/replay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
      },
      body: JSON.stringify({
        eventId,
        mode,
        ...actor,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as AuditReplayResult & {
      error?: string;
    };
    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
          `Worker /api/admin/audit/replay failed with HTTP ${response.status}`
      );
    }

    await ensureD1Snapshot(true);
    return data;
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available for audit replay");
  }
  const result = await replayAuditEntry(db, eventId, mode, actor);
  await ensureD1Snapshot(true);
  return result;
}

/**
 * Exports a signed JSON & Markdown audit disclosure bundle.
 */
export async function generateAuditDisclosureBundle(
  filters: AuditQueryFilters = {}
): Promise<AuditDisclosureBundle> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const envVars = loadLocalEnvVars();
    const params = new URLSearchParams();
    if (filters.actionType) params.set("actionType", filters.actionType);
    if (filters.targetType) params.set("targetType", filters.targetType);
    if (filters.targetId) params.set("targetId", filters.targetId);
    if (filters.actorEmail) params.set("actorEmail", filters.actorEmail);
    if (filters.search) params.set("search", filters.search);
    if (filters.fromDate) params.set("fromDate", filters.fromDate);
    if (filters.toDate) params.set("toDate", filters.toDate);
    if (filters.limit !== undefined) params.set("limit", String(filters.limit));

    const qs = params.toString();
    const response = await fetch(
      `${workerUrl}/api/admin/audit/export${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-admin-secret": envVars.ADMIN_SECRET,
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      return (await response.json()) as AuditDisclosureBundle;
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error(
      "Local Wrangler D1 database not available for disclosure export"
    );
  }
  return exportAuditDisclosureBundle(db, filters);
}
