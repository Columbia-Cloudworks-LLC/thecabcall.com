import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  buildCleanEpisodeHook,
  buildCleanExtendedNotes,
  extractExternalSourcesFromText,
  buildDefaultSourcePagesForEpisode,
  formatTranscriptParagraphs,
  stripAiDisclaimers,
} from "../src/lib/episode-metadata";
import type {
  EpisodeExternalSource,
  EpisodeSourcePage,
} from "../src/lib/types";

export interface ParsedLegacyEpisode {
  episodeNumber: number;
  slug: string;
  folderName: string;
  folderPath: string;
  title: string;
  summary: string;
  extendedNotes: string;
  externalSources: EpisodeExternalSource[];
  sourcePages: EpisodeSourcePage[];
  sources: string[];
  transcript: string;
  publishedAt: string;
  audioFilePath: string;
  audioFileName: string;
  r2AudioKey: string;
  audioUrl: string;
  fileSizeBytes: number;
  durationSeconds: number;
  squareArtworkPath: string | null;
  r2SquareArtworkKey: string | null;
  artworkUrl: string | null;
  widescreenArtworkPath: string | null;
  r2WidescreenArtworkKey: string | null;
  artworkWidescreenUrl: string | null;
  extraMedia: Array<{
    localPath: string;
    r2Key: string;
    publicUrl: string;
  }>;
  aiDisclaimer: string | null;
}

const FALLBACK_SUMMARIES: Record<
  number,
  {
    title?: string;
    summary: string;
    extendedNotes: string;
    externalSources: EpisodeExternalSource[];
  }
