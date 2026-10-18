import {
  containsInterpolatedHeadline,
  deduplicateSignalAgainstFacts,
  hasDuplicateSentenceBetweenFactsAndSignal,
  isTemplatedOrMalformedCopy,
} from "./sanitize";
import {
  DEFAULT_CRAFT_FAILURE_MODE,
  DEFAULT_CRAFT_WORKING_TOOL,
  DomainSectorId,
  formatCraftLedgerEntry,
  formatFriendlySourceName,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SreFailureModeId,
  stripRawFailureShortCodes,
  WorkingToolId,
} from "./taxonomy";
import {
  sanitizeEpisodeSummaryDefensive,
  stripAiDisclaimers,
} from "./episode-metadata";
import {
  EpisodeExternalSource,
  EpisodeIncidentMarker,
  EpisodeSourcePage,
  EpisodeTranscriptSections,
  IncidentArticle,
  PodcastEpisode,
} from "./types";

/**
 * Public DTO for an editorial Incident Brief.
 * Deliberately excludes all internal telemetry fields:
 * - NO `jevConfidence`, `is_systemic_prob`, `jev_raw_json`, `toolProbabilities`, `classifierLatencyMs`
 * - NO internal database `status` codes or `urlHash` / `ingestedAt` pipeline timestamps
 */
export interface PublicIncidentDto {
  id: string;
  incidentCode: string;
  slug: string;
  sourceFeed: string;
  title: string;
  originalTitle?: string;
  titleRewritten?: boolean;
  titleRewriteReason?: string;
  sourceUrl: string;
  publishedAt: string;
  domainSector: DomainSectorId;
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
  isLeadPostMortem?: boolean;
  leadPostMortemAnalysis?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageCaption?: string;
  imageSourceType?:
    | "rss"
    | "og"
    | "upload"
    | "svg_card"
    | "none"
    | "rss_extracted"
    | "r2_upload"
    | "external_url"
    | "generated_card"
    | null;
  isPinned?: boolean;
}

/**
 * Public DTO for a published Podcast Episode.
 * Deliberately excludes internal `dominantToolPercentage`, R2 storage status codes, and pipeline telemetry.
 */
export interface PublicEpisodeDto {
  id: string;
  slug: string;
  episodeNumber: number;
  series: "weekly_rollup" | "legacy_archive";
  title: string;
  summary: string;
  extendedNotes?: string;
  transcript: string;
  transcriptSections?: EpisodeTranscriptSections;
  audioUrl: string;
  artworkUrl?: string;
  artworkWidescreenUrl?: string;
  aiDisclaimer?: string;
  durationSeconds: number;
  durationFormatted: string;
  fileSizeBytes: number;
  publishedAt: string;
  dominantTool: WorkingToolId;
  dominantFailureMode: SreFailureModeId;
  incidentMarkers: EpisodeIncidentMarker[];
  externalSources?: EpisodeExternalSource[];
  sourcePages?: EpisodeSourcePage[];
}

export interface PublicSnapshotDto {
  ok: true;
  publishedAt: string;
  incidents: PublicIncidentDto[];
  episodes: PublicEpisodeDto[];
}

const VALID_WORKING_TOOLS = new Set<string>([
  "24-Inch Gauge",
  "Common Gavel",
  "The Plumb",
  "The Square",
  "The Level",
  "The Trowel",
]);

const VALID_FAILURE_MODES = new Set<string>([
  "Configuration Drift",
  "Cascading Failure",
  "Single Point of Failure (SPOF) / Untested Failover",
  "Alert Fatigue & Signal Loss",
  "Blame Culture vs. Root-Cause Isolation",
  "Technical & Institutional Debt",
  "Structural Friction",
]);

const FORBIDDEN_PUBLIC_TELEMETRY_TEXT =
  /\b(jev-1\.14\.0|typesafe\s+jev|system-1\s+jev|brier\s+score|pending_retry|quarantined)\b/i;

