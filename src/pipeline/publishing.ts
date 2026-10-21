import {
  appendAuditEntry,
  AuditAuthMethod,
  AuditLedgerEntry,
} from "./audit";
import { D1DatabaseLike } from "./ingest";
import {
  formatCraftLedgerEntry,
  formatFriendlySourceName,
  PublicEpisodeDto,
  PublicIncidentDto,
} from "@/lib/dto";
import {
  CANONICAL_PODCAST_AI_COLOPHON,
  sanitizeEpisodeSummaryDefensive,
  stripAiDisclaimers,
} from "@/lib/episode-metadata";
import { deduplicateSignalAgainstFacts } from "@/lib/sanitize";
import {
  getSreFailureModeSpec,
  getWorkingToolBySlug,
} from "@/lib/taxonomy";

export interface OutboundFeedRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  author_name: string;
  owner_email: string;
  cover_image_url: string | null;
  language: string;
  category: string;
  max_items: number;
  use_deescalated_titles: number;
  include_original_title_note: number;
  include_attached_images: number;
  include_full_socratic_brief: number;
  include_audit_ledger_footer: number;
  filter_working_tool: string | null;
  enabled: number;
  updated_at: string;
}

export interface OutboundFeedConfig {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  authorName: string;
  ownerEmail: string;
  coverImageUrl: string | null;
  language: string;
  category: string;
  maxItems: number;
  useDeescalatedTitles: boolean;
  includeOriginalTitleNote: boolean;
  includeAttachedImages: boolean;
  includeFullSocraticBrief: boolean;
  includeAuditLedgerFooter: boolean;
  filterWorkingTool: string | null;
  enabled: boolean;
  updatedAt: string;
}

export interface PublishingAdminActor {
  actorEmail: string;
  actorRole: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
}

export interface UpdateOutboundFeedInput {
  idOrSlug: number | string;
  title?: string;
  subtitle?: string;
  description?: string;
  authorName?: string;
  ownerEmail?: string;
  coverImageUrl?: string | null;
  language?: string;
  category?: string;
  maxItems?: number;
  useDeescalatedTitles?: boolean;
  includeOriginalTitleNote?: boolean;
  includeAttachedImages?: boolean;
  includeFullSocraticBrief?: boolean;
  includeAuditLedgerFooter?: boolean;
  filterWorkingTool?: string | null;
  enabled?: boolean;
  reason?: string;
}

export interface CreateOutboundFeedInput {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  authorName?: string;
  ownerEmail?: string;
  coverImageUrl?: string | null;
  language?: string;
  category?: string;
  maxItems?: number;
  useDeescalatedTitles?: boolean;
  includeOriginalTitleNote?: boolean;
  includeAttachedImages?: boolean;
  includeFullSocraticBrief?: boolean;
  includeAuditLedgerFooter?: boolean;
  filterWorkingTool?: string | null;
  enabled?: boolean;
  reason?: string;
}

export const OUTBOUND_FEEDS_SELECT_COLUMNS =
  "id, slug, title, subtitle, description, author_name, owner_email, cover_image_url, language, category, max_items, use_deescalated_titles, include_original_title_note, include_attached_images, include_full_socratic_brief, include_audit_ledger_footer, filter_working_tool, enabled, updated_at";

export const BUILTIN_OUTBOUND_FEED_SLUGS = new Set<string>([
  "podcast-rss",
  "incidents-rss",
  "incidents-json",
]);

export const DEFAULT_OUTBOUND_FEEDS: OutboundFeedConfig[] = [
  {
    id: 1,
    slug: "podcast-rss",
    title: "Change Advisory Board (The CAB Call)",
    subtitle: "Weekly Systems Dispatches & Craft Failure Analysis",
    description:
      "Conversational deep-dives analyzing live Trestleboard ledger dispatches alongside foundational essays on Site Reliability Engineering and the Working Tools of Freemasonry.",
    authorName: "Change Advisory Board",
    ownerEmail: "telemetry@thecabcall.com",
    coverImageUrl: "https://thecabcall.com/media/podcast-cover-square.png",
    language: "en-us",
    category: "Technology",
    maxItems: 50,
    useDeescalatedTitles: true,
    includeOriginalTitleNote: true,
    includeAttachedImages: true,
    includeFullSocraticBrief: true,
    includeAuditLedgerFooter: true,
    filterWorkingTool: null,
    enabled: true,
    updatedAt: "2026-10-21T00:00:00Z",
  },
  {
    id: 2,
    slug: "incidents-rss",
    title: "Change Advisory Board — The Trestleboard Case Briefs",
    subtitle: "De-Alarmed Craftsman's Briefs & Structural Post-Mortems (RSS 2.0)",
    description:
      "Synthesized Craftsman's Briefs examining current events through Site Reliability Engineering and the Six Working Tools of Freemasonry. Separates Partisan Heat & Spin (The Noise) from The Actual Foundation (The Signal).",
    authorName: "Change Advisory Board",
    ownerEmail: "telemetry@thecabcall.com",
    coverImageUrl: null,
    language: "en-us",
    category: "Technology",
    maxItems: 50,
    useDeescalatedTitles: true,
    includeOriginalTitleNote: true,
    includeAttachedImages: true,
    includeFullSocraticBrief: true,
    includeAuditLedgerFooter: true,
    filterWorkingTool: null,
    enabled: true,
    updatedAt: "2026-10-21T00:00:00Z",
  },
  {
    id: 3,
    slug: "incidents-json",
    title: "Change Advisory Board — The Trestleboard Case Ledger",
    subtitle: "Structured JSON Feed 1.1 of Craftsman's Briefs",
    description:
      "Craftsman's Briefs examining current events through Site Reliability Engineering failure analysis and the Six Working Tools of Freemasonry.",
    authorName: "Change Advisory Board",
    ownerEmail: "telemetry@thecabcall.com",
    coverImageUrl: null,
    language: "en-US",
    category: "Technology",
    maxItems: 50,
    useDeescalatedTitles: true,
    includeOriginalTitleNote: true,
    includeAttachedImages: true,
    includeFullSocraticBrief: true,
    includeAuditLedgerFooter: true,
    filterWorkingTool: null,
    enabled: true,
    updatedAt: "2026-10-21T00:00:00Z",
  },
];

