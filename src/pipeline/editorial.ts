import {
  appendAuditEntry,
  AuditAuthMethod,
  AuditLedgerEntry,
} from "./audit";
import { D1DatabaseLike, executeD1Batch, stripHtmlAndCdata } from "./ingest";
import { JevSreFailureModeKey, JevWorkingToolKey } from "./jev";
import { R2BucketLike } from "./rollup";
import {
  buildOrSanitizeArticleDiagnostics,
  normalizeQuestionSentenceCase,
  normalizeStoredQuestionsPayload,
  sanitizeStringConcatenation,
} from "../lib/sanitize";
import {
  DomainSectorId,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SreFailureModeId,
  WorkingToolId,
} from "../lib/taxonomy";

export type ImageSourceType =
  | "rss_extracted"
  | "og_scraped"
  | "wikimedia_commons"
  | "r2_upload"
  | "external_url"
  | "generated_card"
  | "rss"
  | "og"
  | "upload"
  | "svg_card"
  | "none"
  | null;

export type PipelineTransformKey =
  | "auto_deescalate_titles"
  | "auto_extract_rss_images"
  | "auto_generate_fallback_cards"
  | "custom_system2_directive";

export interface PipelineTransformRow {
  id: number;
  transform_key: PipelineTransformKey | string;
  name: string;
  description: string;
  enabled: number;
  config_json: string;
  updated_at: string;
}

export interface PipelineTransformRecord {
  id: number;
  transformKey: PipelineTransformKey | string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  configJson: string;
  updatedAt: string;
}

export interface AdminIncidentRow {
  id: number;
  url_hash: string;
  source_feed: string;
  title: string;
  original_title: string | null;
  title_rewritten: number | null;
  title_rewrite_reason: string | null;
  source_url: string;
  raw_excerpt: string;
  published_at: string;
  ingested_at: string;
  is_systemic_prob: number;
  jev_confidence: number;
  primary_tool: JevWorkingToolKey;
  secondary_tool: JevWorkingToolKey | null;
  sre_failure_mode: JevSreFailureModeKey;
  jev_raw_json: string;
  socratic_brief: string | null;
  questions_json: string | null;
  status: string;
  image_url: string | null;
  image_alt: string | null;
  image_caption: string | null;
  image_source_type: ImageSourceType;
  editorial_notes: string | null;
  is_pinned: number | null;
  is_hidden: number | null;
}

export interface AdminIncidentRecord {
  id: number;
  incidentId: string;
  incidentCode: string;
  slug: string;
  urlHash: string;
  sourceFeed: string;
  title: string;
  originalTitle: string;
  titleRewritten: boolean;
  titleRewriteReason: string | null;
  sourceUrl: string;
  rawExcerpt: string;
  publishedAt: string;
  ingestedAt: string;
  domainSector: DomainSectorId;
  isSystemicProb: number;
  jevConfidence: number;
  primaryToolKey: JevWorkingToolKey;
  secondaryToolKey: JevWorkingToolKey;
  sreFailureModeKey: JevSreFailureModeKey;
  primaryTool: WorkingToolId;
  secondaryTool: WorkingToolId;
  sreFailureMode: SreFailureModeId;
  executiveSummary: string;
  socraticBrief: string;
  proportionalityCheck: {
    noiseOverblown: string;
    structuralSignal: string;
  };
  questions: [string, string];
  status: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCaption: string | null;
  imageSourceType: ImageSourceType;
  editorialNotes: string | null;
  isPinned: boolean;
  isHidden: boolean;
  isLeadPostMortem: boolean;
  leadPostMortemAnalysis: string | null;
}

export interface EditorialAdminActor {
  actorEmail: string;
  actorRole?: string;
  authMethod: AuditAuthMethod;
  actorIpHash?: string | null;
}

export interface HeadlineDeescalationResult {
  originalTitle: string;
  neutralTitle: string;
  rationale: string;
  wasAlarmist: boolean;
  changed: boolean;
  modelUsed: string;
}

export const ADMIN_INCIDENT_COLUMNS = `
  id,
  url_hash,
  source_feed,
  title,
  original_title,
  title_rewritten,
  title_rewrite_reason,
  source_url,
  raw_excerpt,
  published_at,
  ingested_at,
  is_systemic_prob,
  jev_confidence,
  primary_tool,
  secondary_tool,
  sre_failure_mode,
  jev_raw_json,
  socratic_brief,
  questions_json,
  status,
  image_url,
  image_alt,
  image_caption,
  image_source_type,
  editorial_notes,
  is_pinned,
  is_hidden
`;

export const PIPELINE_TRANSFORMS_COLUMNS = `
  id,
  transform_key,
  name,
  description,
  enabled,
  config_json,
  updated_at
`;

const DEFAULT_PIPELINE_TRANSFORMS: Array<{
  id: number;
  transform_key: PipelineTransformKey;
  name: string;
  description: string;
  enabled: number;
  config_json: string;
}> = [
  {
    id: 1,
    transform_key: "auto_deescalate_titles",
    name: "Auto De-Escalate Alarmist Headlines",
    description:
      "Automatically rewrites alarmist, partisan, or clickbait headlines during System-2 synthesis into neutral, operational SRE incident titles while preserving original_title for audit disclosure.",
    enabled: 1,
    config_json: JSON.stringify({
      mode: "alarmist_only",
      stripAllCaps: true,
      preserveOriginalInAudit: true,
    }),
  },
  {
    id: 2,
    transform_key: "auto_extract_rss_images",
    name: "Auto Extract Source RSS Media & Images",
    description:
      'Extracts <media:content>, <media:thumbnail>, <enclosure type="image/*">, or <img> URLs from RSS/Atom items during ingestion and attaches them to telemetry_articles.',
    enabled: 1,
    config_json: JSON.stringify({
      requireHttps: true,
      extractFromHtmlImg: true,
    }),
  },
  {
    id: 3,
    transform_key: "auto_generate_fallback_cards",
    name: "Auto Generate Working Tool Telemetry Cards",
    description:
      "Attaches a dynamic SVG Working Tool + Structural Failure Mode visual telemetry card when an incident has no extracted or uploaded source image.",
    enabled: 0,
    config_json: JSON.stringify({
      cardStyle: "blueprint_brass",
      includeIncidentCode: true,
    }),
  },
  {
    id: 4,
    transform_key: "custom_system2_directive",
    name: "Custom System-2 Synthesis Directive",
    description:
      "Custom editorial prompt addendum injected into Gemini System-2 synthesis for bespoke analytical framing.",
    enabled: 0,
    config_json: JSON.stringify({
      directive:
        "Emphasize verifiable physical-layer and statutory control loops over speculative commentary.",
    }),
  },
];

const editorialSchemaVerifiedDbs = new WeakSet<D1DatabaseLike>();

/**
 * Ensures `telemetry_articles` has all Issue #11 editorial/image columns and
 * `pipeline_transforms` exists and is seeded with the 4 baseline transforms.
 */
export async function ensureEditorialPipelineSchema(
  db: D1DatabaseLike
): Promise<void> {
  if (editorialSchemaVerifiedDbs.has(db)) {
    return;
  }
  try {
    const check = await db
      .prepare("SELECT COUNT(*) as cnt FROM pipeline_transforms")
      .first<{ cnt: number }>();
    if (check !== null && Number(check.cnt) >= 4) {
      editorialSchemaVerifiedDbs.add(db);
      return;
    }
  } catch {
    // Table does not exist yet; proceed with full schema initialization
  }

  try {
    const pragmaRes = await db
      .prepare("PRAGMA table_info(telemetry_articles)")
      .all<{ name: string }>();
    const existingCols = new Set(
      (pragmaRes.results || []).map((c) => c.name.toLowerCase())
    );

    const alterSpecs: Array<[string, string]> = [
      ["original_title", "TEXT"],
      ["title_rewritten", "INTEGER NOT NULL DEFAULT 0"],
      ["title_rewrite_reason", "TEXT"],
      ["image_url", "TEXT"],
      ["image_alt", "TEXT"],
      ["image_caption", "TEXT"],
      ["image_source_type", "TEXT"],
      ["editorial_notes", "TEXT"],
      ["is_pinned", "INTEGER NOT NULL DEFAULT 0"],
      ["is_hidden", "INTEGER NOT NULL DEFAULT 0"],
    ];

    for (const [colName, colDef] of alterSpecs) {
      if (!existingCols.has(colName)) {
        try {
          await db
            .prepare(
              `ALTER TABLE telemetry_articles ADD COLUMN ${colName} ${colDef}`
            )
            .run();
        } catch {
          // Ignore if concurrently added
        }
      }
    }

    await db
      .prepare(
        `UPDATE telemetry_articles
         SET original_title = title
         WHERE original_title IS NULL OR TRIM(original_title) = ''`
      )
      .run();
  } catch {
    // Ignore on minimal mock DBs
  }

  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS pipeline_transforms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transform_key TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          config_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    const seedStmts = DEFAULT_PIPELINE_TRANSFORMS.map((t) =>
      db
        .prepare(
          `INSERT INTO pipeline_transforms (id, transform_key, name, description, enabled, config_json)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(transform_key) DO NOTHING`
        )
        .bind(
          t.id,
          t.transform_key,
          t.name,
          t.description,
          t.enabled,
          t.config_json
        )
    );
    await executeD1Batch(db, seedStmts);
    editorialSchemaVerifiedDbs.add(db);
  } catch {
    // Ignore on minimal mock DBs
  }
}

export function mapPipelineTransformRow(
  row: PipelineTransformRow
): PipelineTransformRecord {
  let config: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.config_json || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  } catch {
    config = {};
  }

  return {
    id: Number(row.id),
    transformKey: row.transform_key,
    name: row.name,
    description: row.description,
    enabled: Number(row.enabled) === 1,
    config,
    configJson: row.config_json || "{}",
    updatedAt: row.updated_at,
  };
}

export async function listPipelineTransforms(
  db: D1DatabaseLike
): Promise<PipelineTransformRecord[]> {
  await ensureEditorialPipelineSchema(db);
  try {
    const res = await db
      .prepare(
        `SELECT ${PIPELINE_TRANSFORMS_COLUMNS} FROM pipeline_transforms ORDER BY id ASC`
      )
      .all<PipelineTransformRow>();
    const rows = res.results || [];
    if (rows.length === 0) {
      return DEFAULT_PIPELINE_TRANSFORMS.map((r) =>
        mapPipelineTransformRow({
          ...r,
          updated_at: new Date().toISOString(),
        })
      );
    }
    return rows.map(mapPipelineTransformRow);
  } catch {
    return DEFAULT_PIPELINE_TRANSFORMS.map((r) =>
      mapPipelineTransformRow({
        ...r,
        updated_at: new Date().toISOString(),
      })
    );
  }
}

export async function getPipelineTransformMap(
  db: D1DatabaseLike
): Promise<Record<PipelineTransformKey, PipelineTransformRecord>> {
  const list = await listPipelineTransforms(db);
  const map = {} as Record<PipelineTransformKey, PipelineTransformRecord>;
  for (const item of list) {
    map[item.transformKey as PipelineTransformKey] = item;
  }
  return map;
}