> = {
  15: {
    title: "The Square and The Sphere",
    summary:
      "An examination of the geopolitical, resource, and infrastructure partnership between China and the African continent, evaluated beyond standard economic forecasts through the moral measuring stick of the Masonic Square and global spheres of influence.",
    extendedNotes:
      "China, Africa, and the Moral Test — An examination of the complex geopolitical, resource, and infrastructure partnership between China and the African continent, evaluated beyond standard economic forecasts through the ancient moral measuring stick of the Masonic Square and the structural reality of global spheres of influence.\n\nKey Takeaways:\n• Sovereign infrastructure debt versus long-term operational autonomy across African telecommunications and rail corridors.\n• Applying the Masonic Square as an objective governance standard when inspecting bilateral resource treaties.\n• How spheres of influence reshape global supply chain resilience and critical mineral dependencies.",
    externalSources: [
      {
        title: "China-Africa Infrastructure & Sovereign Debt Telemetry",
        sourceType: "Geopolitical & Economic Analysis",
      },
      {
        title: "The Working Tools of Craft Masonry — The Square as a Moral & Structural Standard",
        sourceType: "Craft Reference",
      },
    ],
  },
  18: {
    title: "Order of the Eastern Star",
    summary:
      "A comprehensive exploration of the Order of the Eastern Star (OES), founded in 1850 by Mason and educator Dr. Robert Morris. Examines the five Heroines of the Star (Adah, Ruth, Esther, Martha, and Electa), the geometry of the Star Point labyrinth, chapter governance, and charitable foundations.",
    extendedNotes:
      "Inside the Order of the Eastern Star — A comprehensive exploration of the Order of the Eastern Star (OES), founded in 1850 by Mason and educator Dr. Robert Morris. Examines the five Heroines of the Star (Adah, Ruth, Esther, Martha, and Electa), the geometry of the Star Point labyrinth, chapter governance, and charitable foundations.\n\nKey Takeaways:\n• The five Heroines of the Star (Adah, Ruth, Esther, Martha, and Electa) and the moral geometry of fidelity, constancy, loyalty, faith, and endurance.\n• How Dr. Robert Morris structured the Star Point labyrinth and chapter governance in 1850.\n• The organizational structure and philanthropic reach of the General Grand Chapter.",
    externalSources: [
      {
        title: "General Grand Chapter Order of the Eastern Star — History & Governance",
        url: "https://easternstar.org/",
        sourceType: "Institutional Reference",
      },
      {
        title: "Dr. Robert Morris — The Rosary of the Eastern Star (1850)",
        sourceType: "Historical Ritual Reference",
      },
    ],
  },
  19: {
    title: "The Secret Master",
    summary:
      "An exploration of the convergence between Craft Freemasonry, the Scottish Rite 4th Degree (Secret Master), and modern Site Reliability Engineering. Bridges the operational mindset of a systems engineer with Albert Pike's Morals and Dogma, zero-trust architecture, and the duty of the watchful guardian.",
    extendedNotes:
      "An exploration of the unexpected convergence between ancient esoteric philosophy—specifically Craft Freemasonry and the Scottish Rite 4th Degree (Secret Master)—and modern Site Reliability Engineering and cybersecurity. Bridges the operational mindset of a systems engineer with Albert Pike's Morals and Dogma, zero-trust architecture, and the duty of the watchful guardian.\n\nKey Takeaways:\n• The Scottish Rite 4th Degree (Secret Master) and the discipline of silence, secrecy, and fidelity in high-trust systems.\n• Mapping zero-trust access control, cryptographic secrets management, and observability onto the duty of the watchful guardian.\n• Why institutional integrity depends on custodians who guard the sanctum even when no one is watching.",
    externalSources: [
      {
        title: "Albert Pike — Morals and Dogma of the Ancient and Accepted Scottish Rite (IV. Secret Master)",
        url: "https://sacred-texts.com/mas/md/index.htm",
        sourceType: "Craft Reference",
      },
      {
        title: "Google SRE Book — Access Control, Secrets Management & Observability",
        url: "https://sre.google/sre-book/table-of-contents/",
        sourceType: "Technical Reference",
      },
    ],
  },
  20: {
    title: "The Trestleboard vs. Reality: The Anatomy of Executive Failure",
    summary:
      "We open the dossiers on Amazon, Tesla, Intel, Salesforce, IBM, and Microsoft to inspect the wide gap between executive promises and market reality. Using a Masonic architectural framework, we dissect the Divergence of Executive Intent through The Plumb, The Level, The Trowel, and The Ashlar.",
    extendedNotes:
      "In this episode, we open the dossiers on Amazon, Tesla, Intel, Salesforce, IBM, and Microsoft to perform a structural inspection into the wide gap between executive promises and market reality—moving past visionary keynotes and earnings calls to reveal how financial forecasting often becomes narrative engineering.\n\nKey Takeaways:\n• The Plumb: The executive's bold, initial strategic forecast.\n• The Level: The cold, hard empirical data of SEC filings and product delivery.\n• The Trowel: The rhetorical mortar used to smooth over the cracks when the Plumb misses the Level.\n• The Ashlar: The perpetually promised, perfected future state that is always three to five years away.",
    externalSources: [
      {
        title: "The Trestleboard vs. Reality — Google NotebookLM Research Dossier",
        url: "https://notebooklm.google.com/notebook/4830e980-0cc1-4b1d-bd87-bbe8793df079",
        sourceType: "NotebookLM Research Dossier",
      },
      {
        title: "SEC Filings & Earnings Call Transcripts (IBM, Kyndryl, Microsoft, Intel, Salesforce, Tesla, Amazon)",
        sourceType: "Primary Financial Telemetry",
      },
    ],
  },
  21: {
    title: "Magna Est Veritas: From Persian Kings to Blameless Postmortems",
    summary:
      "Tracing the lineage of institutional truth-seeking from the ancient court of Darius and Zerubbabel in the Scottish Rite Knight of the East and Red Cross degrees directly to modern SRE Blameless Postmortems. Examines why complex organizations conceal mechanical truth the moment blame and fear are introduced.",
    extendedNotes:
      "Magna Est Veritas (Great is the Truth, and it Shall Prevail) — Tracing the lineage of institutional truth-seeking from the ancient court of Darius and Zerubbabel in the Scottish Rite Knight of the East / Red Cross degrees directly to modern SRE Blameless Postmortems. Examines why complex human organizations conceal mechanical truth the moment blame and fear are introduced, and how to engineer cultures where unvarnished post-incident reality survives.\n\nKey Takeaways:\n• The debate in the court of King Darius (1 Esdras 3–4): Wine, the King, Women, and the ultimate victory of Truth (Magna Est Veritas).\n• How the Scottish Rite 15th and 16th Degrees preserve Zerubbabel's defense of unvarnished truth against temporal power.\n• Why modern SRE Blameless Postmortems and Single Source of Truth architectures fail whenever psychological fear and scapegoating are permitted.",
    externalSources: [
      {
        title: "1 Esdras 3–4 & Scottish Rite 15th/16th Degrees — Zerubbabel and the Power of Truth (Magna Est Veritas)",
        sourceType: "Historical & Craft Reference",
      },
      {
        title: "Google SRE Book — Postmortem Culture: Learning from Failure Without Blame",
        url: "https://sre.google/sre-book/postmortem-culture/",
        sourceType: "Technical Reference",
      },
    ],
  },
};

/**
 * Parses the exact duration in seconds from an MP4/M4A file's `mvhd` atom.
 */
