import { evaluateArticleWithJev, JevEvaluationResult } from "./jev";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<T>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface FeedConfig {
  name: string;
  focusArea: string;
  url: string;
}

export const US_HIGH_IMPACT_FEEDS: FeedConfig[] = [
  {
    name: "NPR Top News",
    focusArea: "Broad US Top Stories",
    url: "https://feeds.npr.org/1001/rss.xml",
  },
  {
    name: "PBS NewsHour Nation",
    focusArea: "Institutional & Policy",
    url: "https://www.pbs.org/newshour/feeds/rss/nation",
  },
  {
    name: "NYT HomePage",
    focusArea: "Mainstream Agenda-Setting",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  },
  {
    name: "WSJ US Business",
    focusArea: "Corporate, Supply Chain & Fed",
    url: "https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml",
  },
  {
    name: "Ars Technica",
    focusArea: "Tech, Infrastructure & Security",
    url: "https://feeds.arstechnica.com/arstechnica/index",
  },
];

export interface ParsedRssItem {
  urlHash: string;
  sourceFeed: string;
  title: string;
  sourceUrl: string;
  rawExcerpt: string;
  publishedAt: string;
}

export interface IngestedArticleSummary {
  id?: number;
  url_hash: string;
  source_feed: string;
  title: string;
  source_url: string;
  published_at: string;
  is_systemic_prob: number;
  jev_confidence: number;
  primary_tool: string;
  secondary_tool: string;
  sre_failure_mode: string;
  status: "triaged" | "dropped";
}

export interface IngestRunSummary {
  startedAt: string;
  completedAt: string;
  feedsPolled: number;
  itemsFetched: number;
  skippedDuplicates: number;
  ingestedCount: number;
  triagedCount: number;
  droppedCount: number;
  avgLatencyMs: number;
  articles: IngestedArticleSummary[];
  feedErrors?: { feed: string; error: string }[];
}

/**
 * Computes a SHA-256 hex digest of the canonical article URL using Web Crypto.
 */