export async function updatePipelineTransform(
  db: D1DatabaseLike,
  input: {
    idOrKey: number | string;
    enabled?: boolean;
    name?: string;
    description?: string;
    config?: Record<string, unknown> | string;
    reason?: string;
  },
  actor: EditorialAdminActor
): Promise<{
  transform: PipelineTransformRecord;
  auditEntry: AuditLedgerEntry;
  transforms: PipelineTransformRecord[];
}> {
  await ensureEditorialPipelineSchema(db);

  const isNumericId =
    typeof input.idOrKey === "number" || /^\d+$/.test(String(input.idOrKey));
  const existing = await db
    .prepare(
      isNumericId
        ? `SELECT ${PIPELINE_TRANSFORMS_COLUMNS} FROM pipeline_transforms WHERE id = ?`
        : `SELECT ${PIPELINE_TRANSFORMS_COLUMNS} FROM pipeline_transforms WHERE transform_key = ?`
    )
    .bind(isNumericId ? Number(input.idOrKey) : String(input.idOrKey))
    .first<PipelineTransformRow>();

  if (!existing) {
    throw new Error(`Pipeline transform not found: ${input.idOrKey}`);
  }

  const enabled =
    input.enabled !== undefined
      ? input.enabled
        ? 1
        : 0
      : Number(existing.enabled);
  const name =
    input.name !== undefined && input.name.trim()
      ? input.name.trim()
      : existing.name;
  const description =
    input.description !== undefined && input.description.trim()
      ? input.description.trim()
      : existing.description;

  let configJson = existing.config_json || "{}";
  if (input.config !== undefined) {
    if (typeof input.config === "string") {
      try {
        configJson = JSON.stringify(JSON.parse(input.config));
      } catch {
        throw new Error("Invalid JSON in transform config");
      }
    } else if (input.config && typeof input.config === "object") {
      configJson = JSON.stringify(input.config);
    }
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE pipeline_transforms
       SET name = ?,
           description = ?,
           enabled = ?,
           config_json = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(name, description, enabled, configJson, now, existing.id)
    .run();

  const updated = await db
    .prepare(
      `SELECT ${PIPELINE_TRANSFORMS_COLUMNS} FROM pipeline_transforms WHERE id = ?`
    )
    .bind(existing.id)
    .first<PipelineTransformRow>();

  if (!updated) {
    throw new Error("Failed to read back updated pipeline_transforms row");
  }

  const transform = mapPipelineTransformRow(updated);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "pipeline_transform.update",
    targetType: "pipeline_transform",
    targetId: String(existing.transform_key),
    reason:
      input.reason?.trim() ||
      `Updated pipeline transform "${transform.name}" (${transform.transformKey}): enabled=${transform.enabled}`,
    beforeState: existing,
    afterState: updated,
  });

  const transforms = await listPipelineTransforms(db);
  return { transform, auditEntry, transforms };
}

const KNOWN_ACRONYMS = new Set([
  "US",
  "USA",
  "UK",
  "EU",
  "UN",
  "NATO",
  "FAA",
  "FCC",
  "FDA",
  "FTC",
  "SEC",
  "DOJ",
  "DOD",
  "DHS",
  "EPA",
  "DOE",
  "DOT",
  "HHS",
  "IRS",
  "FBI",
  "CIA",
  "NSA",
  "CISA",
  "FEMA",
  "NASA",
  "USPS",
  "FDIC",
  "FOMC",
  "SCOTUS",
  "GOP",
  "DNC",
  "RNC",
  "CEO",
  "CFO",
  "CTO",
  "CISO",
  "COO",
  "AI",
  "IT",
  "AWS",
  "GCP",
  "BGP",
  "DNS",
  "TCP",
  "TLS",
  "SSL",
  "API",
  "SRE",
  "PIR",
  "CAB",
  "SPOF",
  "GDP",
  "CPI",
  "PPI",
  "IPO",
  "ETF",
  "EV",
  "HVAC",
  "ERCOT",
  "PJM",
  "CAISO",
  "NYISO",
  "NERC",
  "FERC",
]);

const ALARMIST_BUZZWORD_REGEX =
  /\b(shocking|bombshell|catastrophic|meltdown|chaos|panic|slams|slammed|blasts|blasted|destroys|destroyed|nightmare|disaster|apocalyptic|bloodbath|freaking out|sparks outrage|erupts|explodes|terrifying|horrifying|unbelievable|you won't believe|breaking:|urgent:|exclusive:|must-see|devastating|total collapse|brink of collapse|warns of doom|chaos ensues|gutted|obliterated|torches|rips|wrecked|shatters|plummeting|skyrocketing|crisis mode|full-blown crisis)\b/i;

const RECURRING_COLUMN_PREFIX_REGEX =
  /^(?:brickbat|opinion|editorial|commentary|review|perspective|analysis|dispatch)\s*[:\-—]\s*/i;

const LEGACY_BOILERPLATE_SUFFIX_REGEX =
  /\s*:\s*Operational\s*&\s*Governance\s*Assessment\s*$/i;

/**
 * Strips legacy ": Operational & Governance Assessment" suffix from stored titles on read.
 */
export function stripLegacyBoilerplateTitleSuffix(title: string): string {
  if (!title || typeof title !== "string") return "";
  return title.replace(LEGACY_BOILERPLATE_SUFFIX_REGEX, "").trim();
}

function countHeadlineWords(text: string): number {
  const cleaned = (text || "").trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

const TITLE_CASE_MINOR_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "nor",
  "for",
  "so",
  "yet",
  "at",
  "by",
  "in",
  "of",
  "on",
  "to",
  "up",
  "as",
  "via",
  "vs",
  "vs.",
  "into",
  "over",
  "with",
  "from",
]);

function toBroadsheetTitleCase(rawClause: string): string {
  const words = rawClause.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const bare = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (!bare) return word;
      const upperBare = bare.toUpperCase();
      if (KNOWN_ACRONYMS.has(upperBare) || /^U\.S\.?$/i.test(bare)) {
        return word.replace(bare, upperBare);
      }
      const lowerBare = bare.toLowerCase();
      if (
        index > 0 &&
        index < words.length - 1 &&
        TITLE_CASE_MINOR_WORDS.has(lowerBare)
      ) {
        return word.replace(bare, lowerBare);
      }
      // Preserve internal capitalization on mixed-case proper nouns like McDonald's or iPhone
      if (/[a-z].*[A-Z]/.test(bare)) {
        return word;
      }
      const titled =
        bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase();
      return word.replace(bare, titled);
    })
    .join(" ");
}

/**
 * Constructs a clean, factual headline in Title Case from the lead sentence of an article excerpt
 * when the original headline is an idiomatic stub (e.g., "Brickbat: Sticky Fingers") or requires
 * deterministic neutralization without any matching replacement rule.
 */
export function buildFactualHeadlineFromExcerpt(excerpt: string): string | null {
  if (!excerpt || typeof excerpt !== "string") return null;
  const cleaned = stripHtmlAndCdata(excerpt)
    .replace(/\s+/g, " ")
    .replace(/^[A-Z\s,]{2,28}(?:\([A-Z]{2,10}\))?\s*[—\-–:]\s*/, "")
    .trim();
  if (cleaned.length < 20) return null;

  // Protect common abbreviations before splitting the first sentence
  const protectedText = cleaned.replace(
    /\b(U\.S|U\.K|Dr|Mr|Mrs|Ms|St|Gov|Rep|Sen|Gen|Col|Lt|Inc|Corp|Co|Ltd|vs|No|Dept|Assn)\./gi,
    "$1__DOT__"
  );
  const firstSentenceRaw = (protectedText.split(/(?<=[.!?])\s+/)[0] || "")
    .replace(/__DOT__/g, ".")
    .replace(/[.!?]+$/, "")
    .trim();

  if (!firstSentenceRaw) return null;

  // Split on semicolon, em-dash, or colon first if the leading clause is substantial
  let candidateClause = firstSentenceRaw;
  const primaryDelimiterSplit = firstSentenceRaw.split(/\s*(?:;|—|–|\s-\s)\s*/);
  if (
    primaryDelimiterSplit[0] &&
    countHeadlineWords(primaryDelimiterSplit[0]) >= 5
  ) {
    candidateClause = primaryDelimiterSplit[0].trim();
  } else {
    // Check if splitting at the first comma yields a substantive 6..14 word clause
    const commaParts = firstSentenceRaw.split(/,\s+/);
    if (
      commaParts.length > 1 &&
      commaParts[0] &&
      countHeadlineWords(commaParts[0]) >= 6 &&
      countHeadlineWords(commaParts[0]) <= 14
    ) {
      candidateClause = commaParts[0].trim();
    }
  }

  let words = candidateClause
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .split(/\s+/)
    .filter(Boolean);

  // Strip leading articles ("A ", "An ", "The ") for tighter headline style
  if (words.length > 5 && /^(?:a|an|the)$/i.test(words[0] || "")) {
    words = words.slice(1);
  }

  if (words.length > 15) {
    words = words.slice(0, 15);
  }

  // Strip trailing dangling prepositions, conjunctions, or articles
  while (
    words.length > 4 &&
    /^(?:a|an|the|and|or|but|nor|for|so|yet|of|in|on|at|to|by|for|with|from|into|over|under|after|before|while|when|where|that|which|who|whom|whose|as|is|was|were|are|be|been|has|have|had)$/i.test(
      (words[words.length - 1] || "").replace(/[^A-Za-z]/g, "")
    )
  ) {
    words.pop();
  }

  const joined = words
    .join(" ")
    .replace(/[,;:\-—.!?]+$/, "")
    .trim();

  if (countHeadlineWords(joined) < 4 || joined.length < 15) {
    return null;
  }

  return toBroadsheetTitleCase(joined);
}

/**
 * Detects whether a raw source headline contains alarmist, clickbait, or sensationalist markers,
 * or is a recurring idiomatic column stub (such as "Brickbat: ...").
 */
export function isAlarmistHeadline(title: string): boolean {
  if (!title || typeof title !== "string") return false;
  const trimmed = title.trim();
  if (/^brickbat\s*[:\-—]/i.test(trimmed)) {
    return true;
  }
  if (RECURRING_COLUMN_PREFIX_REGEX.test(trimmed)) {
    const remainder = trimmed.replace(RECURRING_COLUMN_PREFIX_REGEX, "").trim();
    if (countHeadlineWords(remainder) < 4) {
      return true;
    }
  }
  if (ALARMIST_BUZZWORD_REGEX.test(trimmed)) {
    return true;
  }
  if (/!+|\?\!|\?\?+/.test(trimmed)) {
    return true;
  }
  // Check for 2+ ALL-CAPS shouting words (4+ chars) that are not known acronyms
  const words = trimmed.match(/\b[A-Z]{4,}\b/g) || [];
  const shoutingWords = words.filter((w) => !KNOWN_ACRONYMS.has(w));
  if (shoutingWords.length >= 2) {
    return true;
  }
  return false;
}

