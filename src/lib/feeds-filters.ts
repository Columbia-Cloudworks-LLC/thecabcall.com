import {
  createLocalSqliteD1Adapter,
  ensureD1Snapshot,
  getEffectiveWorkerUrl,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
} from "./d1-bridge";
import { AuditLedgerEntry } from "@/pipeline/audit";
import {
  createIngestFeed,
  createIngestFilter,
  deleteIngestFeed,
  deleteIngestFilter,
  FeedFilterAdminActor,
  FeedTestPreviewResult,
  FilterDryRunResult,
  getSystemThresholds,
  IngestFeedRecord,
  IngestFilterMatchTarget,
  IngestFilterRecord,
  IngestFilterType,
  listIngestFeeds,
  listIngestFilters,
  SystemSettingsMap,
  testCandidateRssFeed,
  testIngestFiltersDryRun,
  updateIngestFeed,
  updateIngestFilter,
  updateSystemThresholds,
  US_HIGH_IMPACT_FEEDS,
} from "@/pipeline/ingest";

export * from "@/pipeline/ingest";

function buildAdminHeaders(actor?: FeedFilterAdminActor): Record<string, string> {
  const envVars = loadLocalEnvVars();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-admin-secret": envVars.ADMIN_SECRET,
  };
  if (actor?.actorEmail) {
    headers["x-actor-email"] = actor.actorEmail;
  }
  if (actor?.actorRole) {
    headers["x-actor-role"] = actor.actorRole;
  }
  if (actor?.authMethod) {
    headers["x-actor-auth-method"] = actor.authMethod;
  }
  return headers;
}

/**
 * Fetches all configured inbound RSS/Atom feeds (`ingest_feeds`) via remote Worker or local D1.
 */
export async function getIngestFeedsBridge(): Promise<IngestFeedRecord[]> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/admin/feeds`, {
        method: "GET",
        headers: buildAdminHeaders(),
        cache: "no-store",
      });

      if (response.ok) {
        const data = (await response.json()) as {
          ok?: boolean;
          feeds?: IngestFeedRecord[];
        };
        if (Array.isArray(data.feeds)) {
          return data.feeds;
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return US_HIGH_IMPACT_FEEDS.map((f, idx) => ({
      id: f.id || idx + 1,
      name: f.name,
      url: f.url,
      focusArea: f.focusArea,
      domainSectorOverride: f.domainSectorOverride || null,
      itemsPerPoll: f.itemsPerPoll || 5,
      enabled: true,
      lastPolledAt: null,
      lastStatus: "nominal",
      lastError: null,
      totalIngested: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }
  return listIngestFeeds(db);
}

/**
 * Creates a new inbound RSS/Atom feed and logs `feed.create` in `audit_ledger`.
 */
export async function createIngestFeedBridge(
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
): Promise<{
  feed: IngestFeedRecord;
  auditEntry: AuditLedgerEntry;
  feeds: IngestFeedRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/feeds`, {
      method: "POST",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        ...input,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      feed?: IngestFeedRecord;
      auditEntry?: AuditLedgerEntry;
      feeds?: IngestFeedRecord[];
    };

    if (!response.ok || !data.ok || !data.feed || !data.auditEntry) {
      throw new Error(
        data.error || `Worker /api/admin/feeds POST failed (${response.status})`
      );
    }

    return {
      feed: data.feed,
      auditEntry: data.auditEntry,
      feeds: data.feeds || [data.feed],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await createIngestFeed(db, input, actor);
  const feeds = await listIngestFeeds(db);
  return { ...res, feeds };
}

/**
 * Updates an inbound RSS/Atom feed and logs `feed.update` in `audit_ledger`.
 */