function sanitizeEditorialText(text: string | undefined | null): string {
  if (!text || typeof text !== "string") return "";
  return stripRawFailureShortCodes(
    text
      .replace(/\bjev-1\.14\.0\b/gi, "")
      .replace(/\s*\(\d+(?:\.\d+)?%\)/g, "")
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Presentation Lexicon Mapper at the view boundary (`mapDtoToCraftLexicon`).
 * Ensures any incident or episode DTO crossing into the public view uses plain-spoken
 * Craft terminology, strips raw internal enum shortCodes (`(CFG-DRIFT)`, `(CASCADE-01)`, etc.),
 * formats ledger numbers cleanly, and defaults unmapped/unknown enums safely to
 * `"Structural Friction"` (failure modes) and `"The Square"` (working tools).
 */
export function mapDtoToCraftLexicon<
  T extends
    | PublicIncidentDto
    | IncidentArticle
    | PublicEpisodeDto
    | PodcastEpisode
    | Record<string, unknown>
>(dto: T): T {
  if (!dto || typeof dto !== "object") {
    return dto;
  }

  const record = { ...(dto as Record<string, unknown>) };

  if ("primaryTool" in record || "sreFailureMode" in record) {
    record.primaryTool = mapWorkingToolToCraftLexicon(
      typeof record.primaryTool === "string"
        ? record.primaryTool
        : DEFAULT_CRAFT_WORKING_TOOL
    );
    record.secondaryTool = mapWorkingToolToCraftLexicon(
      typeof record.secondaryTool === "string"
        ? record.secondaryTool
        : DEFAULT_CRAFT_WORKING_TOOL
    );
    record.sreFailureMode = mapFailureModeToCraftLexicon(
      typeof record.sreFailureMode === "string"
        ? record.sreFailureMode
        : DEFAULT_CRAFT_FAILURE_MODE
    );
  }

  if ("dominantTool" in record || "dominantFailureMode" in record) {
    record.dominantTool = mapWorkingToolToCraftLexicon(
      typeof record.dominantTool === "string"
        ? record.dominantTool
        : DEFAULT_CRAFT_WORKING_TOOL
    );
    record.dominantFailureMode = mapFailureModeToCraftLexicon(
      typeof record.dominantFailureMode === "string"
        ? record.dominantFailureMode
        : DEFAULT_CRAFT_FAILURE_MODE
    );
  }

  if (typeof record.title === "string") {
    record.title = sanitizeEditorialText(record.title);
  }
  if (typeof record.executiveSummary === "string") {
    record.executiveSummary = sanitizeEditorialText(record.executiveSummary);
  }
  if (typeof record.socraticBrief === "string") {
    record.socraticBrief = sanitizeEditorialText(record.socraticBrief);
  }
  if (typeof record.summary === "string") {
    record.summary = sanitizeEditorialText(record.summary);
  }

  if (
    record.proportionalityCheck &&
    typeof record.proportionalityCheck === "object"
  ) {
    const pc = record.proportionalityCheck as {
      noiseOverblown?: string;
      structuralSignal?: string;
    };
    const sanitizedSignal = sanitizeEditorialText(pc.structuralSignal);
    const hasFactsOnRecord =
      typeof record.socraticBrief === "string" ||
      typeof record.executiveSummary === "string";
    record.proportionalityCheck = {
      ...pc,
      noiseOverblown: sanitizeEditorialText(pc.noiseOverblown),
      structuralSignal: hasFactsOnRecord
        ? sanitizeEditorialText(
            deduplicateSignalAgainstFacts(
              [
                typeof record.socraticBrief === "string"
                  ? record.socraticBrief
                  : null,
                typeof record.executiveSummary === "string"
                  ? record.executiveSummary
                  : null,
              ],
              sanitizedSignal,
              typeof record.primaryTool === "string"
                ? record.primaryTool
                : DEFAULT_CRAFT_WORKING_TOOL,
              typeof record.sreFailureMode === "string"
                ? record.sreFailureMode
                : DEFAULT_CRAFT_FAILURE_MODE,
              typeof record.secondaryTool === "string"
                ? record.secondaryTool
                : undefined
            )
          )
        : sanitizedSignal,
    };
  }

  if (Array.isArray(record.questions)) {
    record.questions = record.questions.map((q) =>
      typeof q === "string" ? sanitizeEditorialText(q) : q
    );
  }

  if (Array.isArray(record.incidentMarkers)) {
    record.incidentMarkers = (
      record.incidentMarkers as EpisodeIncidentMarker[]
    ).map((m) => ({
      ...m,
      incidentTitle: sanitizeEditorialText(m.incidentTitle),
      toolApplied: mapWorkingToolToCraftLexicon(m.toolApplied),
    }));
  }

  return record as T;
}
export { formatCraftLedgerEntry, formatFriendlySourceName };

/**
 * Defensive rendering gate for an Incident Brief (`IncidentArticle` or `PublicIncidentDto`).
 * Suppresses rendering cleanly if any editorial copy, attribution, or classification is incomplete or templated.
 */
export function isRenderablePublicIncident(
  inc: Partial<IncidentArticle> | Partial<PublicIncidentDto> | null | undefined
): boolean {
  if (!inc || typeof inc !== "object") return false;

  const id = (inc.id || "").trim();
  const slug = (inc.slug || "").trim();
  const incidentCode = (inc.incidentCode || "").trim();
  const title = (inc.title || "").trim();
  const sourceFeed = (inc.sourceFeed || "").trim();
  const sourceUrl = (inc.sourceUrl || "").trim();
  const publishedAt = (inc.publishedAt || "").trim();

  if (!id || !slug || !incidentCode || title.length < 10 || !sourceFeed) {
    return false;
  }
  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(sourceUrl)) {
    return false;
  }
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) {
    return false;
  }
  if (
    !inc.primaryTool ||
    !VALID_WORKING_TOOLS.has(inc.primaryTool) ||
    !inc.secondaryTool ||
    !VALID_WORKING_TOOLS.has(inc.secondaryTool) ||
    !inc.sreFailureMode ||
    !VALID_FAILURE_MODES.has(inc.sreFailureMode)
  ) {
    return false;
  }

  const executiveSummary = (inc.executiveSummary || "").trim();
  const socraticBrief = (inc.socraticBrief || "").trim();
  const noiseOverblown = (inc.proportionalityCheck?.noiseOverblown || "").trim();
  const structuralSignal = (
    inc.proportionalityCheck?.structuralSignal || ""
  ).trim();

  if (
    executiveSummary.length < 40 ||
    socraticBrief.length < 60 ||
    noiseOverblown.length < 20 ||
    structuralSignal.length < 20
  ) {
    return false;
  }

  if (
    isTemplatedOrMalformedCopy(title) ||
    isTemplatedOrMalformedCopy(executiveSummary) ||
    isTemplatedOrMalformedCopy(socraticBrief) ||
    isTemplatedOrMalformedCopy(noiseOverblown, title) ||
    isTemplatedOrMalformedCopy(structuralSignal, title)
  ) {
    return false;
  }

  if (
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(title) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(executiveSummary) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(socraticBrief) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(noiseOverblown) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(structuralSignal)
  ) {
    return false;
  }

  if (!Array.isArray(inc.questions) || inc.questions.length < 2) {
    return false;
  }
  const q1 = (inc.questions[0] || "").trim();
  const q2 = (inc.questions[1] || "").trim();
  if (
    q1.length < 20 ||
    q2.length < 20 ||
    !q1.endsWith("?") ||
    !q2.endsWith("?") ||
    isTemplatedOrMalformedCopy(q1, title) ||
    isTemplatedOrMalformedCopy(q2, title) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(q1) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(q2)
  ) {
    return false;
  }

  return true;
}