const ALARMIST_REPLACEMENTS: Array<[RegExp, string, string]> = [
  [RECURRING_COLUMN_PREFIX_REGEX, "", "Removed recurring editorial column prefix"],
  [/^(?:breaking|urgent|shocking|bombshell|exclusive|alert|watch|live updates|developing)\s*[:\-—]\s*/i, "", "Removed urgent/clickbait prefix"],
  [/\b(?:slams|slammed|blasts|blasted|rips|torches|shreds)\b/gi, "challenges", "Replaced combative verb with neutral operational verb"],
  [/\b(?:destroys|destroyed|obliterates|obliterated|gutted|wrecked)\b/gi, "impacts", "Replaced hyperbolic impact verb"],
  [/\b(?:meltdown|chaos|bloodbath|pandemonium|mayhem)\b/gi, "operational disruption", "Replaced sensational noun with 'operational disruption'"],
  [/\b(?:catastrophic|apocalyptic|devastating|horrifying|terrifying|nightmare)\b/gi, "severe", "Neutralized sensational adjective"],
  [/\b(?:bombshell|shocking|stunning|jaw-dropping|unbelievable)\b/gi, "newly disclosed", "Replaced clickbait modifier with 'newly disclosed'"],
  [/\b(?:panic|freaking out|hysteria|outrage)\b/gi, "heightened concern", "Neutralized emotional reaction framing"],
  [/\bsparks outrage\b/gi, "prompts institutional review", "Replaced outrage framing with institutional review"],
  [/\bon the brink of collapse\b/gi, "facing capacity constraints", "Replaced collapse hyperbole with capacity constraint framing"],
  [/\btotal collapse\b/gi, "systemic outage", "Replaced collapse hyperbole with systemic outage"],
  [/\b(?:full-blown\s+)?crisis\b/gi, "operational strain", "De-escalated 'crisis' to 'operational strain'"],
  [/\bdisaster\b/gi, "incident", "De-escalated 'disaster' to 'incident'"],
  [/\s*[—\-:]\s*(?:here's why|and everything changed|what you need to know|you won't believe what happened next).*$/i, "", "Stripped clickbait trailing hook"],
];

function normalizeShoutingWords(text: string): { result: string; converted: boolean } {
  let converted = false;
  const result = text.replace(/\b([A-Z]{4,})\b/g, (match) => {
    if (KNOWN_ACRONYMS.has(match)) {
      return match;
    }
    converted = true;
    return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
  });
  return { result, converted };
}

/**
 * Deterministic de-alarmist headline rewriter that strips sensational adjectives,
 * all-caps shouting, partisan framing, and emotional clickbait while preserving factual actors.
 */
export function deescalateHeadlineDeterministic(
  title: string,
  _excerpt = "",
  forceRewrite = false
): HeadlineDeescalationResult {
  const originalTitle = stripLegacyBoilerplateTitleSuffix(title || "");
  const wasAlarmist = isAlarmistHeadline(originalTitle);
  let working = originalTitle;
  const appliedNotes: string[] = [];

  for (const [pattern, replacement, note] of ALARMIST_REPLACEMENTS) {
    if (pattern.test(working)) {
      working = working.replace(pattern, replacement);
      appliedNotes.push(note);
    }
  }

  const shoutNorm = normalizeShoutingWords(working);
  if (shoutNorm.converted) {
    working = shoutNorm.result;
    appliedNotes.push("Normalized ALL-CAPS shouting to standard Title Case");
  }

  if (/!+/.test(working)) {
    working = working.replace(/!+/g, "");
    appliedNotes.push("Removed exclamation marks");
  }

  // Clean up duplicate spaces and leading/trailing punctuation artifacts
  working = working
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-—\s]+|[,;:\-—\s]+$/g, "")
    .trim();

  if (working.length > 0) {
    working = working.charAt(0).toUpperCase() + working.slice(1);
  }

  const isTooShortOrIdiomatic = countHeadlineWords(working) < 4;

  // If stripped title is too short/idiomatic (e.g. "Sticky Fingers" after stripping "Brickbat:")
  // or if forceRewrite is true and no regex replacement altered the headline, construct a clean
  // factual headline from the first sentence of `_excerpt` rather than appending boilerplate.
  if (isTooShortOrIdiomatic || (forceRewrite && working === originalTitle)) {
    const excerptHeadline = buildFactualHeadlineFromExcerpt(_excerpt);
    if (excerptHeadline && excerptHeadline !== originalTitle) {
      working = excerptHeadline;
      appliedNotes.push(
        "Constructed factual headline from source dispatch lead sentence"
      );
    } else if (isTooShortOrIdiomatic) {
      // Do not replace with a 1-3 word stub if we have no excerpt to build a full factual headline
      working = originalTitle;
      appliedNotes.length = 0;
    }
  }

  const changed =
    working !== originalTitle &&
    working.length >= 10 &&
    countHeadlineWords(working) >= 4;
  const neutralTitle = changed ? working : originalTitle;
  const rationale = changed
    ? `${appliedNotes.join("; ")}. Original headline preserved in audit_ledger.`
    : "Headline already meets calm, operational Craft editorial standards.";

  return {
    originalTitle,
    neutralTitle,
    rationale,
    wasAlarmist,
    changed,
    modelUsed: "deterministic-deescalator-v1",
  };
}

/**
 * Rewrites sensationalized, clickbait, or alarmist source headlines into calm, clinical SRE/Craft
 * incident titles using Gemini (`gemini-2.5-flash`), with deterministic fallback.
 */
export async function deescalateHeadlineWithGemini(
  title: string,
  excerpt: string,
  geminiApiKey?: string,
  options?: {
    fetchImpl?: typeof fetch;
    forceRewrite?: boolean;
  }
): Promise<HeadlineDeescalationResult> {
  const originalTitle = stripLegacyBoilerplateTitleSuffix(title || "");
  const wasAlarmist = isAlarmistHeadline(originalTitle);
  const deterministic = deescalateHeadlineDeterministic(
    originalTitle,
    excerpt,
    Boolean(options?.forceRewrite)
  );

  const trimmedKey = geminiApiKey?.trim() || "";
  if (!trimmedKey || trimmedKey === "your_gemini_api_key_here") {
    return deterministic;
  }

  // If neither alarmist nor forceRewrite, no need to spend LLM tokens
  if (!wasAlarmist && !options?.forceRewrite) {
    return deterministic;
  }

  const fetchFn = options?.fetchImpl ?? fetch;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
    trimmedKey
  )}`;

  const systemInstruction = `You are the senior editorial desk for Change Advisory Board (thecabcall.com).
Your task is to rewrite sensationalized, clickbait, partisan, or emotionally charged news headlines into calm, clinical, plain-English operational incident titles.

RULES:
1. Preserve the specific institutional actors, systems, and verifiable facts from the source headline and excerpt.
2. Strip all sensational adjectives ("shocking", "bombshell", "catastrophic", "meltdown", "slams", "blasts", "chaos", "nightmare"), recurring column prefixes ("Brickbat:", "Opinion:", "Commentary:"), ALL-CAPS shouting, exclamation marks, and clickbait hooks.
3. Never include internal classifier names ("Jev", "jev-1.14.0"), raw failure shortCodes ("CFG-DRIFT"), or boilerplate suffixes like ": Operational & Governance Assessment".
4. Keep the rewritten title between 8 and 16 words in standard headline case.
5. Provide a 1-sentence rationale explaining what alarmist or rhetorical framing was neutralized for public audit disclosure.`;

  const userPrompt = `De-escalate the following source headline into a calm, clinical operational incident title:

Original Headline: ${originalTitle}
Source Excerpt: ${(excerpt || "").slice(0, 800)}