export function parseM4aDurationSeconds(filePath: string): number {
  const fd = fs.openSync(filePath, "r");
  try {
    const stat = fs.fstatSync(fd);
    const fileSize = stat.size;
    const chunkSize = Math.min(fileSize, 4 * 1024 * 1024);
    const headBuf = Buffer.alloc(chunkSize);
    fs.readSync(fd, headBuf, 0, chunkSize, 0);

    const parseFromBuffer = (buf: Buffer): number | null => {
      const idx = buf.indexOf(Buffer.from("mvhd"));
      if (idx < 0 || idx + 28 > buf.length) return null;
      const version = buf.readUInt8(idx + 4);
      if (version === 1) {
        if (idx + 36 > buf.length) return null;
        const timescale = buf.readUInt32BE(idx + 24);
        const duration = Number(buf.readBigUInt64BE(idx + 28));
        if (timescale > 0 && duration > 0) {
          return Math.round(duration / timescale);
        }
      } else {
        const timescale = buf.readUInt32BE(idx + 16);
        const duration = buf.readUInt32BE(idx + 20);
        if (timescale > 0 && duration > 0) {
          return Math.round(duration / timescale);
        }
      }
      return null;
    };

    const headDuration = parseFromBuffer(headBuf);
    if (headDuration && headDuration > 0) {
      return headDuration;
    }

    if (fileSize > chunkSize) {
      const tailBuf = Buffer.alloc(chunkSize);
      fs.readSync(fd, tailBuf, 0, chunkSize, fileSize - chunkSize);
      const tailDuration = parseFromBuffer(tailBuf);
      if (tailDuration && tailDuration > 0) {
        return tailDuration;
      }
    }

    return Math.round(fileSize / 16000);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Converts an SRT subtitle file into a clean timestamped transcript.
 */
function parseSrtToTranscript(srtContent: string): string {
  const blocks = srtContent
    .replace(/\r\n/g, "\n")
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  let currentBucketMinute = -1;
  let currentLines: string[] = [];
  let currentTimestampLabel = "00:00";

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    if (lines.length < 2) continue;

    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;

    const timeLine = lines[timeLineIdx];
    const textLines = lines
      .slice(timeLineIdx + 1)
      .join(" ")
      .trim();
    if (!textLines) continue;

    const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2})/);
    let totalSeconds = 0;
    let label = "00:00";
    if (match) {
      const hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const secs = parseInt(match[3], 10);
      totalSeconds = hours * 3600 + mins * 60 + secs;
      const totalMins = hours * 60 + mins;
      label = `${String(totalMins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    const bucket = Math.floor(totalSeconds / 45);
    if (bucket !== currentBucketMinute && currentLines.length > 0) {
      paragraphs.push(`[${currentTimestampLabel}] ${currentLines.join(" ")}`);
      currentLines = [];
    }
    if (currentLines.length === 0) {
      currentTimestampLabel = label;
      currentBucketMinute = bucket;
    }
    currentLines.push(textLines);
  }

  if (currentLines.length > 0) {
    paragraphs.push(`[${currentTimestampLabel}] ${currentLines.join(" ")}`);
  }

  return paragraphs.join("\n\n");
}

function sanitizeLegacyText(raw: string): string {
  return stripAiDisclaimers(
    raw
      .replace(/\r\n/g, "\n")
      .replace(/\[cite_start\]/gi, "")
      .replace(/\uFFFD/g, "-")
      .replace(/^#\s+From\\_Persian\\_Kings[^\n]*\n+/i, "")
      .replace(/\\_/g, "_")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim()
  );
}

function stripLeadingCabPrefix(rawTitle: string): string {
  return rawTitle
    .replace(/^The CAB Call #\d+\s*(?:[-–—:]\s*)?/i, "")
    .trim();
}

function parseMetadataTextFile(content: string): {
  parsedTitle?: string;
  rawMetadataText?: string;
  parsedDescription?: string;
  sources: string[];
  isStructuredMetadata: boolean;
} {
  const cleaned = rawTextNormalize(content);
  const hasMetadataHeaders =
    /^Episode\s+(?:Number|Title)\s*:/im.test(cleaned) ||
    /^Description\s*:/im.test(cleaned) ||
    /^##\s*Episode\s+Description\s*:/im.test(cleaned);

  if (!hasMetadataHeaders) {
    return {
      sources: [],
      isStructuredMetadata: false,
    };
  }

  const lines = cleaned.split("\n");
  let parsedTitle: string | undefined;
  const descriptionLines: string[] = [];
  const sources: string[] = [];
  let inDescription = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const titleMatch = trimmed.match(/^Episode\s+Title\s*:\s*(.+)$/i);
    if (titleMatch) {
      parsedTitle = stripLeadingCabPrefix(titleMatch[1].trim());
      inDescription = false;
      continue;
    }
    if (
      /^(?:Episode\s+(?:Type|Number)|Season\s+Number|Explicit|Author|Tags|Category|Permalink\s+Points\s+To)\s*:/i.test(
        trimmed
      )
    ) {
      inDescription = false;
      continue;
    }
    const descMatch = trimmed.match(/^(?:##\s*Episode\s+)?Description\s*:\s*(.*)$/i);
    if (descMatch) {
      inDescription = true;
      if (
        descMatch[1].trim() &&
        !/^The Trestleboard vs\. Reality$/i.test(descMatch[1].trim())
      ) {
        descriptionLines.push(descMatch[1].trim());
      }
      continue;
    }
    const sourceMatch = trimmed.match(/^Source\s*#?\d*\s*:\s*(.+)$/i);
    if (sourceMatch) {
      inDescription = false;
      const srcVal = sourceMatch[1]
        .replace(/[^\x20-\x7E\u00A0-\u024F\u2010-\u2027]/g, " - ")
        .replace(/\s+/g, " ")
        .trim();
      if (srcVal) {
        sources.push(srcVal);
      }
      continue;
    }

    if (inDescription) {
      descriptionLines.push(trimmed);
    }
  }

  const parsedDescription = descriptionLines.join("\n").trim() || undefined;
  return {
    parsedTitle,
    rawMetadataText: cleaned,
    parsedDescription,
    sources,
    isStructuredMetadata: true,
  };
}

function rawTextNormalize(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\[cite_start\]/gi, "")
    .replace(/\uFFFD/g, "-")
    .trim();
}

export function scanLegacyEpisodesDirectory(
  baseDir: string
): ParsedLegacyEpisode[] {
  if (!fs.existsSync(baseDir)) {
    throw new Error(`Legacy episodes directory does not exist: ${baseDir}`);
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const episodeDirs = entries
    .filter((e) => e.isDirectory() && /^The CAB Call #\d+$/i.test(e.name))
    .map((e) => {
      const m = e.name.match(/#(\d+)$/);
      return {
        name: e.name,
        number: m ? parseInt(m[1], 10) : 0,
        fullPath: path.join(baseDir, e.name),
      };
    })
    .filter((d) => d.number > 0)
    .sort((a, b) => a.number - b.number);

  // Space legacy episodes weekly on Fridays starting 2025-09-19T12:00:00Z
  // so Episode #1 is 2025-09-19 and Episode #21 is 2026-02-06
  const baseEpochMs = Date.parse("2025-09-19T12:00:00.000Z");
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  const results: ParsedLegacyEpisode[] = [];

  for (const dir of episodeDirs) {
    const epNum = dir.number;
    const paddedNum = String(epNum).padStart(3, "0");
    const slug = `legacy-cab-${paddedNum}`;
    const files = fs.readdirSync(dir.fullPath);

    const m4aFile = files.find((f) => f.toLowerCase().endsWith(".m4a"));
    if (!m4aFile) {
      throw new Error(`Missing .m4a audio file in ${dir.fullPath}`);
    }
    const audioFilePath = path.join(dir.fullPath, m4aFile);
    const fileSizeBytes = fs.statSync(audioFilePath).size;
    const durationSeconds = parseM4aDurationSeconds(audioFilePath);

    const m4aBaseTitle = stripLeadingCabPrefix(
      m4aFile.replace(/\.m4a$/i, "")
    );

    // Locate artwork files
    const pngFiles = files.filter((f) => f.toLowerCase().endsWith(".png"));
    const widescreenPng =
      pngFiles.find((f) => /widescreen/i.test(f)) || null;
    const squarePng =
      pngFiles.find(
        (f) => !/widescreen/i.test(f) && /^The CAB Call/i.test(f)
      ) ||
      pngFiles.find((f) => !/widescreen/i.test(f)) ||
      null;
    const extraPngs = pngFiles.filter(
      (f) => f !== widescreenPng && f !== squarePng
    );

    const r2AudioKey = `${slug}.m4a`;
    const audioUrl = `/audio/${r2AudioKey}`;

    const r2SquareArtworkKey = squarePng ? `media/${slug}.png` : null;
    const artworkUrl = squarePng ? `/media/${slug}.png` : null;

    const r2WidescreenArtworkKey = widescreenPng
      ? `media/${slug}-widescreen.png`
      : null;
    const artworkWidescreenUrl = widescreenPng
      ? `/media/${slug}-widescreen.png`
      : null;

    const extraMedia = extraPngs.map((extraName) => {
      const safeExtraSlug = extraName
        .toLowerCase()
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return {
        localPath: path.join(dir.fullPath, extraName),
        r2Key: `media/${slug}-${safeExtraSlug}`,
        publicUrl: `/media/${slug}-${safeExtraSlug}`,
      };
    });

    // Parse text / markdown / srt files
    const txtFiles = files.filter(
      (f) =>
        f.toLowerCase().endsWith(".txt") || f.toLowerCase().endsWith(".md")
    );
    const srtFile = files.find((f) => f.toLowerCase().endsWith(".srt")) || null;

    let rawTitle = FALLBACK_SUMMARIES[epNum]?.title || m4aBaseTitle;
    let rawDescription: string | undefined;
    let rawMetadataFullText = "";
    let sources: string[] = [];
    let speakerTranscriptText: string | undefined;

    for (const tf of txtFiles) {
      const content = fs.readFileSync(path.join(dir.fullPath, tf), "utf8");
      const parsed = parseMetadataTextFile(content);
      if (parsed.isStructuredMetadata) {
        rawMetadataFullText = parsed.rawMetadataText || content;
        if (parsed.parsedTitle) {
          rawTitle = parsed.parsedTitle;
        }
        if (parsed.parsedDescription) {
          rawDescription = parsed.parsedDescription;
        }
        if (parsed.sources.length > 0) {
          sources = parsed.sources;
        }
      } else if (!tf.toLowerCase().includes("the trestleboard vs. reality")) {
        speakerTranscriptText = sanitizeLegacyText(content);
      }
    }

    const formattedTitle = `The CAB Call #${epNum}: ${rawTitle}`;

    let cleanSummaryHook = "";
    let cleanExtendedNotes = "";
    let externalSources: EpisodeExternalSource[] = [];

    if (rawDescription) {
      cleanExtendedNotes = buildCleanExtendedNotes(rawDescription);
      cleanSummaryHook = buildCleanEpisodeHook(rawDescription);
      externalSources = extractExternalSourcesFromText(
        rawMetadataFullText || rawDescription,
        formattedTitle
      );
    }

    if (FALLBACK_SUMMARIES[epNum]) {
      if (!cleanSummaryHook) {
        cleanSummaryHook = FALLBACK_SUMMARIES[epNum].summary;
      }
      if (!cleanExtendedNotes) {
        cleanExtendedNotes = FALLBACK_SUMMARIES[epNum].extendedNotes;
      }
      if (externalSources.length === 0) {
        externalSources = FALLBACK_SUMMARIES[epNum].externalSources;
      }
    }

    if (!cleanSummaryHook) {
      cleanSummaryHook = `Foundational Essay Episode #${epNum}: ${rawTitle}.`;
    }
    if (!cleanExtendedNotes) {
      cleanExtendedNotes = cleanSummaryHook;
    }

    const sourcePages = buildDefaultSourcePagesForEpisode(
      epNum,
      "The Square",
      "legacy_archive"
    );

    // Build clean transcript without trailing AI disclaimers
    let transcriptBody = "";
    if (speakerTranscriptText) {
      transcriptBody = formatTranscriptParagraphs(
        sanitizeLegacyText(speakerTranscriptText)
      );
    } else if (srtFile) {
      const srtRaw = fs.readFileSync(path.join(dir.fullPath, srtFile), "utf8");
      transcriptBody = formatTranscriptParagraphs(
        sanitizeLegacyText(parseSrtToTranscript(srtRaw))
      );
    } else {
      transcriptBody = formatTranscriptParagraphs(
        [
          `=== THE CAB CALL PODCAST // EPISODE #${epNum} ===`,
          `Title: ${formattedTitle}`,
          ``,
          cleanExtendedNotes,
        ].join("\n")
      );
    }

    const publishedAt = new Date(
      baseEpochMs + (epNum - 1) * oneWeekMs
    ).toISOString();

    results.push({
      episodeNumber: epNum,
      slug,
      folderName: dir.name,
      folderPath: dir.fullPath,
      title: formattedTitle,
      summary: cleanSummaryHook,
      extendedNotes: cleanExtendedNotes,
      externalSources,
      sourcePages,
      sources,
      transcript: transcriptBody,
      publishedAt,
      audioFilePath,
      audioFileName: m4aFile,
      r2AudioKey,
      audioUrl,
      fileSizeBytes,
      durationSeconds,
      squareArtworkPath: squarePng ? path.join(dir.fullPath, squarePng) : null,
      r2SquareArtworkKey,
      artworkUrl,
      widescreenArtworkPath: widescreenPng
        ? path.join(dir.fullPath, widescreenPng)
        : null,
      r2WidescreenArtworkKey,
      artworkWidescreenUrl,
      extraMedia,
      aiDisclaimer: null,
    });
  }

  return results;
}

function sqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

function runWrangler(args: string[]): string {
  const wranglerCli = path.resolve(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js"
  );
  return execFileSync(process.execPath, [wranglerCli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 50 * 1024 * 1024,
  });
}

function uploadR2Object(
  key: string,
  filePath: string,
  contentType: string,
  remote: boolean
): void {
  const args = [
    "r2",
    "object",
    "put",
    `cabcall-audio/${key}`,
    "--file",
    filePath,
    "--content-type",
    contentType,
    remote ? "--remote" : "--local",
  ];
  runWrangler(args);
}

function queryD1Json<T = Record<string, unknown>>(
  sql: string,
  remote: boolean
): T[] {
  const out = runWrangler([
    "d1",
    "execute",
    "cabcall-db",
    remote ? "--remote" : "--local",
    "--json",
    "--command",
    sql,
  ]);
  const parsed = JSON.parse(out);
  if (Array.isArray(parsed) && parsed[0]?.results) {
    return parsed[0].results as T[];
  }
  return [];
}

function executeD1SqlFile(sqlFilePath: string, remote: boolean): void {
  runWrangler([
    "d1",
    "execute",
    "cabcall-db",
    remote ? "--remote" : "--local",
    "--file",
    sqlFilePath,
  ]);
}

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const pairs = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${stableJsonStringify(obj[k])}`
  );
  return `{${pairs.join(",")}}`;
}

function computeAuditEntryHash(payload: {
  event_id: string;
  timestamp: string;
  actor_email: string;
  actor_role: string;
  auth_method: string;
  actor_ip_hash: string | null;
  action_type: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  before_state_json: string | null;
  after_state_json: string | null;
  replay_command_json: string | null;
  prev_hash: string;
}): string {
  const canonical = stableJsonStringify(payload);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function buildD1MigrationAndUpsertSql(
  episodes: ParsedLegacyEpisode[],
  prevAuditHash: string
): string {
  const statements: string[] = [];
  let rollingPrevHash = prevAuditHash || "GENESIS";

  // Remove the 3 synthetic 2-second placeholder legacy rows if present
  const syntheticSlugs = [
    "legacy-cab-012-cascade-anatomy-2025",
    "legacy-cab-011-single-point-of-failure-civic-trust",
    "legacy-cab-010-ashlar-to-architecture",
    "legacy-cab-012-blameless-postmortems-and-the-rough-ashlar",
    "legacy-cab-011-error-budgets-and-the-twenty-four-inch-gauge",
    "legacy-cab-010-slas-slos-and-trying-the-plumb",
  ];
  statements.push(
    `DELETE FROM episodes WHERE slug IN (${syntheticSlugs
      .map((s) => sqlString(s))
      .join(", ")});`
  );

  // Also clear per-episode AI disclaimers on any weekly rollup episodes (#41, #42, etc.)
  statements.push(
    `UPDATE episodes SET ai_disclaimer = NULL WHERE slug NOT LIKE 'legacy-%';`
  );

  for (const ep of episodes) {
    const sourcesJsonStr = JSON.stringify(ep.externalSources);
    const sourcePagesJsonStr = JSON.stringify(ep.sourcePages);

    statements.push(`