/**
 * Projects an internal `IncidentArticle` into a strict `PublicIncidentDto`,
 * stripping all internal telemetry floats, probability maps, latency metrics, and status codes.
 * Returns `null` if the incident fails defensive rendering gates.
 */
export function projectPublicIncidentDto(
  inc: IncidentArticle | PublicIncidentDto | null | undefined
): PublicIncidentDto | null {
  if (!inc) return null;
  if ("isHidden" in inc && inc.isHidden) {
    return null;
  }
  const mapped = mapDtoToCraftLexicon(inc);
  if (!isRenderablePublicIncident(mapped)) {
    return null;
  }

  const q1 = sanitizeEditorialText(mapped.questions[0]);
  const q2 = sanitizeEditorialText(mapped.questions[1]);

  const primaryTool = mapWorkingToolToCraftLexicon(mapped.primaryTool);
  const secondaryTool = mapWorkingToolToCraftLexicon(mapped.secondaryTool);
  const sreFailureMode = mapFailureModeToCraftLexicon(mapped.sreFailureMode);
  const executiveSummary = sanitizeEditorialText(mapped.executiveSummary);
  const socraticBrief = sanitizeEditorialText(mapped.socraticBrief);
  const deduplicatedSignal = sanitizeEditorialText(
    deduplicateSignalAgainstFacts(
      [socraticBrief, executiveSummary],
      mapped.proportionalityCheck.structuralSignal,
      primaryTool,
      sreFailureMode,
      secondaryTool
    )
  );

  const dto: PublicIncidentDto = {
    id: mapped.id.trim(),
    incidentCode: mapped.incidentCode.trim(),
    slug: mapped.slug.trim(),
    sourceFeed: mapped.sourceFeed.trim(),
    title: sanitizeEditorialText(mapped.title),
    sourceUrl: mapped.sourceUrl.trim(),
    publishedAt: mapped.publishedAt.trim(),
    domainSector: mapped.domainSector,
    primaryTool,
    secondaryTool,
    sreFailureMode,
    executiveSummary,
    socraticBrief,
    proportionalityCheck: {
      noiseOverblown: sanitizeEditorialText(
        mapped.proportionalityCheck.noiseOverblown
      ),
      structuralSignal: deduplicatedSignal,
    },
    questions: [q1, q2],
  };

  if (mapped.originalTitle) {
    dto.originalTitle = sanitizeEditorialText(mapped.originalTitle);
  }
  if (mapped.titleRewritten) {
    dto.titleRewritten = true;
  }
  if (mapped.titleRewriteReason) {
    dto.titleRewriteReason = sanitizeEditorialText(mapped.titleRewriteReason);
  }
  if (mapped.imageUrl) {
    dto.imageUrl = mapped.imageUrl.trim();
    dto.imageAlt = mapped.imageAlt
      ? sanitizeEditorialText(mapped.imageAlt)
      : dto.title;
    if (mapped.imageCaption) {
      dto.imageCaption = sanitizeEditorialText(mapped.imageCaption);
    }
    dto.imageSourceType = mapped.imageSourceType || "svg_card";
  }
  if (mapped.isPinned) {
    dto.isPinned = true;
  }

  if (mapped.isLeadPostMortem && mapped.leadPostMortemAnalysis) {
    dto.isLeadPostMortem = true;
    dto.leadPostMortemAnalysis = sanitizeEditorialText(
      mapped.leadPostMortemAnalysis
    );
  }

  return dto;
}