Return JSON with "neutralTitle" and "rationale".`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              neutralTitle: { type: "STRING" },
              rationale: { type: "STRING" },
            },
            required: ["neutralTitle", "rationale"],
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return deterministic;
    }

    const data: any = await response.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    if (!rawText) {
      return deterministic;
    }

    const parsed = JSON.parse(rawText) as {
      neutralTitle?: string;
      rationale?: string;
    };
    const candidateTitle = stripLegacyBoilerplateTitleSuffix(
      (parsed?.neutralTitle || "")
        .replace(RECURRING_COLUMN_PREFIX_REGEX, "")
        .trim()
    );
    const candidateRationale = (parsed?.rationale || "").trim();

    if (
      candidateTitle.length < 10 ||
      candidateTitle.length > 160 ||
      countHeadlineWords(candidateTitle) < 4 ||
      /\bjev-1\.14\.0\b/i.test(candidateTitle)
    ) {
      return deterministic;
    }

    return {
      originalTitle,
      neutralTitle: candidateTitle,
      rationale:
        candidateRationale ||
        deterministic.rationale ||
        "Neutralized alarmist framing into a clinical operational headline.",
      wasAlarmist: true,
      changed: candidateTitle !== originalTitle,
      modelUsed: "gemini-2.5-flash",
    };
  } catch {
    return deterministic;
  } finally {
    clearTimeout(timer);
  }
}

const GENERIC_PUBLISHER_CARD_REGEX =
  /default|logo|avatar|placeholder|brand|site-icon|favicon|og-default|masthead|wordmark|apple-touch-icon|blank|1x1|pixel|spacer\.gif/i;

export function isGenericPublisherImage(url: string): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return true;
  if (/\.svg(\?|$)/i.test(trimmed)) return true;
  if (GENERIC_PUBLISHER_CARD_REGEX.test(trimmed)) return true;
  return false;
}

/**
 * Extracts `<media:content>`, `<media:thumbnail>`, `<enclosure type="image/*">`, or `<img>` URLs
 * from a raw RSS `<item>` or Atom `<entry>` XML block.
 */
export function extractImageFromRssBlock(
  blockXml: string,
  fallbackTitle = ""
): {
  imageUrl: string;
  imageAlt: string;
  imageCaption: string;
} | null {
  if (!blockXml || typeof blockXml !== "string") return null;

  const isTrackingPixel = (u: string): boolean =>
    /1x1|pixel|spacer\.gif|feedburner|doubleclick|analytics|beacon|stat\.|\bads?\b/i.test(
      u
    ) || isGenericPublisherImage(u);

  // 1. <media:content url="..." medium="image" | type="image/..." />
  const mediaContentRegex = /<media:content\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = mediaContentRegex.exec(blockXml)) !== null) {
    const attrs = match[1] || "";
    const urlMatch = attrs.match(/\burl=["']([^"']+)["']/i);
    const typeMatch = attrs.match(/\b(?:type|medium)=["']([^"']+)["']/i);
    const candidateUrl = urlMatch?.[1]?.trim().replace(/&amp;/g, "&") || "";
    if (
      candidateUrl &&
      /^https?:\/\//i.test(candidateUrl) &&
      !isTrackingPixel(candidateUrl) &&
      (!typeMatch ||
        /image/i.test(typeMatch[1]) ||
        /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(candidateUrl))
    ) {
      const mediaTitleMatch = blockXml.match(
        /<media:(?:title|description)[^>]*>([\s\S]*?)<\/media:(?:title|description)>/i
      );
      const caption = mediaTitleMatch
        ? stripHtmlAndCdata(mediaTitleMatch[1]).slice(0, 220)
        : "";
      return {
        imageUrl: candidateUrl,
        imageAlt: caption || fallbackTitle || "Source dispatch media",
        imageCaption: caption || `Source media via RSS dispatch`,
      };
    }
  }

  // 2. <media:thumbnail url="..." />
  const thumbMatch = blockXml.match(
    /<media:thumbnail\b[^>]*\burl=["']([^"']+)["'][^>]*\/?>/i
  );
  if (thumbMatch?.[1]) {
    const candidateUrl = thumbMatch[1].trim().replace(/&amp;/g, "&");
    if (/^https?:\/\//i.test(candidateUrl) && !isTrackingPixel(candidateUrl)) {
      return {
        imageUrl: candidateUrl,
        imageAlt: fallbackTitle || "Source dispatch thumbnail",
        imageCaption: "Source thumbnail via RSS dispatch",
      };
    }
  }

  // 3. <enclosure url="..." type="image/..." />
  const enclosureRegex = /<enclosure\b([^>]*)\/?>/gi;
  while ((match = enclosureRegex.exec(blockXml)) !== null) {
    const attrs = match[1] || "";
    const urlMatch = attrs.match(/\burl=["']([^"']+)["']/i);
    const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
    const candidateUrl = urlMatch?.[1]?.trim().replace(/&amp;/g, "&") || "";
    if (
      candidateUrl &&
      /^https?:\/\//i.test(candidateUrl) &&
      !isTrackingPixel(candidateUrl) &&
      ((typeMatch && /^image\//i.test(typeMatch[1])) ||
        /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(candidateUrl))
    ) {
      return {
        imageUrl: candidateUrl,
        imageAlt: fallbackTitle || "Source enclosure image",
        imageCaption: "Source enclosure media via RSS dispatch",
      };
    }
  }

  // 4. <img src="https://..." alt="..." /> inside description/content
  const imgMatch = blockXml.match(
    /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/i
  );
  if (imgMatch?.[1]) {
    const candidateUrl = imgMatch[1].trim().replace(/&amp;/g, "&");
    if (!isTrackingPixel(candidateUrl)) {
      const altMatch = imgMatch[0].match(/\balt=["']([^"']*)["']/i);
      const alt = altMatch?.[1]
        ? stripHtmlAndCdata(altMatch[1]).slice(0, 180)
        : fallbackTitle || "Source dispatch image";
      return {
        imageUrl: candidateUrl,
        imageAlt: alt,
        imageCaption: alt !== fallbackTitle ? alt : "Extracted from RSS dispatch HTML",
      };
    }
  }

  return null;
}

/**
 * Attempts to extract an OpenGraph (`og:image`) or Twitter Card (`twitter:image`) image
 * from an article's source URL, filtering out generic publisher logos, default social cards, and SVGs.
 */
export async function extractImageFromSourceArticleUrl(
  sourceUrl: string,
  fallbackTitle: string,
  fetchImpl?: typeof fetch
): Promise<{
  imageUrl: string;
  imageAlt: string;
  imageCaption: string;
  imageSourceType: "og_scraped";
} | null> {
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) return null;
  const fetchFn = fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetchFn(sourceUrl, {
      headers: {
        "User-Agent":
          "TheCABCall-Editorial/1.0 (+https://thecabcall.com; media-extractor)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 120_000);

    const candidatePatterns = [
      /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["'](https?:\/\/[^"']+)["']/gi,
      /<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/gi,
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["'](https?:\/\/[^"']+)["']/gi,
      /<meta[^>]+content=["'](https?:\/\/[^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/gi,
    ];

    let selectedImageUrl: string | null = null;
    for (const pattern of candidatePatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(html)) !== null) {
        const rawCandidate = (m[1] || "").trim().replace(/&amp;/g, "&");
        if (rawCandidate && !isGenericPublisherImage(rawCandidate)) {
          selectedImageUrl = rawCandidate;
          break;
        }
      }
      if (selectedImageUrl) break;
    }

    if (!selectedImageUrl) return null;

    const altMatch =
      html.match(
        /<meta[^>]+(?:property=["']og:image:alt["']|name=["']twitter:image:alt["'])[^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property=["']og:image:alt["']|name=["']twitter:image:alt["'])/i
      );
    const alt = altMatch?.[1]
      ? stripHtmlAndCdata(altMatch[1]).slice(0, 180)
      : fallbackTitle;

    return {
      imageUrl: selectedImageUrl,
      imageAlt: alt || fallbackTitle,
      imageCaption: "Extracted from primary source dispatch metadata",
      imageSourceType: "og_scraped",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const ENTITY_STOP_WORDS = new Set([
  "The",
  "A",
  "An",
  "In",
  "On",
  "At",
  "By",
  "For",
  "With",
  "From",
  "Into",
  "Over",
  "Under",
  "After",
  "Before",
  "During",
  "While",
  "When",
  "Where",
  "Why",
  "How",
  "What",
  "Who",
  "This",
  "That",
  "These",
  "Those",
  "Their",
  "There",
  "Here",
  "Brickbat",
  "Opinion",
  "Editorial",
  "Commentary",
  "Review",
  "Perspective",
  "Analysis",
  "Dispatch",
  "Report",
  "Study",
  "Update",
  "Breaking",
  "Urgent",
  "Exclusive",
  "Former",
  "New",
  "First",
  "Last",
  "More",
  "Most",
  "Some",
  "Many",
  "Several",
  "Every",
  "Each",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

const INSTITUTIONAL_ACRONYM_MAP: Record<string, string> = {
  SCOTUS: "Supreme Court of the United States",
  DOJ: "United States Department of Justice",
  FBI: "Federal Bureau of Investigation",
  CIA: "Central Intelligence Agency",
  NSA: "National Security Agency",
  DHS: "United States Department of Homeland Security",
  DOD: "Pentagon",
  PENTAGON: "Pentagon",
  FCC: "Federal Communications Commission",
  FTC: "Federal Trade Commission",
  SEC: "U.S. Securities and Exchange Commission",
  FDA: "Food and Drug Administration",
  EPA: "United States Environmental Protection Agency",
  IRS: "Internal Revenue Service",
  USPS: "United States Postal Service",
  FAA: "Federal Aviation Administration",
  CISA: "Cybersecurity and Infrastructure Security Agency",
  GAO: "Government Accountability Office",
  FERC: "Federal Energy Regulatory Commission",
  NERC: "North American Electric Reliability Corporation",
  CFPB: "Consumer Financial Protection Bureau",
  NLRB: "National Labor Relations Board",
  OSHA: "Occupational Safety and Health Administration",
  FDIC: "Federal Deposit Insurance Corporation",
  FEMA: "Federal Emergency Management Agency",
  NATO: "NATO",
};

/**
 * Extracts 2–3 concrete institutional or named-entity search queries from an article's
 * headline and lead excerpt for Wikipedia / Wikimedia Commons archival photo resolution.
 */
export function extractInstitutionalSearchQueries(
  title: string,
  excerpt: string,
  domainSector?: string
): string[] {
  const queries: string[] = [];
  const addQuery = (q: string) => {
    const cleaned = q
      .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (
      cleaned.length >= 4 &&
      !ENTITY_STOP_WORDS.has(cleaned) &&
      !queries.some((existing) => existing.toLowerCase() === cleaned.toLowerCase())
    ) {
      queries.push(cleaned);
    }
  };

  const combinedText = `${stripLegacyBoilerplateTitleSuffix(title || "").replace(
    RECURRING_COLUMN_PREFIX_REGEX,
    ""
  )}. ${stripHtmlAndCdata(excerpt || "").slice(0, 500)}`;

  // 1. Check for known institutional acronyms or well-known federal/civic bodies
  for (const [acronym, canonicalEntity] of Object.entries(
    INSTITUTIONAL_ACRONYM_MAP
  )) {
    const regex = new RegExp(`\\b${acronym}\\b`, "i");
    if (
      acronym.length >= 4
        ? regex.test(combinedText)
        : new RegExp(`\\b${acronym}\\b`).test(combinedText)
    ) {
      addQuery(canonicalEntity);
      if (queries.length >= 3) return queries.slice(0, 3);
    }
  }

  // 2. Multi-word capitalized proper noun phrases (e.g., "Fairfax County Police", "Supreme Court", "Federal Reserve")
  const multiWordEntityRegex =
    /\b([A-Z][a-zA-Z0-9.'-]+(?:\s+(?:of|the|and|for|in|on|[A-Z][a-zA-Z0-9.'-]+)){1,4})\b/g;
  let match: RegExpExecArray | null;
  while ((match = multiWordEntityRegex.exec(combinedText)) !== null) {
    const rawPhrase = (match[1] || "").trim();
    const tokens = rawPhrase.split(/\s+/);
    // Strip leading stop words from the phrase
    while (tokens.length > 0 && ENTITY_STOP_WORDS.has(tokens[0] || "")) {
      tokens.shift();
    }
    // Strip trailing lowercase connector words
    while (
      tokens.length > 0 &&
      /^(?:of|the|and|for|in|on|at|to|by|with|from)$/i.test(
        tokens[tokens.length - 1] || ""
      )
    ) {
      tokens.pop();
    }
    if (tokens.length >= 2) {
      addQuery(tokens.join(" "));
      if (queries.length >= 3) return queries.slice(0, 3);
    }
  }

  // 3. Single capitalized proper nouns (5+ chars) in the excerpt or headline
  const singleProperRegex = /\b([A-Z][a-z]{4,18})\b/g;
  while ((match = singleProperRegex.exec(combinedText)) !== null) {
    const word = match[1] || "";
    if (!ENTITY_STOP_WORDS.has(word)) {
      addQuery(word);
      if (queries.length >= 3) return queries.slice(0, 3);
    }
  }

  // 4. Institutional domain sector fallback
  const sectorFallbacks: Record<string, string> = {
    "Public Policy & Governance": "United States Capitol",
    "Economics & Markets": "Marriner S. Eccles Federal Reserve Board Building",
    "Technology & Cyber": "Data center",
    "Infrastructure & Supply Chain": "Container ship",
    "Institutional Leadership": "Library of Congress",
  };
  if (domainSector && sectorFallbacks[domainSector]) {
    addQuery(sectorFallbacks[domainSector]);
  } else {
    addQuery("United States Capitol");
  }

  return queries.slice(0, 3);
}

function isDisallowedWikimediaAssetUrl(url: string): boolean {
  if (!url || typeof url !== "string") return true;
  if (/\.svg(\?|$)|\.gif(\?|$)|\.tif(\?|$)|\.tiff(\?|$)|\.pdf(\?|$)|\.djvu(\?|$)|\.ogg(\?|$)|\.ogv(\?|$)|\.webm(\?|$)/i.test(url)) {
    return true;
  }
  if (
    /logo|seal_of|coat_of_arms|flag_of|emblem|icon|stub|locator_map|location_map|signature|autograph|wordmark|question_book|ambox|padlock|crystal_clear|nuvola|gnome-|tango-|commons-logo|wikimedia-logo/i.test(
      url
    )
  ) {
    return true;
  }
  return false;
}

const PERMISSIVE_WIKIMEDIA_LICENSE_REGEX =
  /^(?:Public\s*domain|PD|CC0|USGov|PD-USGov|CC[\s-]BY(?:[\s-]SA)?)/i;

/**
 * Resolves a contextually relevant, landscape public-domain or permissive Creative Commons
 * photograph via:
 *   Step A: Wikipedia PageImages API
 *   Step B: Wikimedia Commons Search API with explicit license verification
 */
export async function resolveContextualPublicDomainImage(
  title: string,
  excerpt: string,
  domainSector?: string,
  fetchImpl?: typeof fetch
): Promise<{
  imageUrl: string;
  imageAlt: string;
  imageCaption: string;
  imageSourceType: "wikimedia_commons";
} | null> {
  const fetchFn = fetchImpl ?? fetch;
  const queries = extractInstitutionalSearchQueries(title, excerpt, domainSector);
  if (queries.length === 0) return null;

  const headers = {
    "User-Agent":
      "TheCABCall-Editorial/1.0 (https://thecabcall.com; archival-media-resolver)",
    Accept: "application/json",
  };

  // Step A: Wikipedia PageImages API
  for (const entity of queries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const wpUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|pageterms&piprop=original|thumbnail&pithumbsize=960&redirects=1&format=json&origin=*&titles=${encodeURIComponent(
        entity
      )}`;
      const res = await fetchFn(wpUrl, { headers, signal: controller.signal });
      if (res.ok) {
        const data: any = await res.json();
        const pages = data?.query?.pages
          ? Object.values<any>(data.query.pages)
          : [];
        for (const page of pages) {
          if (!page || page.missing !== undefined) continue;
          const thumb = page.thumbnail;
          const orig = page.original;
          const candidateSource: string = thumb?.source || orig?.source || "";
          const width = Number(thumb?.width || orig?.width || 0);
          const height = Number(thumb?.height || orig?.height || 0);

          if (
            candidateSource &&
            !isDisallowedWikimediaAssetUrl(candidateSource) &&
            width >= 500 &&
            height > 0 &&
            width >= height
          ) {
            const pageTitle = (page.title || entity).trim();
            const desc =
              page?.terms?.description?.[0] ||
              `${pageTitle} archival reference photograph`;
            return {
              imageUrl: candidateSource,
              imageAlt: `${pageTitle} — ${desc}`,
              imageCaption: `Archival reference via Wikimedia Commons (Public Domain / CC) — ${pageTitle}`,
              imageSourceType: "wikimedia_commons",
            };
          }
        }
      }
    } catch {
      // Continue to next query or Step B
    } finally {
      clearTimeout(timer);
    }
  }

  // Step B: Wikimedia Commons Search API with License Verification
  for (const query of queries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        `${query} filetype:bitmap`
      )}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|dimensions|extmetadata&iiurlwidth=960&format=json&origin=*`;
      const res = await fetchFn(commonsUrl, {
        headers,
        signal: controller.signal,
      });
      if (!res.ok) continue;

      const data: any = await res.json();
      const pages = data?.query?.pages
        ? Object.values<any>(data.query.pages)
        : [];
      for (const page of pages) {
        const info = page?.imageinfo?.[0];
        if (!info) continue;

        const candidateUrl: string = info.thumburl || info.url || "";
        const width = Number(info.thumbwidth || info.width || 0);
        const height = Number(info.thumbheight || info.height || 0);

        if (
          !candidateUrl ||
          isDisallowedWikimediaAssetUrl(candidateUrl) ||
          width < 500 ||
          height <= 0 ||
          height > width
        ) {
          continue;
        }

        const ext = info.extmetadata || {};
        const licenseShort = String(
          ext?.LicenseShortName?.value || ""
        ).trim();
        if (!PERMISSIVE_WIKIMEDIA_LICENSE_REGEX.test(licenseShort)) {
          continue;
        }

        const rawArtist = String(
          ext?.Artist?.value || ext?.Credit?.value || "Wikimedia Commons"
        );
        const artistOrSource =
          stripHtmlAndCdata(rawArtist)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 90) || "Wikimedia Commons";
        const rawDesc = String(
          ext?.ObjectName?.value ||
            ext?.ImageDescription?.value ||
            page?.title?.replace(/^File:/i, "") ||
            query
        );
        const cleanAlt =
          stripHtmlAndCdata(rawDesc)
            .replace(/\.[a-z0-9]{3,4}$/i, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 160) || `${query} — archival reference`;

        return {
          imageUrl: candidateUrl,
          imageAlt: cleanAlt,
          imageCaption: `Archival reference via Wikimedia Commons (${licenseShort}) — ${artistOrSource}`,
          imageSourceType: "wikimedia_commons",
        };
      }
    } catch {
      // Continue to next query
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

function escapeXmlText(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapSvgLines(text: string, maxCharsPerLine = 46, maxLines = 3): string[] {
  const words = (text || "").trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    }
  }

  const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remaining = words.slice(consumedWords).join(" ");
  if (remaining) {
    if (remaining.length > maxCharsPerLine) {
      lines.push(`${remaining.slice(0, maxCharsPerLine - 1).trim()}…`);
    } else {
      lines.push(remaining);
    }
  }

  return lines.slice(0, maxLines);
}

function buildWorkingToolSvgMotif(tool: WorkingToolId): string {
  switch (tool) {
    case "The Square":
      return `
        <g stroke="#C5A059" stroke-width="2.5" fill="none" opacity="0.9">
          <path d="M920 130 L1080 130 L1080 290 L1040 290 L1040 170 L920 170 Z" fill="#C5A059" fill-opacity="0.12" />
          <line x1="940" y1="130" x2="940" y2="142" />
          <line x1="970" y1="130" x2="970" y2="146" />
          <line x1="1000" y1="130" x2="1000" y2="142" />
          <line x1="1030" y1="130" x2="1030" y2="146" />
          <line x1="1080" y1="190" x2="1068" y2="190" />
          <line x1="1080" y1="220" x2="1064" y2="220" />
          <line x1="1080" y1="250" x2="1068" y2="250" />
          <rect x="1028" y="170" width="12" height="12" stroke="#C5A059" stroke-width="1.5" />
        </g>`;
    case "The Plumb":
      return `
        <g stroke="#C5A059" stroke-width="2.5" fill="none" opacity="0.9">
          <path d="M975 110 L1025 110 L1035 300 L965 300 Z" stroke-opacity="0.5" />
          <line x1="1000" y1="110" x2="1000" y2="235" stroke-dasharray="4 3" />
          <polygon points="1000,275 980,235 1020,235" fill="#C5A059" fill-opacity="0.22" />
          <circle cx="1000" cy="128" r="7" />
        </g>`;
    case "The Level":
      return `
        <g stroke="#C5A059" stroke-width="2.5" fill="none" opacity="0.9">
          <polygon points="1000,130 905,275 1095,275" fill="#C5A059" fill-opacity="0.1" />
          <line x1="935" y1="230" x2="1065" y2="230" />
          <line x1="1000" y1="130" x2="1000" y2="250" />
          <circle cx="1000" cy="252" r="8" fill="#C5A059" fill-opacity="0.3" />
        </g>`;
    case "24-Inch Gauge":
      return `
        <g stroke="#C5A059" stroke-width="2.5" fill="none" opacity="0.9">
          <rect x="890" y="185" width="220" height="44" fill="#C5A059" fill-opacity="0.12" />
          <line x1="925" y1="185" x2="925" y2="205" />
          <line x1="962" y1="185" x2="962" y2="215" />
          <line x1="1000" y1="185" x2="1000" y2="229" />
          <line x1="1037" y1="185" x2="1037" y2="215" />
          <line x1="1074" y1="185" x2="1074" y2="205" />
        </g>`;
    case "Common Gavel":
      return `
        <g stroke="#C5A059" stroke-width="2.5" fill="none" opacity="0.9">
          <path d="M935 145 L1045 145 L1065 168 L1045 190 L935 190 Z" fill="#C5A059" fill-opacity="0.15" />
          <rect x="982" y="190" width="16" height="105" fill="#C5A059" fill-opacity="0.1" />
        </g>`;
    case "The Trowel":
    default:
      return `
        <g stroke="#C5A059" stroke-width="2.5" fill="none" opacity="0.9">
          <polygon points="1000,120 940,235 1000,260 1060,235" fill="#C5A059" fill-opacity="0.14" />
          <line x1="1000" y1="120" x2="1000" y2="295" />
          <rect x="988" y="275" width="24" height="32" rx="4" />
        </g>`;
  }
}

/**
 * Generates a high-contrast Masonic Blueprint + SRE Telemetry SVG visual card (1200x630)
 * for any incident on The Trestleboard.
 */
export function generateIncidentTelemetrySvgCard(input: {
  incidentCode: string;
  title: string;
  sourceFeed: string;
  publishedAt: string;
  primaryTool: WorkingToolId;
  secondaryTool: WorkingToolId;
  sreFailureMode: SreFailureModeId;
  domainSector: string;
  titleRewritten?: boolean;
}): string {
  const lines = wrapSvgLines(input.title, 44, 3);
  const dateLabel = (input.publishedAt || new Date().toISOString())
    .slice(0, 10);
  const codeLabel = input.incidentCode.startsWith("#")
    ? `LEDGER ENTRY No. ${input.incidentCode.slice(1)}`
    : input.incidentCode;

  const titleSvg = lines
    .map(
      (line, idx) =>
        `<text x="76" y="${245 + idx * 54}" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="bold" fill="#F3EFE6">${escapeXmlText(
          line
        )}</text>`
    )
    .join("\n");

  const motifSvg = buildWorkingToolSvgMotif(input.primaryTool);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${escapeXmlText(
    input.title
  )}">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#8A6D3B" stroke-width="0.6" stroke-opacity="0.18" />
    </pattern>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0E14" />
      <stop offset="60%" stop-color="#111726" />
      <stop offset="100%" stop-color="#0D121D" />
    </linearGradient>
  </defs>

  <!-- Background & Blueprint Grid -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#grid)" />

  <!-- Outer & Inner Burnished Brass Tracing Board Borders -->
  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#C5A059" stroke-width="2" stroke-opacity="0.85" />
  <rect x="38" y="38" width="1124" height="554" fill="none" stroke="#8A6D3B" stroke-width="1" stroke-opacity="0.65" />

  <!-- Corner Brackets -->
  <path d="M24 52 L24 24 L52 24" fill="none" stroke="#C5A059" stroke-width="4" />
  <path d="M1148 24 L1176 24 L1176 52" fill="none" stroke="#C5A059" stroke-width="4" />
  <path d="M24 578 L24 606 L52 606" fill="none" stroke="#C5A059" stroke-width="4" />
  <path d="M1148 606 L1176 606 L1176 578" fill="none" stroke="#C5A059" stroke-width="4" />

  <!-- Top Ledger Header -->
  <text x="76" y="96" font-family="monospace" font-size="16" letter-spacing="3" fill="#C5A059" font-weight="bold">
    THE CAB CALL // STRUCTURAL INSPECTION BRIEF
  </text>
  <text x="76" y="126" font-family="monospace" font-size="14" letter-spacing="1.5" fill="#94A3B8">
    ${escapeXmlText(codeLabel)} • ${escapeXmlText(
    input.sourceFeed.toUpperCase()
  )} • ${escapeXmlText(dateLabel)} UTC
  </text>
  <line x1="76" y1="148" x2="840" y2="148" stroke="#8A6D3B" stroke-width="1" stroke-opacity="0.6" />

  <!-- Working Tool Copperplate Motif Box -->
  <rect x="880" y="76" width="240" height="260" fill="#0B0E14" fill-opacity="0.75" stroke="#8A6D3B" stroke-width="1.2" />
  ${motifSvg}
  <text x="1000" y="320" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="1.5" fill="#C5A059">
    ${escapeXmlText(input.primaryTool.toUpperCase())}
  </text>

  <!-- Wrapped Headline -->
  ${titleSvg}

  <!-- Bottom Diagnostic Badges Bar -->
  <line x1="76" y1="455" x2="1120" y2="455" stroke="#8A6D3B" stroke-width="1" stroke-opacity="0.6" />

  <!-- Primary Tool Pill -->
  <rect x="76" y="482" width="290" height="58" fill="#0B0E14" stroke="#C5A059" stroke-width="1.5" />
  <text x="94" y="504" font-family="monospace" font-size="11" letter-spacing="1.5" fill="#94A3B8">PRIMARY WORKING TOOL</text>
  <text x="94" y="527" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#C5A059">${escapeXmlText(
    input.primaryTool
  )}</text>

  <!-- Failure Mode Pill -->
  <rect x="386" y="482" width="430" height="58" fill="#0B0E14" stroke="#F59E0B" stroke-width="1.2" stroke-opacity="0.7" />
  <text x="404" y="504" font-family="monospace" font-size="11" letter-spacing="1.5" fill="#94A3B8">STRUCTURAL FAILURE MODE</text>
  <text x="404" y="527" font-family="Georgia, serif" font-size="17" font-weight="bold" fill="#F3EFE6">${escapeXmlText(
    input.sreFailureMode
  )}</text>

  <!-- Sector / Neutralized Pill -->
  <rect x="836" y="482" width="284" height="58" fill="#0B0E14" stroke="#8A6D3B" stroke-width="1.2" />
  <text x="854" y="504" font-family="monospace" font-size="11" letter-spacing="1.5" fill="#94A3B8">${
    input.titleRewritten ? "EDITORIAL PROVENANCE" : "DOMAIN SECTOR"
  }</text>
  <text x="854" y="527" font-family="monospace" font-size="14" font-weight="bold" fill="${
    input.titleRewritten ? "#10B981" : "#F3EFE6"
  }">${escapeXmlText(
    input.titleRewritten ? "TITLE NEUTRALIZED (AUDITED)" : input.domainSector
  )}</text>
</svg>`;
}