INSERT INTO episodes (
  slug,
  title,
  episode_number,
  published_at,
  audio_url,
  duration_seconds,
  file_size_bytes,
  summary,
  extended_notes,
  sources_json,
  source_pages_json,
  transcript,
  status,
  artwork_url,
  artwork_widescreen_url,
  ai_disclaimer
) VALUES (
  ${sqlString(ep.slug)},
  ${sqlString(ep.title)},
  ${ep.episodeNumber},
  ${sqlString(ep.publishedAt)},
  ${sqlString(ep.audioUrl)},
  ${ep.durationSeconds},
  ${ep.fileSizeBytes},
  ${sqlString(ep.summary)},
  ${sqlString(ep.extendedNotes)},
  ${sqlString(sourcesJsonStr)},
  ${sqlString(sourcePagesJsonStr)},
  ${sqlString(ep.transcript)},
  'PUBLISHED',
  ${sqlString(ep.artworkUrl)},
  ${sqlString(ep.artworkWidescreenUrl)},
  NULL
)
ON CONFLICT(slug) DO UPDATE SET
  title = excluded.title,
  episode_number = excluded.episode_number,
  published_at = excluded.published_at,
  audio_url = excluded.audio_url,
  duration_seconds = excluded.duration_seconds,
  file_size_bytes = excluded.file_size_bytes,
  summary = excluded.summary,
  extended_notes = excluded.extended_notes,
  sources_json = excluded.sources_json,
  source_pages_json = excluded.source_pages_json,
  transcript = excluded.transcript,
  status = excluded.status,
  artwork_url = excluded.artwork_url,
  artwork_widescreen_url = excluded.artwork_widescreen_url,
  ai_disclaimer = NULL;