export async function updateIngestFeedBridge(
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
): Promise<{
  feed: IngestFeedRecord;
  auditEntry: AuditLedgerEntry;
  feeds: IngestFeedRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/feeds`, {
      method: "PUT",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        id,
        ...input,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      feed?: IngestFeedRecord;
      auditEntry?: AuditLedgerEntry;
      feeds?: IngestFeedRecord[];
    };

    if (!response.ok || !data.ok || !data.feed || !data.auditEntry) {
      throw new Error(
        data.error || `Worker /api/admin/feeds PUT failed (${response.status})`
      );
    }

    return {
      feed: data.feed,
      auditEntry: data.auditEntry,
      feeds: data.feeds || [data.feed],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await updateIngestFeed(db, id, input, actor);
  const feeds = await listIngestFeeds(db);
  return { ...res, feeds };
}

/**
 * Deletes an inbound RSS/Atom feed and logs `feed.delete` in `audit_ledger`.
 */
export async function deleteIngestFeedBridge(
  id: number,
  reason: string,
  actor: FeedFilterAdminActor
): Promise<{
  deletedId: number;
  auditEntry: AuditLedgerEntry;
  feeds: IngestFeedRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/feeds`, {
      method: "DELETE",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        id,
        reason,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      deletedId?: number;
      auditEntry?: AuditLedgerEntry;
      feeds?: IngestFeedRecord[];
    };

    if (!response.ok || !data.ok || !data.auditEntry) {
      throw new Error(
        data.error ||
          `Worker /api/admin/feeds DELETE failed (${response.status})`
      );
    }

    return {
      deletedId: data.deletedId ?? id,
      auditEntry: data.auditEntry,
      feeds: data.feeds || [],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await deleteIngestFeed(db, id, reason, actor);
  const feeds = await listIngestFeeds(db);
  return { ...res, feeds };
}

/**
 * Tests and previews a candidate RSS/Atom URL live.
 */
export async function testCandidateRssFeedBridge(
  url: string,
  maxItems = 5
): Promise<FeedTestPreviewResult> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/admin/feeds/test`, {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify({ url, maxItems }),
        cache: "no-store",
      });
      const data = (await response.json()) as FeedTestPreviewResult;
      if (data && typeof data.ok === "boolean") {
        return data;
      }
    } catch {
      // Fallback to direct fetch in Next.js server runtime
    }
  }
  return testCandidateRssFeed(url, maxItems);
}

/**
 * Fetches all configured triage filters (`ingest_filters`) and `system_settings` thresholds.
 */
export async function getIngestFiltersAndThresholdsBridge(): Promise<{
  filters: IngestFilterRecord[];
  thresholds: SystemSettingsMap;
  feeds: IngestFeedRecord[];
}> {
  const defaultThresholds: SystemSettingsMap = {
    jevMinSystemicProb: 0.7,
    jevMinConfidence: 0.5,
    maxNetNewPerRun: 10,
    defaultItemsPerPoll: 5,
  };

  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/admin/filters`, {
        method: "GET",
        headers: buildAdminHeaders(),
        cache: "no-store",
      });

      if (response.ok) {
        const data = (await response.json()) as {
          ok?: boolean;
          filters?: IngestFilterRecord[];
          thresholds?: SystemSettingsMap;
          feeds?: IngestFeedRecord[];
        };
        if (Array.isArray(data.filters)) {
          return {
            filters: data.filters,
            thresholds: data.thresholds || defaultThresholds,
            feeds: Array.isArray(data.feeds) ? data.feeds : [],
          };
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return {
      filters: [],
      thresholds: defaultThresholds,
      feeds: [],
    };
  }

  const [filters, thresholds, feeds] = await Promise.all([
    listIngestFilters(db),
    getSystemThresholds(db),
    listIngestFeeds(db),
  ]);

  return { filters, thresholds, feeds };
}

/**
 * Creates a new triage filter rule and logs `filter.create` in `audit_ledger`.
 */