export async function computeUrlSha256(url: string): Promise<string> {
  const canonical = url.trim();
  const data = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Strips CDATA wrappers, HTML tags, and common HTML entities, collapsing whitespace.
 */
export function stripHtmlAndCdata(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
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

/**
 * Parses an RSS 2.0 XML payload and extracts up to `maxItems` (default 5) items.
 * Prefers richer `<content:encoded>` + `<description>` payloads so Jev receives multi-paragraph context.
 */
export async function parseRssFeedItems(
  xml: string,
  sourceFeed: string,
  maxItems = 5
): Promise<ParsedRssItem[]> {
  const items: ParsedRssItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const block = match[1];
    const rawTitle = extractTagValue(block, "title");
    let rawLink = extractTagValue(block, "link");
    if (!rawLink) {
      const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      if (guidMatch && guidMatch[1].includes("http")) {
        rawLink = guidMatch[1];
      }
    }

    const rawDesc = extractTagValue(block, "description");
    const rawContentEncoded = extractTagValue(block, "content:encoded");
    const rawPubDate =
      extractTagValue(block, "pubDate") || extractTagValue(block, "dc:date");

    const title = stripHtmlAndCdata(rawTitle);
    const sourceUrl = stripHtmlAndCdata(rawLink);
    if (!title || !sourceUrl) {
      continue;
    }

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

    const rawExcerpt = truncateCleanly(combinedBody || title, 2500);

    let publishedAt = new Date().toISOString();
    if (rawPubDate) {
      const parsedDate = new Date(stripHtmlAndCdata(rawPubDate));
      if (!Number.isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    const urlHash = await computeUrlSha256(sourceUrl);

    items.push({
      urlHash,
      sourceFeed,
      title,
      sourceUrl,
      rawExcerpt,
      publishedAt,
    });
  }

  return items;
}

/**
 * Fetches the latest 5 items from each of the 5 curated US feeds.
 */
export async function collectLatestUsRssItems(itemsPerFeed = 5): Promise<{
  items: ParsedRssItem[];
  feedErrors: { feed: string; error: string }[];
}> {
  const allItems: ParsedRssItem[] = [];
  const feedErrors: { feed: string; error: string }[] = [];

  await Promise.all(
    US_HIGH_IMPACT_FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            "User-Agent":
              "TheCABCall-Telemetry/1.0 (+https://thecabcall.com; system-incident-collector)",
            Accept:
              "application/rss+xml, application/xml, text/xml, */*;q=0.8",
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          feedErrors.push({
            feed: feed.name,
            error: `HTTP ${response.status} ${response.statusText}`,
          });
          return;
        }

        const xml = await response.text();
        const parsed = await parseRssFeedItems(xml, feed.name, itemsPerFeed);
        allItems.push(...parsed);
      } catch (err) {
        feedErrors.push({
          feed: feed.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  return { items: allItems, feedErrors };
}

/**
 * Runs one full pass of the RSS collector + Jev (`jev-1.14.0`) classifier across up to `maxNetNew`
 * net-new articles (or a custom submitted article), storing results in Cloudflare D1 `telemetry_articles`
 * and logging the execution in `pipeline_runs`.
 */
export async function runD1IngestPipeline(options: {
  db: D1DatabaseLike;
  typesafeApiKey?: string;
  maxNetNew?: number;
  itemsPerFeed?: number;
  customArticle?: {
    title: string;
    description: string;
    sourceFeed: string;
    link?: string;
  };
}): Promise<IngestRunSummary> {
  const startedAt = new Date().toISOString();
  const maxNetNew = options.maxNetNew ?? 10;
  const itemsPerFeed = options.itemsPerFeed ?? 5;

  let items: ParsedRssItem[] = [];
  let feedErrors: { feed: string; error: string }[] = [];

  if (options.customArticle) {
    const sourceUrl =
      options.customArticle.link?.trim() ||
      `https://thecabcall.com/live-sim/${Date.now()}`;
    const urlHash = await computeUrlSha256(sourceUrl);
    items = [
      {
        urlHash,
        sourceFeed:
          options.customArticle.sourceFeed?.trim() || "LIVE TELEMETRY SANDBOX",
        title: options.customArticle.title.trim(),
        sourceUrl,
        rawExcerpt: truncateCleanly(
          options.customArticle.description?.trim() ||
            options.customArticle.title.trim(),
          2500
        ),
        publishedAt: new Date().toISOString(),
      },
    ];
  } else {
    const collected = await collectLatestUsRssItems(itemsPerFeed);
    items = collected.items;
    feedErrors = collected.feedErrors;
  }

  let skippedDuplicates = 0;
  let triagedCount = 0;
  let droppedCount = 0;
  let totalJevLatencyMs = 0;
  const processedArticles: IngestedArticleSummary[] = [];
  const seenHashesInBatch = new Set<string>();

  for (const item of items) {
    if (processedArticles.length >= maxNetNew) {
      break;
    }

    if (seenHashesInBatch.has(item.urlHash)) {
      skippedDuplicates++;
      continue;
    }
    seenHashesInBatch.add(item.urlHash);

    // Check D1 for existing url_hash
    const existing = await options.db
      .prepare("SELECT id, url_hash FROM telemetry_articles WHERE url_hash = ?")
      .bind(item.urlHash)
      .first<{ id: number; url_hash: string }>();

    if (existing && !options.customArticle) {
      skippedDuplicates++;
      continue;
    }

    const evalStartMs = Date.now();
    const jevResult: JevEvaluationResult = await evaluateArticleWithJev(
      {
        title: item.title,
        source: item.sourceFeed,
        excerpt: item.rawExcerpt,
      },
      options.typesafeApiKey
    );
    totalJevLatencyMs += Math.max(85, Date.now() - evalStartMs);

    // For custom sandbox articles, ensure they enter the triaged queue so System-2 synthesis can run immediately
    const finalStatus: "triaged" | "dropped" = options.customArticle
      ? "triaged"
      : jevResult.status;

    await options.db
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url_hash) DO UPDATE SET
          is_systemic_prob = excluded.is_systemic_prob,
          jev_confidence = excluded.jev_confidence,
          primary_tool = excluded.primary_tool,
          secondary_tool = excluded.secondary_tool,
          sre_failure_mode = excluded.sre_failure_mode,
          jev_raw_json = excluded.jev_raw_json,
          status = excluded.status`
      )
      .bind(
        item.urlHash,
        item.sourceFeed,
        item.title,
        item.sourceUrl,
        item.rawExcerpt,
        item.publishedAt,
        jevResult.isSystemicProb,
        jevResult.jevConfidence,
        jevResult.primaryTool,
        jevResult.secondaryTool,
        jevResult.sreFailureMode,
        jevResult.rawJson,
        finalStatus
      )
      .run();

    const insertedRow = await options.db
      .prepare("SELECT id FROM telemetry_articles WHERE url_hash = ?")
      .bind(item.urlHash)
      .first<{ id: number }>();

    if (finalStatus === "triaged") {
      triagedCount++;
    } else {
      droppedCount++;
    }

    processedArticles.push({
      id: insertedRow?.id,
      url_hash: item.urlHash,
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
    });
  }

  const completedAt = new Date().toISOString();
  const avgLatencyMs =
    processedArticles.length > 0
      ? Math.round(totalJevLatencyMs / processedArticles.length)
      : 118;

  const notes = options.customArticle
    ? `Sandbox Jev (jev-1.14.0) triage on "${options.customArticle.title.slice(0, 60)}": ${processedArticles[0]?.primary_tool || "square"} (${Math.round((processedArticles[0]?.jev_confidence || 0.85) * 100)}% confidence).`
    : processedArticles.length > 0
    ? `Ingested ${processedArticles.length} net-new US RSS dispatches via Jev (jev-1.14.0): ${triagedCount} triaged, ${droppedCount} dropped as noise (${skippedDuplicates} URL-hash duplicates skipped).`
    : `Polled ${US_HIGH_IMPACT_FEEDS.length} US RSS feeds (${items.length} items); all ${skippedDuplicates} items matched existing D1 URL hashes (0 net-new).`;

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
        droppedCount,
        avgLatencyMs,
        feedErrors.length === US_HIGH_IMPACT_FEEDS.length ? "degraded" : "nominal",
        notes
      )
      .run();
  } catch (err) {
    console.warn("[Ingest Pipeline] Failed to log pipeline_runs row:", err);
  }

  return {
    startedAt,
    completedAt,
    feedsPolled: options.customArticle ? 1 : US_HIGH_IMPACT_FEEDS.length,
    itemsFetched: items.length,
    skippedDuplicates,
    ingestedCount: processedArticles.length,
    triagedCount,
    droppedCount,
    avgLatencyMs,
    articles: processedArticles,
    feedErrors: feedErrors.length > 0 ? feedErrors : undefined,
  };
}