/**
 * Defensive rendering gate for a Podcast Episode (`PodcastEpisode` or `PublicEpisodeDto`).
 * Requires complete editorial copy, valid metadata, and verified non-zero audio media link.
 */
export function isRenderablePublicEpisode(
  ep: Partial<PodcastEpisode> | Partial<PublicEpisodeDto> | null | undefined
): boolean {
  if (!ep || typeof ep !== "object") return false;

  const id = (ep.id || "").trim();
  const slug = (ep.slug || "").trim();
  const title = (ep.title || "").trim();
  const summary = (ep.summary || "").trim();
  const transcript = (ep.transcript || "").trim();
  const audioUrl = (ep.audioUrl || "").trim();
  const publishedAt = (ep.publishedAt || "").trim();

  if (!id || !slug || title.length < 8 || summary.length < 25 || transcript.length < 60) {
    return false;
  }
  if (!publishedAt || Number.isNaN(Date.parse(publishedAt))) {
    return false;
  }
  // Verified media link check: must be an /audio/*.(mp3|m4a) or https://*.*(mp3|m4a) URL and have non-zero bytes & duration
  if (!/^(\/audio\/[a-zA-Z0-9._-]+\.(?:mp3|m4a)|https?:\/\/[^\s]+\.(?:mp3|m4a))$/i.test(audioUrl)) {
    return false;
  }
  const durationSeconds = Number(ep.durationSeconds ?? 0);
  const fileSizeBytes = Number(ep.fileSizeBytes ?? 0);
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0
  ) {
    return false;
  }
  if (
    isTemplatedOrMalformedCopy(title) ||
    isTemplatedOrMalformedCopy(summary) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(title) ||
    FORBIDDEN_PUBLIC_TELEMETRY_TEXT.test(summary)
  ) {
    return false;
  }

  return true;
}

/**
 * Projects an internal `PodcastEpisode` into a strict `PublicEpisodeDto`,
 * stripping `dominantToolPercentage` and any raw percentage markers from copy.
 */