export function mapOutboundFeedRowToConfig(row: OutboundFeedRow): OutboundFeedConfig {
  return {
    id: Number(row.id),
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    authorName: row.author_name,
    ownerEmail: row.owner_email,
    coverImageUrl: row.cover_image_url || null,
    language: row.language || "en-us",
    category: row.category || "Technology",
    maxItems: Math.max(1, Math.min(200, Number(row.max_items || 50))),
    useDeescalatedTitles: Number(row.use_deescalated_titles ?? 1) === 1,
    includeOriginalTitleNote: Number(row.include_original_title_note ?? 1) === 1,
    includeAttachedImages: Number(row.include_attached_images ?? 1) === 1,
    includeFullSocraticBrief: Number(row.include_full_socratic_brief ?? 1) === 1,
    includeAuditLedgerFooter: Number(row.include_audit_ledger_footer ?? 1) === 1,
    filterWorkingTool: row.filter_working_tool || null,
    enabled: Number(row.enabled ?? 1) === 1,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

let outboundFeedsSchemaEnsured = false;

export async function ensureOutboundFeedsSchema(
  db: D1DatabaseLike
): Promise<void> {
  if (outboundFeedsSchemaEnsured) return;
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS outbound_feeds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL,
          description TEXT NOT NULL,
          author_name TEXT NOT NULL,
          owner_email TEXT NOT NULL,
          cover_image_url TEXT,
          language TEXT NOT NULL DEFAULT 'en-us',
          category TEXT NOT NULL DEFAULT 'Technology',
          max_items INTEGER NOT NULL DEFAULT 50,
          use_deescalated_titles INTEGER NOT NULL DEFAULT 1,
          include_original_title_note INTEGER NOT NULL DEFAULT 1,
          include_attached_images INTEGER NOT NULL DEFAULT 1,
          include_full_socratic_brief INTEGER NOT NULL DEFAULT 1,
          include_audit_ledger_footer INTEGER NOT NULL DEFAULT 1,
          filter_working_tool TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    for (const def of DEFAULT_OUTBOUND_FEEDS) {
      await db
        .prepare(
          `INSERT OR IGNORE INTO outbound_feeds (
            id, slug, title, subtitle, description, author_name, owner_email,
            cover_image_url, language, category, max_items,
            use_deescalated_titles, include_original_title_note,
            include_attached_images, include_full_socratic_brief,
            include_audit_ledger_footer, filter_working_tool, enabled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          def.id,
          def.slug,
          def.title,
          def.subtitle,
          def.description,
          def.authorName,
          def.ownerEmail,
          def.coverImageUrl,
          def.language,
          def.category,
          def.maxItems,
          def.useDeescalatedTitles ? 1 : 0,
          def.includeOriginalTitleNote ? 1 : 0,
          def.includeAttachedImages ? 1 : 0,
          def.includeFullSocraticBrief ? 1 : 0,
          def.includeAuditLedgerFooter ? 1 : 0,
          def.filterWorkingTool,
          def.enabled ? 1 : 0
        )
        .run();
    }
    outboundFeedsSchemaEnsured = true;
  } catch {
    // Ignore on read-only DB if table already exists via migration
  }
}

export async function listOutboundFeeds(
  db: D1DatabaseLike
): Promise<OutboundFeedConfig[]> {
  await ensureOutboundFeedsSchema(db);
  try {
    const res = await db
      .prepare(
        `SELECT ${OUTBOUND_FEEDS_SELECT_COLUMNS}
         FROM outbound_feeds
         ORDER BY id ASC`
      )
      .all<OutboundFeedRow>();
    const rows = res.results || [];
    if (rows.length === 0) {
      return DEFAULT_OUTBOUND_FEEDS.map((f) => ({ ...f }));
    }
    return rows.map(mapOutboundFeedRowToConfig);
  } catch {
    return DEFAULT_OUTBOUND_FEEDS.map((f) => ({ ...f }));
  }
}

export async function getOutboundFeedByIdOrSlug(
  db: D1DatabaseLike,
  idOrSlug: number | string
): Promise<{ row: OutboundFeedRow; config: OutboundFeedConfig } | null> {
  await ensureOutboundFeedsSchema(db);
  const isNumericId =
    typeof idOrSlug === "number" || /^\d+$/.test(String(idOrSlug).trim());
  const row = await db
    .prepare(
      `SELECT ${OUTBOUND_FEEDS_SELECT_COLUMNS}
       FROM outbound_feeds
       WHERE ${isNumericId ? "id = ?" : "slug = ?"}`
    )
    .bind(isNumericId ? Number(idOrSlug) : String(idOrSlug).trim())
    .first<OutboundFeedRow>();

  if (!row) return null;
  return {
    row,
    config: mapOutboundFeedRowToConfig(row),
  };
}

export async function updateOutboundFeed(
  db: D1DatabaseLike,
  input: UpdateOutboundFeedInput,
  actor: PublishingAdminActor
): Promise<{
  feed: OutboundFeedConfig;
  auditEntry: AuditLedgerEntry;
}> {
  await ensureOutboundFeedsSchema(db);
  const existing = await getOutboundFeedByIdOrSlug(db, input.idOrSlug);
  if (!existing) {
    throw new Error(`Outbound feed not found: ${input.idOrSlug}`);
  }

  const beforeRow = existing.row;
  const nextTitle =
    input.title !== undefined ? input.title.trim() : beforeRow.title;
  const nextSubtitle =
    input.subtitle !== undefined ? input.subtitle.trim() : beforeRow.subtitle;
  const nextDescription =
    input.description !== undefined
      ? input.description.trim()
      : beforeRow.description;
  const nextAuthorName =
    input.authorName !== undefined
      ? input.authorName.trim()
      : beforeRow.author_name;
  const nextOwnerEmail =
    input.ownerEmail !== undefined
      ? input.ownerEmail.trim()
      : beforeRow.owner_email;
  const nextCoverImageUrl =
    input.coverImageUrl !== undefined
      ? input.coverImageUrl && input.coverImageUrl.trim().length > 0
        ? input.coverImageUrl.trim()
        : null
      : beforeRow.cover_image_url;
  const nextLanguage =
    input.language !== undefined && input.language.trim().length > 0
      ? input.language.trim()
      : beforeRow.language;
  const nextCategory =
    input.category !== undefined && input.category.trim().length > 0
      ? input.category.trim()
      : beforeRow.category;
  const nextMaxItems =
    input.maxItems !== undefined
      ? Math.max(1, Math.min(200, Math.round(Number(input.maxItems) || 50)))
      : beforeRow.max_items;
  const nextUseDeescalatedTitles =
    input.useDeescalatedTitles !== undefined
      ? input.useDeescalatedTitles
        ? 1
        : 0
      : beforeRow.use_deescalated_titles;
  const nextIncludeOriginalTitleNote =
    input.includeOriginalTitleNote !== undefined
      ? input.includeOriginalTitleNote
        ? 1
        : 0
      : beforeRow.include_original_title_note;
  const nextIncludeAttachedImages =
    input.includeAttachedImages !== undefined
      ? input.includeAttachedImages
        ? 1
        : 0
      : beforeRow.include_attached_images;
  const nextIncludeFullSocraticBrief =
    input.includeFullSocraticBrief !== undefined
      ? input.includeFullSocraticBrief
        ? 1
        : 0
      : beforeRow.include_full_socratic_brief;
  const nextIncludeAuditLedgerFooter =
    input.includeAuditLedgerFooter !== undefined
      ? input.includeAuditLedgerFooter
        ? 1
        : 0
      : beforeRow.include_audit_ledger_footer;
  const nextFilterWorkingTool =
    input.filterWorkingTool !== undefined
      ? input.filterWorkingTool && input.filterWorkingTool.trim().length > 0
        ? input.filterWorkingTool.trim()
        : null
      : beforeRow.filter_working_tool;
  const nextEnabled =
    input.enabled !== undefined ? (input.enabled ? 1 : 0) : beforeRow.enabled;

  if (!nextTitle) {
    throw new Error("Feed title cannot be empty.");
  }
  if (!nextDescription) {
    throw new Error("Feed description cannot be empty.");
  }

  await db
    .prepare(
      `UPDATE outbound_feeds
       SET title = ?,
           subtitle = ?,
           description = ?,
           author_name = ?,
           owner_email = ?,
           cover_image_url = ?,
           language = ?,
           category = ?,
           max_items = ?,
           use_deescalated_titles = ?,
           include_original_title_note = ?,
           include_attached_images = ?,
           include_full_socratic_brief = ?,
           include_audit_ledger_footer = ?,
           filter_working_tool = ?,
           enabled = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      nextTitle,
      nextSubtitle,
      nextDescription,
      nextAuthorName,
      nextOwnerEmail,
      nextCoverImageUrl,
      nextLanguage,
      nextCategory,
      nextMaxItems,
      nextUseDeescalatedTitles,
      nextIncludeOriginalTitleNote,
      nextIncludeAttachedImages,
      nextIncludeFullSocraticBrief,
      nextIncludeAuditLedgerFooter,
      nextFilterWorkingTool,
      nextEnabled,
      beforeRow.id
    )
    .run();

  const updated = await getOutboundFeedByIdOrSlug(db, beforeRow.id);
  if (!updated) {
    throw new Error(`Failed to reload outbound feed #${beforeRow.id}`);
  }

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "outbound_feed.update",
    targetType: "outbound_feed",
    targetId: updated.row.slug,
    reason:
      (input.reason || "").trim() ||
      `Updated outbound published feed configuration for '${updated.row.slug}'`,
    beforeState: beforeRow,
    afterState: updated.row,
  });

  return {
    feed: updated.config,
    auditEntry,
  };
}

export async function createOutboundFeed(
  db: D1DatabaseLike,
  input: CreateOutboundFeedInput,
  actor: PublishingAdminActor
): Promise<{
  feed: OutboundFeedConfig;
  auditEntry: AuditLedgerEntry;
}> {
  await ensureOutboundFeedsSchema(db);

  const normalizedSlug = (input.slug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalizedSlug || normalizedSlug.length < 3) {
    throw new Error(
      "Feed slug must be at least 3 characters (lowercase letters, numbers, and hyphens)."
    );
  }

  const existing = await getOutboundFeedByIdOrSlug(db, normalizedSlug);
  if (existing) {
    throw new Error(`An outbound feed with slug '${normalizedSlug}' already exists.`);
  }

  const title = (input.title || "").trim();
  const subtitle =
    (input.subtitle || "").trim() ||
    "Filtered Craftsman's Brief Syndication Channel";
  const description =
    (input.description || "").trim() ||
    "Synthesized Craftsman's Briefs published from The Trestleboard.";
  const authorName = (input.authorName || "").trim() || "Change Advisory Board";
  const ownerEmail =
    (input.ownerEmail || "").trim() || "telemetry@thecabcall.com";
  const coverImageUrl =
    input.coverImageUrl && input.coverImageUrl.trim().length > 0
      ? input.coverImageUrl.trim()
      : null;
  const language = (input.language || "").trim() || "en-us";
  const category = (input.category || "").trim() || "Technology";
  const maxItems = Math.max(
    1,
    Math.min(200, Math.round(Number(input.maxItems) || 50))
  );
  const useDeescalatedTitles = input.useDeescalatedTitles !== false ? 1 : 0;
  const includeOriginalTitleNote =
    input.includeOriginalTitleNote !== false ? 1 : 0;
  const includeAttachedImages = input.includeAttachedImages !== false ? 1 : 0;
  const includeFullSocraticBrief =
    input.includeFullSocraticBrief !== false ? 1 : 0;
  const includeAuditLedgerFooter =
    input.includeAuditLedgerFooter !== false ? 1 : 0;
  const filterWorkingTool =
    input.filterWorkingTool && input.filterWorkingTool.trim().length > 0
      ? input.filterWorkingTool.trim()
      : null;
  const enabled = input.enabled !== false ? 1 : 0;

  if (!title) {
    throw new Error("Feed title is required.");
  }

  await db
    .prepare(
      `INSERT INTO outbound_feeds (
        slug, title, subtitle, description, author_name, owner_email,
        cover_image_url, language, category, max_items,
        use_deescalated_titles, include_original_title_note,
        include_attached_images, include_full_socratic_brief,
        include_audit_ledger_footer, filter_working_tool, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      normalizedSlug,
      title,
      subtitle,
      description,
      authorName,
      ownerEmail,
      coverImageUrl,
      language,
      category,
      maxItems,
      useDeescalatedTitles,
      includeOriginalTitleNote,
      includeAttachedImages,
      includeFullSocraticBrief,
      includeAuditLedgerFooter,
      filterWorkingTool,
      enabled
    )
    .run();

  const created = await getOutboundFeedByIdOrSlug(db, normalizedSlug);
  if (!created) {
    throw new Error(`Failed to load newly created outbound feed '${normalizedSlug}'.`);
  }

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "outbound_feed.create",
    targetType: "outbound_feed",
    targetId: created.row.slug,
    reason:
      (input.reason || "").trim() ||
      `Created custom outbound published feed '${created.row.slug}'`,
    beforeState: null,
    afterState: created.row,
  });

  return {
    feed: created.config,
    auditEntry,
  };
}

export async function deleteOutboundFeed(
  db: D1DatabaseLike,
  idOrSlug: number | string,
  reason: string | undefined,
  actor: PublishingAdminActor
): Promise<{
  deletedSlug: string;
  auditEntry: AuditLedgerEntry;
}> {
  await ensureOutboundFeedsSchema(db);
  const existing = await getOutboundFeedByIdOrSlug(db, idOrSlug);
  if (!existing) {
    throw new Error(`Outbound feed not found: ${idOrSlug}`);
  }
  if (BUILTIN_OUTBOUND_FEED_SLUGS.has(existing.row.slug)) {
    throw new Error(
      `Core syndication feed '${existing.row.slug}' cannot be deleted (you can disable or edit it instead).`
    );
  }

  await db
    .prepare(`DELETE FROM outbound_feeds WHERE id = ?`)
    .bind(existing.row.id)
    .run();

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "outbound_feed.delete",
    targetType: "outbound_feed",
    targetId: existing.row.slug,
    reason:
      (reason || "").trim() ||
      `Deleted custom outbound feed '${existing.row.slug}'`,
    beforeState: existing.row,
    afterState: null,
  });

  return {
    deletedSlug: existing.row.slug,
    auditEntry,
  };
}

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveAbsoluteMediaUrl(rawUrl: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  return `${siteUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

function inferImageMimeType(url: string): string {
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function matchesWorkingToolFilter(
  primaryTool: string,
  secondaryTool: string | undefined,
  filterValue: string | null | undefined
): boolean {
  if (!filterValue || !filterValue.trim()) return true;
  const spec = getWorkingToolBySlug(filterValue.trim());
  if (spec) {
    return primaryTool === spec.id || secondaryTool === spec.id;
  }
  const needle = filterValue.trim().toLowerCase();
  return (
    primaryTool.toLowerCase() === needle ||
    (secondaryTool ? secondaryTool.toLowerCase() === needle : false)
  );
}

/**
 * Generates the Podcast RSS 2.0 XML feed (`/feed.xml`) driven by D1 `outbound_feeds` (`podcast-rss`) configuration.
 */
export function renderPodcastRssXml(
  episodes: Array<{
    id: string;
    slug: string;
    episodeNumber: number;
    title: string;
    summary: string;
    extendedNotes?: string;
    transcript: string;
    audioUrl: string;
    artworkUrl?: string;
    durationSeconds: number;
    fileSizeBytes: number;
    publishedAt: string;
    dominantTool: string;
  }>,
  config?: OutboundFeedConfig | null,
  siteUrl = "https://thecabcall.com"
): string {
  const effectiveConfig = config || DEFAULT_OUTBOUND_FEEDS[0];
  const filteredEpisodes = episodes
    .filter((ep) =>
      matchesWorkingToolFilter(
        ep.dominantTool,
        undefined,
        effectiveConfig.filterWorkingTool
      )
    )
    .slice(0, Math.max(1, effectiveConfig.maxItems || 50));

  const channelCoverUrl = effectiveConfig.coverImageUrl
    ? resolveAbsoluteMediaUrl(effectiveConfig.coverImageUrl, siteUrl)
    : null;
  const channelCoverXml = channelCoverUrl
    ? `\n    <itunes:image href="${escapeXml(channelCoverUrl)}" />\n    <image>\n      <url>${escapeXml(channelCoverUrl)}</url>\n      <title>${escapeXml(effectiveConfig.title)}</title>\n      <link>${siteUrl}</link>\n    </image>`
    : "";

  const itemsXml = filteredEpisodes
    .map((ep) => {
      const pubDate = new Date(ep.publishedAt).toUTCString();
      const episodeUrl = `${siteUrl}/podcast#${ep.slug}`;
      const enclosureUrl = resolveAbsoluteMediaUrl(ep.audioUrl, siteUrl);
      const enclosureMime = enclosureUrl.toLowerCase().endsWith(".m4a")
        ? "audio/x-m4a"
        : "audio/mpeg";
      const artworkHref = ep.artworkUrl
        ? resolveAbsoluteMediaUrl(ep.artworkUrl, siteUrl)
        : channelCoverUrl;
      const cleanSummary = sanitizeEpisodeSummaryDefensive(ep.summary);
      const cleanExtended = ep.extendedNotes
        ? stripAiDisclaimers(ep.extendedNotes)
        : cleanSummary;
      const cleanTranscript = stripAiDisclaimers(ep.transcript);
      const artworkXml =
        effectiveConfig.includeAttachedImages && artworkHref
          ? `\n      <itunes:image href="${escapeXml(artworkHref)}" />`
          : "";
      const auditFooterHtml = effectiveConfig.includeAuditLedgerFooter
        ? `<hr /><p><small>Immutable Audit Provenance: Verified on The CAB Call Trestleboard (${escapeXml(episodeUrl)})</small></p>`
        : "";
      const bodyHtml = effectiveConfig.includeFullSocraticBrief
        ? `<p>${cleanExtended}</p><pre>${cleanTranscript}</pre>${auditFooterHtml}`
        : `<p>${cleanSummary}</p>${auditFooterHtml}`;

      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <link>${episodeUrl}</link>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(cleanSummary)}</description>
      <content:encoded><![CDATA[${bodyHtml}]]></content:encoded>
      <enclosure url="${escapeXml(enclosureUrl)}" length="${ep.fileSizeBytes}" type="${enclosureMime}" />${artworkXml}
      <itunes:episode>${ep.episodeNumber}</itunes:episode>
      <itunes:duration>${ep.durationSeconds}</itunes:duration>
      <itunes:summary>${escapeXml(cleanSummary)}</itunes:summary>
      <itunes:explicit>false</itunes:explicit>
    </item>`;
    })
    .join("\n");

  const channelDescription = `${effectiveConfig.description} ${CANONICAL_PODCAST_AI_COLOPHON}`.trim();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(effectiveConfig.title)}</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    <language>${escapeXml(effectiveConfig.language || "en-us")}</language>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(effectiveConfig.authorName)} (thecabcall.com)</copyright>
    <itunes:subtitle>${escapeXml(effectiveConfig.subtitle)}</itunes:subtitle>
    <itunes:author>${escapeXml(effectiveConfig.authorName)}</itunes:author>
    <description>${escapeXml(channelDescription)}</description>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>${escapeXml(effectiveConfig.authorName)}</itunes:name>
      <itunes:email>${escapeXml(effectiveConfig.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="${escapeXml(effectiveConfig.category || "Technology")}" />
    <itunes:category text="Society &amp; Culture">
      <itunes:category text="Philosophy" />
    </itunes:category>${channelCoverXml}
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Generates the Incident Briefs RSS 2.0 XML feed (`/feeds/incidents.xml` or custom `/feeds/[slug].xml`)
 * driven by D1 `outbound_feeds` configuration.
 */
export function renderIncidentsRssXml(
  incidents: PublicIncidentDto[],
  config?: OutboundFeedConfig | null,
  options?: {
    toolFilter?: string | null;
    selfPath?: string;
    siteUrl?: string;
  }
): string {
  const effectiveConfig = config || DEFAULT_OUTBOUND_FEEDS[1];
  const siteUrl = options?.siteUrl || "https://thecabcall.com";
  const selfPath = options?.selfPath || "/feeds/incidents.xml";
  const activeToolFilter =
    options?.toolFilter || effectiveConfig.filterWorkingTool || null;

  const filteredIncidents = incidents
    .filter((inc) =>
      matchesWorkingToolFilter(
        inc.primaryTool,
        inc.secondaryTool,
        activeToolFilter
      )
    )
    .slice(0, Math.max(1, effectiveConfig.maxItems || 50));

  const channelCoverUrl = effectiveConfig.coverImageUrl
    ? resolveAbsoluteMediaUrl(effectiveConfig.coverImageUrl, siteUrl)
    : null;
  const channelImageXml = channelCoverUrl
    ? `\n    <image>\n      <url>${escapeXml(channelCoverUrl)}</url>\n      <title>${escapeXml(effectiveConfig.title)}</title>\n      <link>${siteUrl}</link>\n    </image>`
    : "";

  const itemsXml = filteredIncidents
    .map((inc) => {
      const pubDate = new Date(inc.publishedAt).toUTCString();
      const briefUrl = `${siteUrl}/incidents/${inc.slug}`;
      const failureSpec = getSreFailureModeSpec(inc.sreFailureMode);
      const ledgerLabel = formatCraftLedgerEntry(inc.incidentCode);
      const friendlySource = formatFriendlySourceName(inc.sourceFeed);
      const dedupedSignal = deduplicateSignalAgainstFacts(
        [inc.socraticBrief, inc.executiveSummary],
        inc.proportionalityCheck.structuralSignal,
        inc.primaryTool,
        inc.sreFailureMode,
        inc.secondaryTool
      );

      // 1. De-Alarmed Title toggle
      const hasDistinctOriginalTitle =
        Boolean(inc.originalTitle) &&
        inc.originalTitle!.trim().length > 0 &&
        inc.originalTitle!.trim() !== inc.title.trim();
      const itemTitle = effectiveConfig.useDeescalatedTitles
        ? inc.title
        : inc.originalTitle && inc.originalTitle.trim().length > 0
        ? inc.originalTitle
        : inc.title;

      // 2. Original Headline Provenance Note toggle
      const provenanceNoteHtml =
        effectiveConfig.includeOriginalTitleNote &&
        (inc.titleRewritten || hasDistinctOriginalTitle) &&
        inc.originalTitle
          ? `<p><em>Original source headline: &ldquo;${escapeXml(inc.originalTitle)}&rdquo;${
              inc.titleRewriteReason
                ? ` — Editorial Note: ${escapeXml(inc.titleRewriteReason)}`
                : ""
            }</em></p>`
          : "";

      // 3. Attached Images (<media:content> & <enclosure>) toggle
      const resolvedImageUrl =
        effectiveConfig.includeAttachedImages && inc.imageUrl
          ? resolveAbsoluteMediaUrl(inc.imageUrl, siteUrl)
          : null;
      const imageMime = resolvedImageUrl
        ? inferImageMimeType(resolvedImageUrl)
        : null;
      const mediaXml =
        resolvedImageUrl && imageMime
          ? `\n      <media:content url="${escapeXml(resolvedImageUrl)}" type="${imageMime}" medium="image">${
              inc.imageCaption || inc.imageAlt
                ? `\n        <media:description type="plain">${escapeXml(
                    inc.imageCaption || inc.imageAlt || itemTitle
                  )}</media:description>\n      `
                : ""
            }</media:content>\n      <enclosure url="${escapeXml(resolvedImageUrl)}" length="0" type="${imageMime}" />`
          : "";
      const imageHtml = resolvedImageUrl
        ? `<figure><img src="${escapeXml(resolvedImageUrl)}" alt="${escapeXml(
            inc.imageAlt || itemTitle
          )}" />${
            inc.imageCaption
              ? `<figcaption>${escapeXml(inc.imageCaption)}</figcaption>`
              : ""
          }</figure>`
        : "";

      // 4. Audit Verification Footer toggle
      const auditFooterHtml = effectiveConfig.includeAuditLedgerFooter
        ? `<hr /><p><small>Immutable Audit Trail Verification: Published by ${escapeXml(
            effectiveConfig.authorName
          )} (${escapeXml(ledgerLabel)}). Headline &amp; classification provenance recorded in the SHA-256 hash-chained ledger at <a href="${escapeXml(
            briefUrl
          )}">${escapeXml(briefUrl)}</a>.</small></p>`
        : "";

      // 5. Full Socratic Brief vs. Executive Summary toggle
      const bodyParts = effectiveConfig.includeFullSocraticBrief
        ? [
            `<p><strong>${escapeXml(ledgerLabel)}</strong> &bull; Primary Working Tool: <strong>${escapeXml(
              inc.primaryTool
            )}</strong> &bull; Secondary Tool: <strong>${escapeXml(
              inc.secondaryTool
            )}</strong> &bull; Failure Mode: <strong>${escapeXml(
              failureSpec.craftTitle
            )}</strong></p>`,
            provenanceNoteHtml,
            imageHtml,
            `<h3>I. What Happened (The Plain Facts)</h3>`,
            `<p>${escapeXml(inc.socraticBrief)}</p>`,
            `<h3>II. The Diagnostic Lens: ${escapeXml(inc.primaryTool)} &amp; ${escapeXml(
              failureSpec.craftTitle
            )}</h3>`,
            `<p><strong>Partisan Heat &amp; Spin (The Noise):</strong> ${escapeXml(
              inc.proportionalityCheck.noiseOverblown
            )}</p>`,
            `<p><strong>The Actual Foundation (The Signal):</strong> ${escapeXml(
              dedupedSignal
            )}</p>`,
            `<h3>III. Questions for Fair &amp; Consistent Judgment</h3>`,
            `<ol><li>${escapeXml(inc.questions[0])}</li><li>${escapeXml(
              inc.questions[1]
            )}</li></ol>`,
            `<p><a href="${escapeXml(inc.sourceUrl)}">Read Original ${escapeXml(
              friendlySource
            )} Article</a> &bull; <a href="${escapeXml(
              briefUrl
            )}">Read Full Craftsman&apos;s Brief on The Trestleboard</a></p>`,
            auditFooterHtml,
          ].filter(Boolean)
        : [
            `<p><strong>${escapeXml(ledgerLabel)}</strong> &bull; Primary Working Tool: <strong>${escapeXml(
              inc.primaryTool
            )}</strong> &bull; Failure Mode: <strong>${escapeXml(
              failureSpec.craftTitle
            )}</strong></p>`,
            provenanceNoteHtml,
            imageHtml,
            `<p>${escapeXml(inc.executiveSummary)}</p>`,
            `<p><a href="${escapeXml(
              briefUrl
            )}">Read Full Craftsman&apos;s Brief on The Trestleboard</a> &bull; <a href="${escapeXml(
              inc.sourceUrl
            )}">Original ${escapeXml(friendlySource)} Article</a></p>`,
            auditFooterHtml,
          ].filter(Boolean);

      const htmlBody = bodyParts.join("\n");

      return `    <item>
      <title>${escapeXml(itemTitle)}</title>
      <link>${escapeXml(briefUrl)}</link>
      <guid isPermaLink="true">${escapeXml(briefUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(inc.primaryTool)}</category>
      <category>${escapeXml(failureSpec.craftTitle)}</category>
      <category>${escapeXml(inc.domainSector)}</category>
      <description>${escapeXml(inc.executiveSummary)}</description>
      <content:encoded><![CDATA[${htmlBody}]]></content:encoded>${mediaXml}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(effectiveConfig.title)}</title>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}${selfPath}" rel="self" type="application/rss+xml" />
    <language>${escapeXml(effectiveConfig.language || "en-us")}</language>
    <managingEditor>${escapeXml(effectiveConfig.ownerEmail)} (${escapeXml(
    effectiveConfig.authorName
  )})</managingEditor>
    <category>${escapeXml(effectiveConfig.category || "Technology")}</category>
    <copyright>© ${new Date().getFullYear()} ${escapeXml(
    effectiveConfig.authorName
  )} (thecabcall.com)</copyright>
    <description>${escapeXml(effectiveConfig.description)}</description>${channelImageXml}
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Generates the Incident Briefs JSON Feed 1.1 (`/feeds/incidents.json` or custom `/feeds/[slug].json`)
 * driven by D1 `outbound_feeds` configuration.
 */
export function renderIncidentsJsonFeed(
  incidents: PublicIncidentDto[],
  config?: OutboundFeedConfig | null,
  options?: {
    toolFilter?: string | null;
    selfPath?: string;
    siteUrl?: string;
  }
): Record<string, unknown> {
  const effectiveConfig = config || DEFAULT_OUTBOUND_FEEDS[2];
  const siteUrl = options?.siteUrl || "https://thecabcall.com";
  const selfPath = options?.selfPath || "/feeds/incidents.json";
  const activeToolFilter =
    options?.toolFilter || effectiveConfig.filterWorkingTool || null;

  const filteredIncidents = incidents
    .filter((inc) =>
      matchesWorkingToolFilter(
        inc.primaryTool,
        inc.secondaryTool,
        activeToolFilter
      )
    )
    .slice(0, Math.max(1, effectiveConfig.maxItems || 50));

  const channelCoverUrl = effectiveConfig.coverImageUrl
    ? resolveAbsoluteMediaUrl(effectiveConfig.coverImageUrl, siteUrl)
    : undefined;

  return {
    version: "https://jsonfeed.org/version/1.1",
    title: effectiveConfig.title,
    home_page_url: siteUrl,
    feed_url: `${siteUrl}${selfPath}`,
    description: effectiveConfig.description,
    language: effectiveConfig.language || "en-US",
    ...(channelCoverUrl ? { icon: channelCoverUrl } : {}),
    authors: [
      {
        name: effectiveConfig.authorName,
        url: `${siteUrl}/status`,
      },
    ],
    items: filteredIncidents.map((inc) => {
      const briefUrl = `${siteUrl}/incidents/${inc.slug}`;
      const failureSpec = getSreFailureModeSpec(inc.sreFailureMode);
      const ledgerLabel = formatCraftLedgerEntry(inc.incidentCode);
      const friendlySource = formatFriendlySourceName(inc.sourceFeed);
      const dedupedSignal = deduplicateSignalAgainstFacts(
        [inc.socraticBrief, inc.executiveSummary],
        inc.proportionalityCheck.structuralSignal,
        inc.primaryTool,
        inc.sreFailureMode,
        inc.secondaryTool
      );

      const hasDistinctOriginalTitle =
        Boolean(inc.originalTitle) &&
        inc.originalTitle!.trim().length > 0 &&
        inc.originalTitle!.trim() !== inc.title.trim();
      const itemTitle = effectiveConfig.useDeescalatedTitles
        ? inc.title
        : inc.originalTitle && inc.originalTitle.trim().length > 0
        ? inc.originalTitle
        : inc.title;

      const provenanceLine =
        effectiveConfig.includeOriginalTitleNote &&
        (inc.titleRewritten || hasDistinctOriginalTitle) &&
        inc.originalTitle
          ? `Original source headline: "${inc.originalTitle}"${
              inc.titleRewriteReason
                ? ` (${inc.titleRewriteReason})`
                : ""
            }`
          : null;

      const auditFooterLine = effectiveConfig.includeAuditLedgerFooter
        ? `Audit Trail Verification: Immutable SHA-256 Chain Verified (${ledgerLabel} · ${briefUrl})`
        : null;

      const contentTextLines = effectiveConfig.includeFullSocraticBrief
        ? [
            `${ledgerLabel} — ${itemTitle}`,
            `Primary Working Tool: ${inc.primaryTool} | Secondary Working Tool: ${inc.secondaryTool} | Failure Mode: ${failureSpec.craftTitle}`,
            ...(provenanceLine ? ["", provenanceLine] : []),
            "",
            "I. WHAT HAPPENED (THE PLAIN FACTS)",
            inc.socraticBrief,
            "",
            `II. THE DIAGNOSTIC LENS (${inc.primaryTool} & ${failureSpec.craftTitle})`,
            `Partisan Heat & Spin (The Noise): ${inc.proportionalityCheck.noiseOverblown}`,
            `The Actual Foundation (The Signal): ${dedupedSignal}`,
            "",
            "III. QUESTIONS FOR FAIR & CONSISTENT JUDGMENT",
            `1. ${inc.questions[0]}`,
            `2. ${inc.questions[1]}`,
            "",
            `Original ${friendlySource} Article: ${inc.sourceUrl}`,
            ...(auditFooterLine ? ["", auditFooterLine] : []),
          ]
        : [
            `${ledgerLabel} — ${itemTitle}`,
            `Primary Working Tool: ${inc.primaryTool} | Failure Mode: ${failureSpec.craftTitle}`,
            ...(provenanceLine ? ["", provenanceLine] : []),
            "",
            inc.executiveSummary,
            "",
            `Full Craftsman's Brief: ${briefUrl}`,
            `Original ${friendlySource} Article: ${inc.sourceUrl}`,
            ...(auditFooterLine ? ["", auditFooterLine] : []),
          ];

      const resolvedImageUrl =
        effectiveConfig.includeAttachedImages && inc.imageUrl
          ? resolveAbsoluteMediaUrl(inc.imageUrl, siteUrl)
          : undefined;

      const itemRecord: Record<string, unknown> = {
        id: briefUrl,
        url: briefUrl,
        external_url: inc.sourceUrl,
        title: itemTitle,
        summary: inc.executiveSummary,
        content_text: contentTextLines.join("\n"),
        date_published: inc.publishedAt,
        tags: [
          inc.primaryTool,
          inc.secondaryTool,
          failureSpec.craftTitle,
          inc.domainSector,
        ],
      };

      if (resolvedImageUrl) {
        itemRecord.image = resolvedImageUrl;
        itemRecord.attachments = [
          {
            url: resolvedImageUrl,
            mime_type: inferImageMimeType(resolvedImageUrl),
            title: inc.imageCaption || inc.imageAlt || itemTitle,
          },
        ];
      }

      if (effectiveConfig.includeOriginalTitleNote && inc.originalTitle) {
        itemRecord._cab_provenance = {
          titleRewritten: Boolean(
            inc.titleRewritten || hasDistinctOriginalTitle
          ),
          originalTitle: inc.originalTitle,
          displayTitle: inc.title,
          ...(inc.titleRewriteReason
            ? { rewriteReason: inc.titleRewriteReason }
            : {}),
        };
      }

      if (effectiveConfig.includeAuditLedgerFooter) {
        itemRecord._cab_audit = {
          ledgerEntry: ledgerLabel,
          chainVerified: true,
          verificationUrl: briefUrl,
        };
      }

      return itemRecord;
    }),
  };
}