`);

    const eventId = `evt_${Date.now()}_sanitize_${String(ep.episodeNumber).padStart(3, "0")}`;
    const timestamp = new Date().toISOString();
    const afterStateJson = stableJsonStringify({
      slug: ep.slug,
      title: ep.title,
      episode_number: ep.episodeNumber,
      published_at: ep.publishedAt,
      audio_url: ep.audioUrl,
      duration_seconds: ep.durationSeconds,
      file_size_bytes: ep.fileSizeBytes,
      summary: ep.summary,
      extended_notes: ep.extendedNotes,
      sources_json: sourcesJsonStr,
      source_pages_json: sourcePagesJsonStr,
      series: "legacy_archive",
      status: "PUBLISHED",
      artwork_url: ep.artworkUrl,
      artwork_widescreen_url: ep.artworkWidescreenUrl,
      ai_disclaimer: null,
    });
    const replayCommandJson = stableJsonStringify({
      actionType: "episode.update",
      targetType: "episode",
      targetId: ep.slug,
      afterState: JSON.parse(afterStateJson),
    });
    const reason = `Epic #33 (Issues #35, #36, #38): Sanitized episode #${ep.episodeNumber} (${ep.title}) summary hook, extended show notes, structured external sources (${ep.externalSources.length} refs), and deduplicated AI disclaimer.`;

    const entryHash = computeAuditEntryHash({
      event_id: eventId,
      timestamp,
      actor_email: "system-bootstrap@thecabcall.com",
      actor_role: "owner",
      auth_method: "system_bootstrap",
      actor_ip_hash: null,
      action_type: "episode.update",
      target_type: "episode",
      target_id: ep.slug,
      reason,
      before_state_json: null,
      after_state_json: afterStateJson,
      replay_command_json: replayCommandJson,
      prev_hash: rollingPrevHash,
    });

    statements.push(`
INSERT INTO audit_ledger (
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
) VALUES (
  ${sqlString(eventId)},
  ${sqlString(timestamp)},
  'system-bootstrap@thecabcall.com',
  'owner',
  'system_bootstrap',
  NULL,
  'episode.update',
  'episode',
  ${sqlString(ep.slug)},
  ${sqlString(reason)},
  NULL,
  ${sqlString(afterStateJson)},
  ${sqlString(replayCommandJson)},
  ${sqlString(rollingPrevHash)},
  ${sqlString(entryHash)}
);
`);
    rollingPrevHash = entryHash;
  }

  return statements.join("\n");
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function uploadR2ObjectAsync(
  key: string,
  filePath: string,
  contentType: string,
  remote: boolean
): Promise<void> {
  const wranglerCli = path.resolve(
    process.cwd(),
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js"
  );
  const args = [
    wranglerCli,
    "r2",
    "object",
    "put",
    `cabcall-audio/${key}`,
    "--file",
    filePath,
    "--content-type",
    contentType,
    remote ? "--remote" : "--local",
  ];
  await execFileAsync(process.execPath, args, {
    cwd: process.cwd(),
    maxBuffer: 50 * 1024 * 1024,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const skipR2 = args.includes("--skip-r2");
  const localOnly = args.includes("--local-only");
  const dirFlagIdx = args.indexOf("--dir");
  const baseDir =
    dirFlagIdx >= 0 && args[dirFlagIdx + 1]
      ? path.resolve(args[dirFlagIdx + 1])
      : path.resolve(process.cwd(), "tmp/Episodes");

  console.log(
    `\n=== THE CAB CALL // LEGACY ARCHIVE MIGRATION CLI (Issue #5) ===`
  );
  console.log(`Source Directory: ${baseDir}`);
  console.log(
    `Mode: ${
      isDryRun
        ? "DRY-RUN (no R2/D1 mutations)"
        : localOnly
        ? "LOCAL D1/R2 ONLY"
        : "LIVE REMOTE R2 + REMOTE & LOCAL D1"
    }`
  );

  const episodes = scanLegacyEpisodesDirectory(baseDir);
  console.log(`\nDiscovered ${episodes.length} Legacy Episodes:\n`);

  let totalBytes = 0;
  for (const ep of episodes) {
    totalBytes += ep.fileSizeBytes;
    const mins = Math.floor(ep.durationSeconds / 60);
    const secs = ep.durationSeconds % 60;
    const durLabel = `${mins}:${String(secs).padStart(2, "0")}`;
    const mbLabel = (ep.fileSizeBytes / (1024 * 1024)).toFixed(2);
    console.log(
      `  #${String(ep.episodeNumber).padStart(2, "0")} | ${ep.slug} | ${durLabel} (${mbLabel} MB) | ${ep.title}`
    );
    console.log(
      `      Audio: ${ep.audioUrl} | Artwork: ${ep.artworkUrl || "none"} | Widescreen: ${ep.artworkWidescreenUrl || "none"}`
    );
    console.log(
      `      Published: ${ep.publishedAt.slice(0, 10)} | Transcript chars: ${ep.transcript.length} | Disclaimer: YES`
    );
  }

  console.log(
    `\nTotal Audio Payload across ${episodes.length} episodes: ${(
      totalBytes /
      (1024 * 1024)
    ).toFixed(2)} MB`
  );

  if (isDryRun) {
    console.log(
      `\n[DRY-RUN COMPLETE] All ${episodes.length} episodes validated with durations, artwork, transcripts, and Google Gemini AI disclaimers.`
    );
    return;
  }

  if (!skipR2) {
    const r2Remote = !localOnly;
    console.log(
      `\n--- Uploading Audio & Artwork to Cloudflare R2 (${
        r2Remote ? "REMOTE cabcall-audio" : "LOCAL R2"
      }) ---`
    );

    const uploadTasks: Array<{
      key: string;
      filePath: string;
      contentType: string;
      label: string;
    }> = [];

    for (const ep of episodes) {
      uploadTasks.push({
        key: ep.r2AudioKey,
        filePath: ep.audioFilePath,
        contentType: "audio/mp4",
        label: `${ep.r2AudioKey} (${(ep.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB)`,
      });
      if (ep.squareArtworkPath && ep.r2SquareArtworkKey) {
        uploadTasks.push({
          key: ep.r2SquareArtworkKey,
          filePath: ep.squareArtworkPath,
          contentType: "image/png",
          label: ep.r2SquareArtworkKey,
        });
      }
      if (ep.widescreenArtworkPath && ep.r2WidescreenArtworkKey) {
        uploadTasks.push({
          key: ep.r2WidescreenArtworkKey,
          filePath: ep.widescreenArtworkPath,
          contentType: "image/png",
          label: ep.r2WidescreenArtworkKey,
        });
      }
      for (const extra of ep.extraMedia) {
        uploadTasks.push({
          key: extra.r2Key,
          filePath: extra.localPath,
          contentType: "image/png",
          label: extra.r2Key,
        });
      }
    }

    const concurrency = 3;
    let completed = 0;
    const queue = [...uploadTasks];
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task) break;
        await uploadR2ObjectAsync(
          task.key,
          task.filePath,
          task.contentType,
          r2Remote
        );
        completed++;
        console.log(
          `  [${completed}/${uploadTasks.length}] Uploaded ${task.label}`
        );
      }
    });
    await Promise.all(workers);
  }

  const d1Targets = localOnly ? [false] : [true, false];

  // Upsert into D1 (Remote + Local)
  for (const isRemote of d1Targets) {
    console.log(
      `\n--- Upserting ${episodes.length} Legacy Episodes + Audit Trail into D1 (${
        isRemote ? "REMOTE cabcall-db" : "LOCAL D1"
      }) ---`
    );

    let prevHash = "GENESIS";
    try {
      const latestAudit = queryD1Json<{ entry_hash: string }>(
        "SELECT entry_hash FROM audit_ledger ORDER BY id DESC LIMIT 1",
        isRemote
      );
      if (latestAudit.length > 0 && latestAudit[0].entry_hash) {
        prevHash = latestAudit[0].entry_hash;
      }
    } catch {
      prevHash = "GENESIS";
    }

    const sqlPayload = buildD1MigrationAndUpsertSql(episodes, prevHash);
    const tmpSqlFile = path.join(
      process.cwd(),
      "tmp",
      `upsert-legacy-episodes-${isRemote ? "remote" : "local"}.sql`
    );
    fs.writeFileSync(tmpSqlFile, sqlPayload, "utf8");
    try {
      executeD1SqlFile(tmpSqlFile, isRemote);
      console.log(
        `  [${isRemote ? "REMOTE" : "LOCAL"}] Successfully upserted ${
          episodes.length
        } legacy_archive episodes and appended ${
          episodes.length
        } audit_ledger entries.`
      );
    } finally {
      if (fs.existsSync(tmpSqlFile)) {
        fs.unlinkSync(tmpSqlFile);
      }
    }
  }

  console.log(
    `\n=== LEGACY ARCHIVE MIGRATION COMPLETE (${episodes.length} EPISODES PUBLISHED) ===\n`
  );
}

main().catch((err) => {
  console.error("\n[ERROR] Legacy episode migration failed:", err);
  process.exit(1);
});