export function projectPublicEpisodeDto(
  ep: PodcastEpisode | PublicEpisodeDto | null | undefined
): PublicEpisodeDto | null {
  if (!ep) return null;
  const mapped = mapDtoToCraftLexicon(ep);
  if (!isRenderablePublicEpisode(mapped)) {
    return null;
  }

  const dto: PublicEpisodeDto = {
    id: mapped.id.trim(),
    slug: mapped.slug.trim(),
    episodeNumber: Number(mapped.episodeNumber || 42),
    series: mapped.series === "legacy_archive" ? "legacy_archive" : "weekly_rollup",
    title: sanitizeEditorialText(mapped.title),
    summary: sanitizeEditorialText(sanitizeEpisodeSummaryDefensive(mapped.summary)),
    transcript: stripAiDisclaimers(
      stripRawFailureShortCodes(
        (mapped.transcript || "")
          .replace(/\bjev-1\.14\.0\b/gi, "")
          .replace(/\s*\(\d+(?:\.\d+)?%\)/g, "")
      )
    ).trim(),
    audioUrl: mapped.audioUrl.trim(),
    durationSeconds: Number(mapped.durationSeconds),
    durationFormatted: mapped.durationFormatted || "05:00",
    fileSizeBytes: Number(mapped.fileSizeBytes),
    publishedAt: mapped.publishedAt.trim(),
    dominantTool: mapWorkingToolToCraftLexicon(mapped.dominantTool),
    dominantFailureMode: mapFailureModeToCraftLexicon(mapped.dominantFailureMode),
    incidentMarkers: Array.isArray(mapped.incidentMarkers)
      ? mapped.incidentMarkers.map((m) => ({
          incidentId: m.incidentId,
          incidentCode: m.incidentCode,
          incidentSlug: m.incidentSlug,
          incidentTitle: sanitizeEditorialText(m.incidentTitle),
          timestampSeconds: Number(m.timestampSeconds || 0),
          timecodeLabel: m.timecodeLabel || "00:00",
          toolApplied: mapWorkingToolToCraftLexicon(m.toolApplied),
        }))
      : [],
  };

  if (mapped.extendedNotes && mapped.extendedNotes.trim()) {
    dto.extendedNotes = stripAiDisclaimers(mapped.extendedNotes).trim();
  }
  if (Array.isArray(mapped.externalSources) && mapped.externalSources.length > 0) {
    dto.externalSources = mapped.externalSources;
  }
  if (Array.isArray(mapped.sourcePages) && mapped.sourcePages.length > 0) {
    dto.sourcePages = mapped.sourcePages;
  }

  if (mapped.artworkUrl && mapped.artworkUrl.trim()) {
    dto.artworkUrl = mapped.artworkUrl.trim();
  }
  if (mapped.artworkWidescreenUrl && mapped.artworkWidescreenUrl.trim()) {
    dto.artworkWidescreenUrl = mapped.artworkWidescreenUrl.trim();
  }
  if (mapped.aiDisclaimer && mapped.aiDisclaimer.trim()) {
    dto.aiDisclaimer = sanitizeEditorialText(mapped.aiDisclaimer);
  }

  if (mapped.transcriptSections) {
    dto.transcriptSections = {
      weeklyTelemetry: sanitizeEditorialText(
        mapped.transcriptSections.weeklyTelemetry
      ),
      separatingSignalFromPanic: sanitizeEditorialText(
        mapped.transcriptSections.separatingSignalFromPanic
      ),
      forwardPosture: sanitizeEditorialText(
        mapped.transcriptSections.forwardPosture
      ),
    };
  }

  return dto;
}

/**
 * Projects a collection of incidents and episodes into a clean `PublicSnapshotDto`.
 */
export function projectPublicSnapshotDto(input: {
  incidents: Array<IncidentArticle | PublicIncidentDto>;
  episodes: Array<PodcastEpisode | PublicEpisodeDto>;
}): PublicSnapshotDto {
  const incidents: PublicIncidentDto[] = [];
  for (const inc of input.incidents || []) {
    const projected = projectPublicIncidentDto(inc);
    if (projected) {
      incidents.push(projected);
    }
  }

  const episodes: PublicEpisodeDto[] = [];
  for (const ep of input.episodes || []) {
    const projected = projectPublicEpisodeDto(ep);
    if (projected) {
      episodes.push(projected);
    }
  }

  return {
    ok: true,
    publishedAt: new Date().toISOString(),
    incidents,
    episodes,
  };
}