function inferEditorialDomainSector(
  sourceFeed: string,
  title: string,
  excerpt: string
): DomainSectorId {
  const feedLower = (sourceFeed || "").toLowerCase();
  const text = `${title} ${excerpt}`.toLowerCase();
  if (
    feedLower.includes("wsj") ||
    /(bank|loan|market|supplier|billion|million|insolvency|economy|tariff|fund)/.test(
      text
    )
  ) {
    return "Economics & Markets";
  }
  if (
    feedLower.includes("ars technica") ||
    /(cyber|software|cloud|ai|chip|protocol|network|encryption|security)/.test(
      text
    )
  ) {
    return "Technology & Cyber";
  }
  if (
    /(mail|postal|grid|rail|aviation|faa|water|port|supply chain|shutdown|warehouse)/.test(
      text
    )
  ) {
    return "Infrastructure & Supply Chain";
  }
  if (
    /(ceo|board|press secretary|ousted|dei|executive|leadership|resign)/.test(
      text
    )
  ) {
    return "Institutional Leadership";
  }
  return "Public Policy & Governance";
}

export function mapAdminIncidentRowToRecord(
  row: AdminIncidentRow
): AdminIncidentRecord {
  const primaryToolKey: JevWorkingToolKey = row.primary_tool || "square";
  const secondaryToolKey: JevWorkingToolKey =
    row.secondary_tool || "twenty_four_inch_gauge";
  const sreFailureModeKey: JevSreFailureModeKey =
    row.sre_failure_mode || "configuration_drift";

  const primaryTool = mapWorkingToolToCraftLexicon(primaryToolKey);
  const secondaryTool = mapWorkingToolToCraftLexicon(secondaryToolKey);
  const sreFailureMode = mapFailureModeToCraftLexicon(sreFailureModeKey);

  const socraticBrief = sanitizeStringConcatenation(
    (row.socratic_brief || row.raw_excerpt || "").trim()
  );

  const storedPayload = normalizeStoredQuestionsPayload(row.questions_json, {
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: socraticBrief,
    primaryTool,
    secondaryTool,
    sreFailureMode,
  });

  const diagnostics = buildOrSanitizeArticleDiagnostics({
    title: row.title,
    sourceFeed: row.source_feed,
    factualSummary: socraticBrief,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    existingNoise: storedPayload.noiseOverblown,
    existingSignal: storedPayload.structuralSignal,
    existingQuestions: storedPayload.questions,
  });

  const executiveSummary =
    storedPayload.executiveSummary || socraticBrief;
  const noiseOverblown = diagnostics.noiseOverblown;
  const structuralSignal = diagnostics.structuralSignal;
  const questions: [string, string] = [
    diagnostics.questions[0] ||
      `In this case, which specific rule or operating standard failed to hold under ${primaryTool}?`,
    diagnostics.questions[1] ||
      `How should ${secondaryTool} be applied in this case to keep ${sreFailureMode} from recurring?`,
  ];
  const isLeadPostMortem = storedPayload.isLeadPostMortem;
  const leadPostMortemAnalysis = storedPayload.leadPostMortemAnalysis;

  const cleanedRowTitle = stripLegacyBoilerplateTitleSuffix(row.title || "");
  const cleanedOriginalTitle = stripLegacyBoilerplateTitleSuffix(
    row.original_title || row.title || ""
  );
  const effectiveTitleRewritten =
    Number(row.title_rewritten || 0) === 1 &&
    cleanedRowTitle !== cleanedOriginalTitle;

  const slugBase = (cleanedRowTitle || "incident")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

  return {
    id: Number(row.id),
    incidentId: `d1-inc-${row.id}`,
    incidentCode: `#CAB-2026-${2000 + Number(row.id)}`,
    slug: `${slugBase || "incident"}-d1-${row.id}`,
    urlHash: row.url_hash,
    sourceFeed: row.source_feed,
    title: cleanedRowTitle,
    originalTitle: cleanedOriginalTitle,
    titleRewritten: effectiveTitleRewritten,
    titleRewriteReason: effectiveTitleRewritten
      ? row.title_rewrite_reason || null
      : null,
    sourceUrl: row.source_url,
    rawExcerpt: row.raw_excerpt,
    publishedAt: row.published_at,
    ingestedAt: row.ingested_at || row.published_at,
    domainSector: inferEditorialDomainSector(
      row.source_feed,
      row.title,
      row.raw_excerpt
    ),
    isSystemicProb: Number(row.is_systemic_prob || 0),
    jevConfidence: Number(row.jev_confidence || 0),
    primaryToolKey,
    secondaryToolKey,
    sreFailureModeKey,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    executiveSummary,
    socraticBrief,
    proportionalityCheck: {
      noiseOverblown,
      structuralSignal,
    },
    questions,
    status: row.status || "triaged",
    imageUrl: row.image_url || null,
    imageAlt: row.image_alt || null,
    imageCaption: row.image_caption || null,
    imageSourceType: (row.image_source_type as ImageSourceType) || null,
    editorialNotes: row.editorial_notes || null,
    isPinned: Number(row.is_pinned || 0) === 1,
    isHidden: Number(row.is_hidden || 0) === 1,
    isLeadPostMortem,
    leadPostMortemAnalysis,
  };
}