export async function createIngestFilterBridge(
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
): Promise<{
  filter: IngestFilterRecord;
  auditEntry: AuditLedgerEntry;
  filters: IngestFilterRecord[];
  thresholds: SystemSettingsMap;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/filters`, {
      method: "POST",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        ...input,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      filter?: IngestFilterRecord;
      auditEntry?: AuditLedgerEntry;
      filters?: IngestFilterRecord[];
      thresholds?: SystemSettingsMap;
    };

    if (!response.ok || !data.ok || !data.filter || !data.auditEntry) {
      throw new Error(
        data.error ||
          `Worker /api/admin/filters POST failed (${response.status})`
      );
    }

    return {
      filter: data.filter,
      auditEntry: data.auditEntry,
      filters: data.filters || [data.filter],
      thresholds: data.thresholds || {
        jevMinSystemicProb: 0.7,
        jevMinConfidence: 0.5,
        maxNetNewPerRun: 10,
        defaultItemsPerPoll: 5,
      },
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await createIngestFilter(db, input, actor);
  const [filters, thresholds] = await Promise.all([
    listIngestFilters(db),
    getSystemThresholds(db),
  ]);
  return { ...res, filters, thresholds };
}

/**
 * Updates an existing triage filter rule and logs `filter.update` in `audit_ledger`.
 */
export async function updateIngestFilterBridge(
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
): Promise<{
  filter: IngestFilterRecord;
  auditEntry: AuditLedgerEntry;
  filters: IngestFilterRecord[];
  thresholds: SystemSettingsMap;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/filters`, {
      method: "PUT",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        action: "update_filter",
        id,
        ...input,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      filter?: IngestFilterRecord;
      auditEntry?: AuditLedgerEntry;
      filters?: IngestFilterRecord[];
      thresholds?: SystemSettingsMap;
    };

    if (!response.ok || !data.ok || !data.filter || !data.auditEntry) {
      throw new Error(
        data.error ||
          `Worker /api/admin/filters PUT failed (${response.status})`
      );
    }

    return {
      filter: data.filter,
      auditEntry: data.auditEntry,
      filters: data.filters || [data.filter],
      thresholds: data.thresholds || {
        jevMinSystemicProb: 0.7,
        jevMinConfidence: 0.5,
        maxNetNewPerRun: 10,
        defaultItemsPerPoll: 5,
      },
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await updateIngestFilter(db, id, input, actor);
  const [filters, thresholds] = await Promise.all([
    listIngestFilters(db),
    getSystemThresholds(db),
  ]);
  return { ...res, filters, thresholds };
}

/**
 * Updates global Jev thresholds in `system_settings` and logs `settings.threshold_update` in `audit_ledger`.
 */
export async function updateSystemThresholdsBridge(
  input: {
    jevMinSystemicProb?: number;
    jevMinConfidence?: number;
    maxNetNewPerRun?: number;
    defaultItemsPerPoll?: number;
    reason?: string;
  },
  actor: FeedFilterAdminActor
): Promise<{
  thresholds: SystemSettingsMap;
  auditEntry: AuditLedgerEntry;
  filters: IngestFilterRecord[];
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/filters`, {
      method: "PUT",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        action: "update_thresholds",
        ...input,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      thresholds?: SystemSettingsMap;
      auditEntry?: AuditLedgerEntry;
      filters?: IngestFilterRecord[];
    };

    if (!response.ok || !data.ok || !data.thresholds || !data.auditEntry) {
      throw new Error(
        data.error ||
          `Worker /api/admin/filters threshold PUT failed (${response.status})`
      );
    }

    await ensureD1Snapshot(true);
    return {
      thresholds: data.thresholds,
      auditEntry: data.auditEntry,
      filters: data.filters || [],
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await updateSystemThresholds(db, input, actor);
  const filters = await listIngestFilters(db);
  await ensureD1Snapshot(true);
  return {
    thresholds: res.settings,
    auditEntry: res.auditEntry,
    filters,
  };
}

/**
 * Deletes an `ingest_filters` row and logs `filter.delete` in `audit_ledger`.
 */
export async function deleteIngestFilterBridge(
  id: number,
  reason: string,
  actor: FeedFilterAdminActor
): Promise<{
  deletedId: number;
  auditEntry: AuditLedgerEntry;
  filters: IngestFilterRecord[];
  thresholds: SystemSettingsMap;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/filters`, {
      method: "DELETE",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        id,
        reason,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        authMethod: actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok?: boolean;
      error?: string;
      deletedId?: number;
      auditEntry?: AuditLedgerEntry;
      filters?: IngestFilterRecord[];
      thresholds?: SystemSettingsMap;
    };

    if (!response.ok || !data.ok || !data.auditEntry) {
      throw new Error(
        data.error ||
          `Worker /api/admin/filters DELETE failed (${response.status})`
      );
    }

    return {
      deletedId: data.deletedId ?? id,
      auditEntry: data.auditEntry,
      filters: data.filters || [],
      thresholds: data.thresholds || {
        jevMinSystemicProb: 0.7,
        jevMinConfidence: 0.5,
        maxNetNewPerRun: 10,
        defaultItemsPerPoll: 5,
      },
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }
  const res = await deleteIngestFilter(db, id, reason, actor);
  const [filters, thresholds] = await Promise.all([
    listIngestFilters(db),
    getSystemThresholds(db),
  ]);
  return { ...res, filters, thresholds };
}

/**
 * Runs a non-destructive dry-run test of active filters + an optional candidate rule against recent headlines.
 */
export async function testIngestFiltersDryRunBridge(input?: {
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
}): Promise<FilterDryRunResult> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/admin/filters/test`, {
        method: "POST",
        headers: buildAdminHeaders(),
        body: JSON.stringify(input || {}),
        cache: "no-store",
      });
      if (response.ok) {
        return (await response.json()) as FilterDryRunResult;
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Database connection unavailable for filter dry-run");
  }
  return testIngestFiltersDryRun(db, input);
}