const FORBIDDEN_PUBLIC_JSON_KEYS = new Set<string>([
  "jev_raw_json",
  "is_systemic_prob",
  "jev_confidence",
  "jevConfidence",
  "toolProbabilities",
  "working_tool_probabilities",
  "sre_failure_mode_probabilities",
  "classifierLatencyMs",
  "avgClassifierLatencyMs",
  "avg_latency_ms",
  "dominantToolPercentage",
  "dominant_tool_pct",
  "noiseRejectionRatePercentage",
  "noise_rejection_rate_pct",
  "brierScore",
  "brier_score",
  "sqlitePath",
  "pipelineRuns",
  "pipeline_runs",
  "synthesizedCount",
  "triagedCount",
  "droppedCount",
  "System1Model",
  "system1Model",
  "system2Model",
]);

/**
 * Recursively inspects any public API JSON payload to verify that zero internal telemetry fields,
 * `jev-1.14.0` version tags, raw failure mode shortCodes, or Mad-Libs fallback template strings are present.
 */
export function assertZeroTelemetryBleed(payload: unknown): {
  clean: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  function walk(node: unknown, pathPrefix: string) {
    if (node === null || node === undefined) return;
    if (typeof node === "string") {
      if (/\bjev-1\.14\.0\b/i.test(node)) {
        violations.push(`${pathPrefix}: contains forbidden version tag "jev-1.14.0"`);
      }
      if (
        /\b(CFG-DRIFT|CASCADE-01|SIG-LOSS|SPOF-FAIL|BLAME-ISO|INST-DEBT)\b/i.test(
          node
        )
      ) {
        violations.push(
          `${pathPrefix}: contains forbidden raw failure mode shortCode`
        );
      }
      if (isTemplatedOrMalformedCopy(node)) {
        violations.push(
          `${pathPrefix}: contains fallback template or malformed copy`
        );
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((child, idx) => walk(child, `${pathPrefix}[${idx}]`));
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (
        typeof obj.title === "string" &&
        obj.proportionalityCheck &&
        typeof obj.proportionalityCheck === "object"
      ) {
        const pc = obj.proportionalityCheck as Record<string, unknown>;
        if (
          typeof pc.noiseOverblown === "string" &&
          containsInterpolatedHeadline(pc.noiseOverblown, obj.title)
        ) {
          violations.push(
            `${pathPrefix}.proportionalityCheck.noiseOverblown: contains interpolated headline`
          );
        }
        if (
          typeof pc.structuralSignal === "string" &&
          containsInterpolatedHeadline(pc.structuralSignal, obj.title)
        ) {
          violations.push(
            `${pathPrefix}.proportionalityCheck.structuralSignal: contains interpolated headline`
          );
        }
        if (
          typeof pc.structuralSignal === "string" &&
          hasDuplicateSentenceBetweenFactsAndSignal(
            [
              typeof obj.socraticBrief === "string" ? obj.socraticBrief : null,
              typeof obj.executiveSummary === "string"
                ? obj.executiveSummary
                : null,
            ],
            pc.structuralSignal
          )
        ) {
          violations.push(
            `${pathPrefix}.proportionalityCheck.structuralSignal: duplicates sentence from Section I facts`
          );
        }
        if (Array.isArray(obj.questions)) {
          obj.questions.forEach((q, idx) => {
            if (
              typeof q === "string" &&
              containsInterpolatedHeadline(q, obj.title as string)
            ) {
              violations.push(
                `${pathPrefix}.questions[${idx}]: contains interpolated headline`
              );
            }
          });
        }
      }
      for (const [k, v] of Object.entries(obj)) {
        const currentPath = pathPrefix ? `${pathPrefix}.${k}` : k;
        if (FORBIDDEN_PUBLIC_JSON_KEYS.has(k)) {
          violations.push(`${currentPath}: forbidden telemetry key "${k}"`);
        }
        walk(v, currentPath);
      }
    }
  }

  walk(payload, "");
  return {
    clean: violations.length === 0,
    violations,
  };
}