export interface ListAdminIncidentsFilter {
  status?: string;
  search?: string;
  primaryTool?: string;
  onlyRewritten?: boolean;
  onlyWithImage?: boolean;
  onlyPinned?: boolean;
  limit?: number;
}

export interface AdminIncidentsStudioSnapshot {
  incidents: AdminIncidentRecord[];
  transforms: PipelineTransformRecord[];
  counts: {
    total: number;
    synthesized: number;
    triaged: number;
    dropped: number;
    quarantined: number;
    pendingRetry: number;
    hidden: number;
    pinned: number;
    titleRewritten: number;
    withImage: number;
  };
}

export async function listAdminIncidentsAndTransforms(
  db: D1DatabaseLike,
  filters?: ListAdminIncidentsFilter
): Promise<AdminIncidentsStudioSnapshot> {
  await ensureEditorialPipelineSchema(db);

  const [allRes, transforms] = await Promise.all([
    db
      .prepare(
        `SELECT ${ADMIN_INCIDENT_COLUMNS}
         FROM telemetry_articles
         ORDER BY
           COALESCE(is_pinned, 0) DESC,
           CASE
             WHEN status = 'synthesized' THEN 0
             WHEN status = 'triaged' THEN 1
             WHEN status = 'PENDING_RETRY' THEN 2
             WHEN status = 'QUARANTINED' THEN 3
             ELSE 4
           END,
           published_at DESC,
           id DESC
         LIMIT 250`
      )
      .all<AdminIncidentRow>(),
    listPipelineTransforms(db),
  ]);

  const allRecords = (allRes.results || []).map(mapAdminIncidentRowToRecord);

  const counts = {
    total: allRecords.length,
    synthesized: allRecords.filter((r) => r.status === "synthesized" && !r.isHidden).length,
    triaged: allRecords.filter((r) => r.status === "triaged").length,
    dropped: allRecords.filter((r) => r.status === "dropped").length,
    quarantined: allRecords.filter((r) => r.status === "QUARANTINED").length,
    pendingRetry: allRecords.filter((r) => r.status === "PENDING_RETRY").length,
    hidden: allRecords.filter((r) => r.isHidden || r.status === "hidden").length,
    pinned: allRecords.filter((r) => r.isPinned).length,
    titleRewritten: allRecords.filter((r) => r.titleRewritten).length,
    withImage: allRecords.filter((r) => Boolean(r.imageUrl)).length,
  };

  let filtered = allRecords;

  if (filters?.status && filters.status !== "all") {
    if (filters.status === "hidden") {
      filtered = filtered.filter((r) => r.isHidden || r.status === "hidden");
    } else {
      filtered = filtered.filter((r) => r.status === filters.status);
    }
  }
  if (filters?.primaryTool && filters.primaryTool !== "all") {
    filtered = filtered.filter(
      (r) =>
        r.primaryToolKey === filters.primaryTool ||
        r.primaryTool === filters.primaryTool
    );
  }
  if (filters?.onlyRewritten) {
    filtered = filtered.filter((r) => r.titleRewritten);
  }
  if (filters?.onlyWithImage) {
    filtered = filtered.filter((r) => Boolean(r.imageUrl));
  }
  if (filters?.onlyPinned) {
    filtered = filtered.filter((r) => r.isPinned);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.originalTitle.toLowerCase().includes(q) ||
        r.sourceFeed.toLowerCase().includes(q) ||
        r.incidentCode.toLowerCase().includes(q) ||
        r.socraticBrief.toLowerCase().includes(q)
    );
  }

  const limit = Math.min(250, Math.max(1, Number(filters?.limit ?? 150)));

  return {
    incidents: filtered.slice(0, limit),
    transforms,
    counts,
  };
}

