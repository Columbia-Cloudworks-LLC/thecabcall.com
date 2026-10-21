import { revalidatePath } from "next/cache";
import {
  createLocalSqliteD1Adapter,
  getEffectiveWorkerUrl,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
} from "./d1-bridge";
import { AuditLedgerEntry } from "@/pipeline/audit";
import {
  createOutboundFeed,
  CreateOutboundFeedInput,
   DEFAULT_OUTBOUND_FEEDS,
  deleteOutboundFeed,
  getOutboundFeedByIdOrSlug,
  listOutboundFeeds,
  OutboundFeedConfig,
  PublishingAdminActor,
  updateOutboundFeed,
  UpdateOutboundFeedInput,
} from "@/pipeline/publishing";

export * from "@/pipeline/publishing";

function buildAdminHeaders(actor?: PublishingAdminActor): Record<string, string> {
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

export function invalidatePublishingCaches(): void {
  try {
    revalidatePath("/feed.xml");
    revalidatePath("/feeds/incidents.xml");
    revalidatePath("/feeds/incidents.json");
    revalidatePath("/feeds");
    revalidatePath("/status");
    revalidatePath("/admin/publishing");
    revalidatePath("/admin/audit");
  } catch {
    // revalidatePath may throw outside Next.js request context
  }
}

/**
 * Fetches all outbound feeds (`outbound_feeds`) from the remote Worker or local D1 SQLite.
 */
export async function listOutboundFeedsBridge(): Promise<OutboundFeedConfig[]> {
  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/outbound-feeds`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as {
          ok?: boolean;
          feeds?: OutboundFeedConfig[];
        };
        if (Array.isArray(data.feeds) && data.feeds.length > 0) {
          return data.feeds;
        }
      }
    } catch {
      // Fallback to local SQLite
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return DEFAULT_OUTBOUND_FEEDS.map((f) => ({ ...f }));
  }
  return listOutboundFeeds(db);
}

/**
 * Fetches a single outbound feed configuration by slug (`podcast-rss`, `incidents-rss`, `incidents-json`, or custom slug).
 */
export async function getOutboundFeedConfigBySlugBridge(
  slug: string
): Promise<OutboundFeedConfig | null> {
  const feeds = await listOutboundFeedsBridge();
  const normalized = slug.trim().toLowerCase();
  const found = feeds.find((f) => f.slug.toLowerCase() === normalized);
  if (found) return found;

  const db = createLocalSqliteD1Adapter();
  if (db) {
    const localFound = await getOutboundFeedByIdOrSlug(db, normalized);
    if (localFound) return localFound.config;
  }

  return (
    DEFAULT_OUTBOUND_FEEDS.find((f) => f.slug.toLowerCase() === normalized) ||
    null
  );
}

export async function updateOutboundFeedBridge(
  input: UpdateOutboundFeedInput,
  actor: PublishingAdminActor
): Promise<{
  feed: OutboundFeedConfig;
  feeds: OutboundFeedConfig[];
  auditEntry?: AuditLedgerEntry;
  auditEventId?: string;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/publishing`, {
      method: "PUT",
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
      feed?: OutboundFeedConfig;
      feeds?: OutboundFeedConfig[];
      auditEntry?: AuditLedgerEntry;
      auditEventId?: string;
    };

    if (!response.ok || !data.ok || !data.feed) {
      throw new Error(
        data?.error ||
          `Worker PUT /api/admin/publishing failed with HTTP ${response.status}`
      );
    }

    invalidatePublishingCaches();
    return {
      feed: data.feed,
      feeds: data.feeds || (await listOutboundFeedsBridge()),
      auditEntry: data.auditEntry,
      auditEventId: data.auditEventId || data.auditEntry?.eventId,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local D1 SQLite database is not initialized.");
  }

  const result = await updateOutboundFeed(db, input, actor);
  const feeds = await listOutboundFeeds(db);
  invalidatePublishingCaches();
  return {
    feed: result.feed,
    feeds,
    auditEntry: result.auditEntry,
    auditEventId: result.auditEntry.eventId,
  };
}

export async function createOutboundFeedBridge(
  input: CreateOutboundFeedInput,
  actor: PublishingAdminActor
): Promise<{
  feed: OutboundFeedConfig;
  feeds: OutboundFeedConfig[];
  auditEntry?: AuditLedgerEntry;
  auditEventId?: string;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/publishing`, {
      method: "POST",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        action: "create",
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
      feed?: OutboundFeedConfig;
      feeds?: OutboundFeedConfig[];
      auditEntry?: AuditLedgerEntry;
      auditEventId?: string;
    };

    if (!response.ok || !data.ok || !data.feed) {
      throw new Error(
        data?.error ||
          `Worker POST /api/admin/publishing failed with HTTP ${response.status}`
      );
    }

    invalidatePublishingCaches();
    return {
      feed: data.feed,
      feeds: data.feeds || (await listOutboundFeedsBridge()),
      auditEntry: data.auditEntry,
      auditEventId: data.auditEventId || data.auditEntry?.eventId,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local D1 SQLite database is not initialized.");
  }

  const result = await createOutboundFeed(db, input, actor);
  const feeds = await listOutboundFeeds(db);
  invalidatePublishingCaches();
  return {
    feed: result.feed,
    feeds,
    auditEntry: result.auditEntry,
    auditEventId: result.auditEntry.eventId,
  };
}

export async function deleteOutboundFeedBridge(
  idOrSlug: number | string,
  reason: string | undefined,
  actor: PublishingAdminActor
): Promise<{
  deletedSlug: string;
  feeds: OutboundFeedConfig[];
  auditEntry?: AuditLedgerEntry;
  auditEventId?: string;
}> {
  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/publishing`, {
      method: "DELETE",
      headers: buildAdminHeaders(actor),
      body: JSON.stringify({
        idOrSlug,
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
      deletedSlug?: string;
      feeds?: OutboundFeedConfig[];
      auditEntry?: AuditLedgerEntry;
      auditEventId?: string;
    };

    if (!response.ok || !data.ok || !data.deletedSlug) {
      throw new Error(
        data?.error ||
          `Worker DELETE /api/admin/publishing failed with HTTP ${response.status}`
      );
    }

    invalidatePublishingCaches();
    return {
      deletedSlug: data.deletedSlug,
      feeds: data.feeds || (await listOutboundFeedsBridge()),
      auditEntry: data.auditEntry,
      auditEventId: data.auditEventId || data.auditEntry?.eventId,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local D1 SQLite database is not initialized.");
  }

  const result = await deleteOutboundFeed(db, idOrSlug, reason, actor);
  const feeds = await listOutboundFeeds(db);
  invalidatePublishingCaches();
  return {
    deletedSlug: result.deletedSlug,
    feeds,
    auditEntry: result.auditEntry,
    auditEventId: result.auditEntry.eventId,
  };
}