export async function getAdminIncidentById(
  db: D1DatabaseLike,
  id: number
): Promise<{ row: AdminIncidentRow; record: AdminIncidentRecord } | null> {
  await ensureEditorialPipelineSchema(db);
  const row = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(id)
    .first<AdminIncidentRow>();
  if (!row) return null;
  return { row, record: mapAdminIncidentRowToRecord(row) };
}

/**
 * Rewrites or restores an incident's headline (`ai_deescalate`, `manual_override`, or `restore_original`),
 * always preserving `original_title` and appending an `incident.rewrite_title` entry to `audit_ledger`.
 */
export async function rewriteIncidentTitle(
  db: D1DatabaseLike,
  input: {
    id: number;
    mode: "ai_deescalate" | "manual_override" | "restore_original";
    newTitle?: string;
    reason?: string;
    geminiApiKey?: string;
    fetchImpl?: typeof fetch;
  },
  actor: EditorialAdminActor
): Promise<{
  incident: AdminIncidentRecord;
  deescalation?: HeadlineDeescalationResult;
  auditEntry: AuditLedgerEntry;
}> {
  await ensureEditorialPipelineSchema(db);

  const existing = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(input.id)
    .first<AdminIncidentRow>();

  if (!existing) {
    throw new Error(`Incident article #${input.id} not found.`);
  }

  const preservedOriginalTitle = (
    existing.original_title ||
    existing.title ||
    ""
  ).trim();

  let nextTitle = existing.title;
  let nextRewritten = 1;
  let nextRewriteReason = (input.reason || "").trim();
  let deescalation: HeadlineDeescalationResult | undefined;

  if (input.mode === "restore_original") {
    nextTitle = preservedOriginalTitle;
    nextRewritten = 0;
    nextRewriteReason =
      input.reason?.trim() || "Restored original source headline";
  } else if (input.mode === "manual_override") {
    const candidate = (input.newTitle || "").trim();
    if (!candidate || candidate.length < 10) {
      throw new Error(
        "Manual title override must be at least 10 characters long."
      );
    }
    nextTitle = candidate;
    nextRewritten = candidate !== preservedOriginalTitle ? 1 : 0;
    nextRewriteReason =
      input.reason?.trim() ||
      "Manual editorial headline neutralization override";
  } else {
    // ai_deescalate
    deescalation = await deescalateHeadlineWithGemini(
      preservedOriginalTitle,
      existing.raw_excerpt,
      input.geminiApiKey,
      {
        fetchImpl: input.fetchImpl,
        forceRewrite: true,
      }
    );
    nextTitle = deescalation.neutralTitle;
    nextRewritten = nextTitle !== preservedOriginalTitle ? 1 : 0;
    nextRewriteReason =
      input.reason?.trim() ||
      deescalation.rationale ||
      "AI de-alarmist headline neutralization";
  }

  await db
    .prepare(
      `UPDATE telemetry_articles
       SET original_title = ?,
           title = ?,
           title_rewritten = ?,
           title_rewrite_reason = ?
       WHERE id = ?`
    )
    .bind(
      preservedOriginalTitle,
      nextTitle,
      nextRewritten,
      nextRewriteReason,
      existing.id
    )
    .run();

  const updated = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(existing.id)
    .first<AdminIncidentRow>();

  if (!updated) {
    throw new Error("Failed to read back updated telemetry_articles row.");
  }

  const incident = mapAdminIncidentRowToRecord(updated);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "incident.rewrite_title",
    targetType: "incident_article",
    targetId: String(existing.id),
    reason:
      nextRewriteReason ||
      `Rewrote headline for incident #${existing.id} (original: "${preservedOriginalTitle}" -> display: "${nextTitle}")`,
    beforeState: existing,
    afterState: updated,
  });

  return { incident, deescalation, auditEntry };
}

/**
 * Attaches, updates, extracts, generates, or removes an image on an incident
 * and appends an `incident.attach_image` record to `audit_ledger`.
 */
export async function attachIncidentImage(
  db: D1DatabaseLike,
  input: {
    id: number;
    mode:
      | "external_url"
      | "r2_upload"
      | "rss_extracted"
      | "wikimedia_commons"
      | "generated_card"
      | "remove";
    imageUrl?: string | null;
    imageAlt?: string | null;
    imageCaption?: string | null;
    reason?: string;
    audioBucket?: R2BucketLike;
    fetchImpl?: typeof fetch;
  },
  actor: EditorialAdminActor
): Promise<{
  incident: AdminIncidentRecord;
  auditEntry: AuditLedgerEntry;
}> {
  await ensureEditorialPipelineSchema(db);

  const existing = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(input.id)
    .first<AdminIncidentRow>();

  if (!existing) {
    throw new Error(`Incident article #${input.id} not found.`);
  }

  const existingRecord = mapAdminIncidentRowToRecord(existing);

  let nextImageUrl: string | null = null;
  let nextImageAlt: string | null = null;
  let nextImageCaption: string | null = null;
  let nextSourceType: ImageSourceType = null;
  let defaultAuditReason = "";

  if (input.mode === "remove") {
    nextImageUrl = null;
    nextImageAlt = null;
    nextImageCaption = null;
    nextSourceType = null;
    defaultAuditReason = `Removed attached image from incident #${existing.id}`;
  } else if (input.mode === "generated_card") {
    const cardFilename = `card-d1-${existing.id}.svg`;
    const svgContent = generateIncidentTelemetrySvgCard({
      incidentCode: existingRecord.incidentCode,
      title: existingRecord.title,
      sourceFeed: existingRecord.sourceFeed,
      publishedAt: existingRecord.publishedAt,
      primaryTool: existingRecord.primaryTool,
      secondaryTool: existingRecord.secondaryTool,
      sreFailureMode: existingRecord.sreFailureMode,
      domainSector: existingRecord.domainSector,
      titleRewritten: existingRecord.titleRewritten,
    });

    if (input.audioBucket) {
      try {
        await input.audioBucket.put(
          `media/${cardFilename}`,
          new TextEncoder().encode(svgContent),
          {
            httpMetadata: { contentType: "image/svg+xml" },
            customMetadata: {
              incidentId: String(existing.id),
              sourceType: "generated_card",
            },
          }
        );
      } catch {
        // Fallback: /media/card-d1-<id>.svg also renders dynamically
      }
    }

    nextImageUrl = `/media/${cardFilename}`;
    nextImageAlt =
      input.imageAlt?.trim() ||
      `${existingRecord.primaryTool} & ${existingRecord.sreFailureMode} — Structural Inspection Card for ${existingRecord.title}`;
    nextImageCaption =
      input.imageCaption?.trim() ||
      `Craft Diagnostic Blueprint Card: ${existingRecord.primaryTool} • ${existingRecord.sreFailureMode} (${existingRecord.incidentCode})`;
    nextSourceType = "generated_card";
    defaultAuditReason = `Attached generated Working Tool SVG telemetry card (${nextImageUrl}) to incident #${existing.id}`;
  } else if (input.mode === "wikimedia_commons") {
    const archival = await resolveContextualPublicDomainImage(
      existingRecord.title,
      existing.raw_excerpt,
      existingRecord.domainSector,
      input.fetchImpl
    );
    if (archival) {
      nextImageUrl = archival.imageUrl;
      nextImageAlt = input.imageAlt?.trim() || archival.imageAlt;
      nextImageCaption = input.imageCaption?.trim() || archival.imageCaption;
      nextSourceType = "wikimedia_commons";
      defaultAuditReason = `Resolved Wikimedia Commons archival photograph (${nextImageUrl}) for incident #${existing.id}`;
    } else {
      const cardFilename = `card-d1-${existing.id}.svg`;
      nextImageUrl = `/media/${cardFilename}`;
      nextImageAlt =
        input.imageAlt?.trim() ||
        `${existingRecord.primaryTool} — Structural Inspection Card for ${existingRecord.title}`;
      nextImageCaption =
        input.imageCaption?.trim() ||
        `No qualifying Wikimedia Commons photograph found; attached ${existingRecord.primaryTool} blueprint card`;
      nextSourceType = "generated_card";
      defaultAuditReason = `No Wikimedia Commons photograph matched; attached fallback telemetry card (${nextImageUrl}) to incident #${existing.id}`;
    }
  } else if (input.mode === "rss_extracted") {
    const extracted = await extractImageFromSourceArticleUrl(
      existing.source_url,
      existingRecord.title,
      input.fetchImpl
    );

    if (extracted) {
      nextImageUrl = extracted.imageUrl;
      nextImageAlt = input.imageAlt?.trim() || extracted.imageAlt;
      nextImageCaption = input.imageCaption?.trim() || extracted.imageCaption;
      nextSourceType = "og_scraped";
      defaultAuditReason = `Extracted source dispatch image (${nextImageUrl}) for incident #${existing.id}`;
    } else {
      const archival = await resolveContextualPublicDomainImage(
        existingRecord.title,
        existing.raw_excerpt,
        existingRecord.domainSector,
        input.fetchImpl
      );
      if (archival) {
        nextImageUrl = archival.imageUrl;
        nextImageAlt = input.imageAlt?.trim() || archival.imageAlt;
        nextImageCaption = input.imageCaption?.trim() || archival.imageCaption;
        nextSourceType = "wikimedia_commons";
        defaultAuditReason = `Source URL had no og:image; resolved Wikimedia Commons archival image (${nextImageUrl}) for incident #${existing.id}`;
      } else {
        // Fallback to generated blueprint card if upstream article has no og:image or blocks crawlers
        const cardFilename = `card-d1-${existing.id}.svg`;
        nextImageUrl = `/media/${cardFilename}`;
        nextImageAlt =
          input.imageAlt?.trim() ||
          `${existingRecord.primaryTool} — Structural Inspection Card for ${existingRecord.title}`;
        nextImageCaption =
          input.imageCaption?.trim() ||
          `Source dispatch had no OpenGraph image; attached ${existingRecord.primaryTool} blueprint card`;
        nextSourceType = "generated_card";
        defaultAuditReason = `Source URL had no extractable og:image; attached fallback telemetry card (${nextImageUrl}) to incident #${existing.id}`;
      }
    }
  } else {
    // external_url or r2_upload
    const cleanUrl = (input.imageUrl || "").trim();
    if (!cleanUrl || !/^(https?:\/\/|\/media\/)/i.test(cleanUrl)) {
      throw new Error(
        "Image URL must start with https://, http://, or /media/"
      );
    }
    nextImageUrl = cleanUrl;
    nextImageAlt =
      input.imageAlt?.trim() || existing.image_alt || existing.title;
    nextImageCaption =
      input.imageCaption !== undefined
        ? input.imageCaption?.trim() || null
        : existing.image_caption;
    nextSourceType =
      input.mode === "r2_upload" || cleanUrl.startsWith("/media/")
        ? "r2_upload"
        : "external_url";
    defaultAuditReason = `Attached ${nextSourceType} image (${nextImageUrl}) to incident #${existing.id}`;
  }

  await db
    .prepare(
      `UPDATE telemetry_articles
       SET image_url = ?,
           image_alt = ?,
           image_caption = ?,
           image_source_type = ?
       WHERE id = ?`
    )
    .bind(
      nextImageUrl,
      nextImageAlt,
      nextImageCaption,
      nextSourceType,
      existing.id
    )
    .run();

  const updated = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(existing.id)
    .first<AdminIncidentRow>();

  if (!updated) {
    throw new Error("Failed to read back updated telemetry_articles row.");
  }

  const incident = mapAdminIncidentRowToRecord(updated);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType: "incident.attach_image",
    targetType: "incident_article",
    targetId: String(existing.id),
    reason: input.reason?.trim() || defaultAuditReason,
    beforeState: existing,
    afterState: updated,
  });

  return { incident, auditEntry };
}

const FRONTEND_TO_JEV_TOOL: Record<string, JevWorkingToolKey> = {
  twenty_four_inch_gauge: "twenty_four_inch_gauge",
  "24-Inch Gauge": "twenty_four_inch_gauge",
  common_gavel: "common_gavel",
  "Common Gavel": "common_gavel",
  plumb: "plumb",
  "The Plumb": "plumb",
  square: "square",
  "The Square": "square",
  level: "level",
  "The Level": "level",
  trowel: "trowel",
  "The Trowel": "trowel",
};

const FRONTEND_TO_JEV_FAILURE: Record<string, JevSreFailureModeKey> = {
  configuration_drift: "configuration_drift",
  "Configuration Drift": "configuration_drift",
  cascading_failure: "cascading_failure",
  "Cascading Failure": "cascading_failure",
  untested_failover: "untested_failover",
  "Single Point of Failure (SPOF) / Untested Failover": "untested_failover",
  alert_fatigue: "alert_fatigue",
  "Alert Fatigue & Signal Loss": "alert_fatigue",
  blameless_postmortem_gap: "blameless_postmortem_gap",
  "Blame Culture vs. Root-Cause Isolation": "blameless_postmortem_gap",
  capacity_exhaustion: "capacity_exhaustion",
  "Technical & Institutional Debt": "capacity_exhaustion",
};

/**
 * Updates an incident's Socratic brief, executive summary, proportionality check,
 * Socratic questions, Working Tool / Failure Mode classifications, or status/visibility,
 * recording `incident.override_brief` or `incident.status_change` in `audit_ledger`.
 */
export async function overrideIncidentBriefAndClassification(
  db: D1DatabaseLike,
  input: {
    id: number;
    actionType?: "incident.override_brief" | "incident.status_change";
    executiveSummary?: string;
    socraticBrief?: string;
    noiseOverblown?: string;
    structuralSignal?: string;
    questions?: string[];
    primaryTool?: string;
    secondaryTool?: string;
    sreFailureMode?: string;
    status?: string;
    editorialNotes?: string | null;
    isPinned?: boolean;
    isHidden?: boolean;
    isLeadPostMortem?: boolean;
    leadPostMortemAnalysis?: string | null;
    reason?: string;
  },
  actor: EditorialAdminActor
): Promise<{
  incident: AdminIncidentRecord;
  auditEntry: AuditLedgerEntry;
}> {
  await ensureEditorialPipelineSchema(db);

  const existing = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(input.id)
    .first<AdminIncidentRow>();

  if (!existing) {
    throw new Error(`Incident article #${input.id} not found.`);
  }

  const existingRecord = mapAdminIncidentRowToRecord(existing);

  const nextPrimaryTool: JevWorkingToolKey =
    input.primaryTool && FRONTEND_TO_JEV_TOOL[input.primaryTool]
      ? FRONTEND_TO_JEV_TOOL[input.primaryTool]
      : existing.primary_tool;

  const nextSecondaryTool: JevWorkingToolKey =
    input.secondaryTool && FRONTEND_TO_JEV_TOOL[input.secondaryTool]
      ? FRONTEND_TO_JEV_TOOL[input.secondaryTool]
      : existing.secondary_tool || "twenty_four_inch_gauge";

  const nextFailureMode: JevSreFailureModeKey =
    input.sreFailureMode && FRONTEND_TO_JEV_FAILURE[input.sreFailureMode]
      ? FRONTEND_TO_JEV_FAILURE[input.sreFailureMode]
      : existing.sre_failure_mode;

  const nextStatus =
    input.status !== undefined && input.status.trim()
      ? input.status.trim()
      : existing.status;

  const nextSocraticBrief =
    input.socraticBrief !== undefined
      ? input.socraticBrief.trim()
      : existingRecord.socraticBrief;

  const nextExecutiveSummary =
    input.executiveSummary !== undefined
      ? input.executiveSummary.trim()
      : existingRecord.executiveSummary;

  const nextNoiseOverblown =
    input.noiseOverblown !== undefined
      ? input.noiseOverblown.trim()
      : existingRecord.proportionalityCheck.noiseOverblown;

  const nextStructuralSignal =
    input.structuralSignal !== undefined
      ? input.structuralSignal.trim()
      : existingRecord.proportionalityCheck.structuralSignal;

  const nextQ1 =
    input.questions && input.questions[0]?.trim()
      ? normalizeQuestionSentenceCase(input.questions[0].trim())
      : existingRecord.questions[0];

  const nextQ2 =
    input.questions && input.questions[1]?.trim()
      ? normalizeQuestionSentenceCase(input.questions[1].trim())
      : existingRecord.questions[1];

  const nextIsLead =
    input.isLeadPostMortem !== undefined
      ? Boolean(input.isLeadPostMortem)
      : existingRecord.isLeadPostMortem;

  const nextLeadAnalysis =
    input.leadPostMortemAnalysis !== undefined
      ? input.leadPostMortemAnalysis?.trim() || null
      : existingRecord.leadPostMortemAnalysis;

  const nextEditorialNotes =
    input.editorialNotes !== undefined
      ? input.editorialNotes?.trim() || null
      : existing.editorial_notes;

  const nextIsPinned =
    input.isPinned !== undefined
      ? input.isPinned
        ? 1
        : 0
      : Number(existing.is_pinned || 0);

  const nextIsHidden =
    input.isHidden !== undefined
      ? input.isHidden
        ? 1
        : 0
      : Number(existing.is_hidden || 0);

  let existingParsedQ: Record<string, unknown> = {};
  if (existing.questions_json) {
    try {
      const p = JSON.parse(existing.questions_json);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        existingParsedQ = p as Record<string, unknown>;
      }
    } catch {
      existingParsedQ = {};
    }
  }

  const nextQuestionsJson = JSON.stringify({
    ...existingParsedQ,
    executive_summary: nextExecutiveSummary,
    proportionality_check: {
      noise_overblown: nextNoiseOverblown,
      structural_signal: nextStructuralSignal,
    },
    questions: [nextQ1, nextQ2],
    is_lead_post_mortem: nextIsLead,
    lead_post_mortem_analysis: nextLeadAnalysis,
    edited_by: actor.actorEmail,
    edited_at: new Date().toISOString(),
  });

  await db
    .prepare(
      `UPDATE telemetry_articles
       SET primary_tool = ?,
           secondary_tool = ?,
           sre_failure_mode = ?,
           socratic_brief = ?,
           questions_json = ?,
           status = ?,
           editorial_notes = ?,
           is_pinned = ?,
           is_hidden = ?
       WHERE id = ?`
    )
    .bind(
      nextPrimaryTool,
      nextSecondaryTool,
      nextFailureMode,
      nextSocraticBrief,
      nextQuestionsJson,
      nextStatus,
      nextEditorialNotes,
      nextIsPinned,
      nextIsHidden,
      existing.id
    )
    .run();

  const updated = await db
    .prepare(
      `SELECT ${ADMIN_INCIDENT_COLUMNS} FROM telemetry_articles WHERE id = ?`
    )
    .bind(existing.id)
    .first<AdminIncidentRow>();

  if (!updated) {
    throw new Error("Failed to read back updated telemetry_articles row.");
  }

  const onlyStatusOrVisibilityChanged =
    input.actionType === "incident.status_change" ||
    (input.executiveSummary === undefined &&
      input.socraticBrief === undefined &&
      input.noiseOverblown === undefined &&
      input.structuralSignal === undefined &&
      input.questions === undefined &&
      input.primaryTool === undefined &&
      input.secondaryTool === undefined &&
      input.sreFailureMode === undefined &&
      (input.status !== undefined ||
        input.isHidden !== undefined ||
        input.isPinned !== undefined));

  const actionType = onlyStatusOrVisibilityChanged
    ? "incident.status_change"
    : "incident.override_brief";

  const incident = mapAdminIncidentRowToRecord(updated);
  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash,
    actionType,
    targetType: "incident_article",
    targetId: String(existing.id),
    reason:
      input.reason?.trim() ||
      (actionType === "incident.status_change"
        ? `Updated status/visibility for incident #${existing.id} (status=${nextStatus}, pinned=${Boolean(
            nextIsPinned
          )}, hidden=${Boolean(nextIsHidden)})`
        : `Editorial brief & classification override for incident #${existing.id} (${incident.primaryTool} / ${incident.sreFailureMode})`),
    beforeState: existing,
    afterState: updated,
  });

  return { incident, auditEntry };
}

/**
 * Stores an uploaded media file in Cloudflare R2 under `media/<timestamp>-<slug>.<ext>`,
 * verifies it via `head()`, and optionally attaches it to a target incident in D1.
 */
export async function uploadAdminMediaToR2(options: {
  db: D1DatabaseLike;
  audioBucket: R2BucketLike;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
  incidentId?: number;
  imageAlt?: string;
  imageCaption?: string;
  reason?: string;
  actor: EditorialAdminActor;
}): Promise<{
  ok: true;
  key: string;
  filename: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  incident?: AdminIncidentRecord;
  auditEntry?: AuditLedgerEntry;
}> {
  const rawName = (options.filename || "incident-image.png").trim();
  const extMatch = rawName.match(/\.(png|jpe?g|webp|gif|svg)$/i);
  const ext = (extMatch ? extMatch[1] : "png").toLowerCase();
  const baseSlug = rawName
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const safeFilename = `${Date.now()}-${baseSlug || "media"}.${ext}`;
  const r2Key = `media/${safeFilename}`;
  const publicUrl = `/media/${safeFilename}`;

  await options.audioBucket.put(r2Key, options.bytes, {
    httpMetadata: {
      contentType: options.contentType || "image/png",
    },
    customMetadata: {
      uploadedBy: options.actor.actorEmail,
      uploadedAt: new Date().toISOString(),
      incidentId: options.incidentId ? String(options.incidentId) : "",
    },
  });

  let incident: AdminIncidentRecord | undefined;
  let auditEntry: AuditLedgerEntry | undefined;

  if (options.incidentId) {
    const attached = await attachIncidentImage(
      options.db,
      {
        id: options.incidentId,
        mode: "r2_upload",
        imageUrl: publicUrl,
        imageAlt: options.imageAlt,
        imageCaption: options.imageCaption,
        reason:
          options.reason?.trim() ||
          `Uploaded media asset ${safeFilename} (${options.bytes.byteLength} bytes) to R2 and attached to incident #${options.incidentId}`,
        audioBucket: options.audioBucket,
      },
      options.actor
    );
    incident = attached.incident;
    auditEntry = attached.auditEntry;
  }

  return {
    ok: true,
    key: r2Key,
    filename: safeFilename,
    url: publicUrl,
    contentType: options.contentType || "image/png",
    sizeBytes: options.bytes.byteLength,
    incident,
    auditEntry,
  };
}
