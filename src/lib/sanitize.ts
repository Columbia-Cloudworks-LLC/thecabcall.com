import {
  getSreFailureModeSpec,
  getWorkingToolSpec,
  SreFailureModeId,
  WorkingToolId,
} from "./taxonomy";

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "amid",
  "among",
  "around",
  "because",
  "before",
  "being",
  "between",
  "both",
  "could",
  "during",
  "each",
  "from",
  "have",
  "having",
  "here",
  "into",
  "more",
  "most",
  "other",
  "over",
  "same",
  "some",
  "such",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "until",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
  "says",
  "said",
  "talk",
  "talks",
  "with",
]);

const PROTECTED_PROPER_PREFIXES = [
  "The Square",
  "The Plumb",
  "The Level",
  "The Trowel",
  "Common Gavel",
  "24-Inch Gauge",
  "The 24-Inch Gauge",
  "The Common Gavel",
  "SRE",
  "SLA",
  "SLO",
  "SLI",
  "SPOF",
  "API",
  "SCADA",
  "PLC",
  "OT",
  "IT",
  "BGP",
  "TLS",
  "ACH",
  "EHR",
  "EDI",
  "RBAC",
  "CI",
  "US",
  "U.S.",
  "UK",
  "EU",
  "FAA",
  "SEC",
  "FCC",
  "DOJ",
  "FTC",
  "NPR",
  "PBS",
  "NYT",
  "WSJ",
  "AP",
  "OpenAI",
  "Amazon",
  "Target",
  "Canada",
  "Canadian",
  "France",
  "French",
  "Russia",
  "Russian",
  "Ukraine",
  "European",
  "Europe",
  "Israel",
  "Netanyahu",
  "Zelenskyy",
  "Trump",
  "Graham",
  "Sanders",
  "Bernie",
  "Senator",
  "Sen.",
  "Rep.",
  "Pope",
  "Oregon",
  "Minnesota",
  "Pennsylvania",
  "Florida",
  "New Jersey",
  "New York",
  "Manhattan",
  "Washington",
  "Wall Street",
  "Congress",
  "White House",
  "Supreme Court",
];

const BANNED_PIPELINE_PATTERNS: RegExp[] = [
  /jev-1\.14\.0/i,
  /\btypesafe\s+jev\b/i,
  /\bsystem-1\s+jev\b/i,
  /\bsystemic\s+probability\s+by\s+jev\b/i,
  /\bevaluated\s+via\s+jev\b/i,
  /\bby\s+jev\b/i,
  /\bjev\s+assigned\b/i,
  /\bjev's\b/i,
  /\bingestion\s+gate\b/i,
  /\b\d+\.\d+\s+primary\s+(?:weight|probability)\b/i,
  /\bsecondary\s+weighting\s+on\b/i,
  /exposing an active operational friction point scored at/i,
  /reports on\s+["“'].+?["”'],\s*exposing an active/i,
  /entered the Change Advisory Board (?:review queue|ingestion pipeline)/i,
  /triaged by the Change Advisory Board System-1 gate/i,
  /Under System-1 Jev evaluation/i,
  /active incident with incomplete public telemetry/i,
  /Classified under .+ \(\d+%\) and /i,
  /\bApplying .+ alongside .+ anchors the review of\b/i,
  /\bUnder\s+(?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge)\s*\([^)]+\)\s+and\s+(?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge)/i,
  /\bunderwent an operational evaluation to determine how\b/i,
];

const GENERIC_SIGNAL_PATTERNS: RegExp[] = [
  /Examined through .+ and .+, the structural constraint lies in how the system absorbs load/i,
  /Specifically, the requirement for /i,
  /^Configuration Drift:\s+Actual production behavior has diverged silently/i,
  /^Cascading Failure:\s+A localized component failure or bottleneck triggered/i,
  /^Single Point of Failure \(SPOF\) \/ Untested Failover:\s+A backup plan, safeguard, or oversight mechanism failed/i,
  /^Alert Fatigue & Signal Loss:\s+Warning signs or audit flags were present/i,
  /^Blame Culture vs\. Root-Cause Isolation:\s+Actors are punishing a scapegoat/i,
  /^Technical & Institutional Debt(?:\s*\/\s*Capacity Exhaustion)?:\s+Demand or crisis load exceeded/i,
  /^Measured against (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), the core operational friction is that .+—demonstrating how live institutional execution drifted from its stated baseline without continuous verification\.$/i,
  /^Examined through (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), the underlying constraint is that .+, allowing localized friction across organizational boundaries to cascade into a broader operational bottleneck\.$/i,
  /^Tested by (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), the structural lesson is that .+, exposing an unvalidated safeguard that could not absorb real-world load once primary controls were bypassed\.$/i,
  /^Weighed on (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), the signal is that .+, illustrating how high-volume noise and competing priorities exhaust finite institutional bandwidth before core risks are addressed\.$/i,
  /^Applying (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), the structural reality is that .+, showing why isolating the upstream incentive structure matters more than punishing proximate actors\.$/i,
  /^Evaluated on (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), the structural constraint is that .+, reflecting how deferred capacity investments eventually force emergency interventions under peak load\.$/i,
];

const GENERIC_NOISE_PATTERNS: RegExp[] = [
  /^Reactive commentary framing ["“'].+?["”'] as an isolated personality clash or sudden catastrophe/i,
  /^Reactive headline (?:spin|framing) (?:surrounding|around) ["“'].+?["”'] that treats an/i,
  /^Commentary framing .+ as a sudden, unforeseeable policy shock rather than the predictable outcome of unmonitored divergence between formal rules and day-to-day execution\.$/i,
  /^Headline panic treating the disruption around .+ as an isolated black-swan collapse rather than tracing the tightly coupled dependencies that allowed the fault to propagate\.$/i,
  /^Reactive coverage fixating on the immediate incident trigger in .+ while overlooking why backup safeguards failed to contain the blast radius when called upon\.$/i,
  /^Performative outrage demanding (?:aún )?more surface-level reporting around .+ when prior warning indicators were already present and routinely bypassed\.$/i,
  /^Public spectacle centering on individual personalities in .+ while ignoring the institutional incentives and missing guardrails that shaped the outcome\.$/i,
  /^Treating the strain exposed in .+ as a short-term political or market fluctuation rather than the compounding cost of deferred structural maintenance\.$/i,
];

const GENERIC_QUESTION_PATTERNS: RegExp[] = [
  /^Applying .+ to ["“']/i,
  /^What concrete post-mortem telemetry must be disclosed before an impartial observer/i,
  /^In .+, what concrete mechanism allowed live operational practice to diverge from the stated legal or institutional charter without triggering an earlier corrective audit\?$/i,
  /^When commercial or political pressures mounted around .+, which specific verification standard or safeguard was compromised first\?$/i,
  /^Across the stakeholders affected by .+, are the decision-makers who architected the policy bearing the same operational cost as those absorbing the downstream impact\?$/i,
  /^Once the partisan rhetoric surrounding .+ is stripped away, what structural defect in the underlying workflow or oversight boundary actually enabled this event\?$/i,
  /^How much finite institutional bandwidth in .+ was consumed by reactive symptom management rather than retiring the underlying capacity constraint\?$/i,
  /^Which interface contract or coordination protocol between independent institutions fractured during .+, and what shared safeguard is required to restore trust\?$/i,
  /^When (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge) is applied alongside (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge), what concrete guardrail is required to prevent recurring /i,
];

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "twclid",
  "igshid",
  "yclid",
  "nysrc",
  "smid",
  "ref",
  "ref_src",
  "ref_url",
  "_hsenc",
  "_hsmi",
  "mkt_tok",
  "vero_id",
  "oly_enc_id",
  "oly_anon_id",
  "rb_clickid",
  "s_kwcid",
  "ncid",
  "sr_share",
  "ito",
  "at_medium",
  "at_campaign",
  "partner",
  "campaign_id",
  "ad_id",
]);

function isTrackingParamName(key: string): boolean {
  const lower = key.trim().toLowerCase();
  return (
    lower.startsWith("utm_") ||
    lower.startsWith("at_") ||
    lower.startsWith("mc_") ||
    lower.startsWith("oly_") ||
    TRACKING_QUERY_PARAMS.has(lower)
  );
}

/**
 * Normalizes a URL for deterministic canonical hashing and storage by:
 * - Stripping CDATA/whitespace and decoding `&amp;` in URL query strings
 * - Enforcing lowercase scheme and hostname
 * - Removing default ports (:80, :443) and hash fragments (#...)
 * - Stripping all tracking parameters (`utm_*`, `fbclid`, `gclid`, `nysrc`, `smid`, etc.)
 * - Sorting remaining query parameters alphabetically
 * - Stripping trailing slashes on non-root paths
 */
export function normalizeCanonicalUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";

  const cleaned = rawUrl
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/gi, "&")
    .trim();
  if (!cleaned) return "";

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }
    parsed.hash = "";

    const retainedParams: Array<[string, string]> = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!isTrackingParamName(key)) {
        retainedParams.push([key, value]);
      }
    }
    retainedParams.sort(([aKey, aVal], [bKey, bVal]) =>
      aKey === bKey ? aVal.localeCompare(bVal) : aKey.localeCompare(bKey)
    );

    const nextSearch = new URLSearchParams();
    for (const [k, v] of retainedParams) {
      nextSearch.append(k, v);
    }
    const searchStr = nextSearch.toString();
    parsed.search = searchStr ? `?${searchStr}` : "";

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Strips all unsafe HTML, script/style/iframe/object/svg/form elements, CDATA wrappers,
 * HTML comments, and double-encoded HTML tags during initial normalization.
 */
export function stripUnsafeHtmlAndCdata(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw;
  // Iteratively unwrap CDATA sections (handles nested or split CDATA markers)
  for (let i = 0; i < 3; i += 1) {
    if (!/<!\[CDATA\[/i.test(text)) break;
    text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  }
  text = text.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/g, "");

  const removeUnsafeBlocks = (input: string): string =>
    input
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(
        /<(script|style|iframe|object|embed|svg|form|applet|noscript|template)[\s\S]*?<\/\1>/gi,
        " "
      )
      .replace(
        /<(script|style|iframe|object|embed|svg|form|applet|meta|link|base|input|button)[^>]*\/?>/gi,
        " "
      )
      .replace(/<\/(p|div|li|h[1-6]|br|tr|blockquote|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\b(?:javascript|vbscript|data):[^\s"'>]+/gi, " ");

  text = removeUnsafeBlocks(text);

  // Decode standard & numeric HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, "—")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : " ";
    });

  // Second pass to strip any HTML tags that were entity-encoded inside XML/CDATA
  text = removeUnsafeBlocks(text);

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Strips HTML tags, CDATA, entities, image credit tags, "Read full article / Comments" footers,
 * and broadcast sign-off lines from raw RSS descriptions.
 */
export function cleanRssText(raw: string | null | undefined): string {
  const stripped = stripUnsafeHtmlAndCdata(raw);
  if (!stripped) return "";

  return stripped
    .replace(/\(Image credit:[^)]*\)/gi, " ")
    .replace(/\bCredit:\s*via\s+[^\n.]+/gi, " ")
    .replace(/\bRead full article\b[\s\S]*$/i, " ")
    .replace(/\bComments\s*$/i, " ")
    .replace(/\bLeave your feedback\b/gi, " ")
    .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+ reports\.?\s*$/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const ABBREVIATION_PLACEHOLDER = "\u0000";

/**
 * Splits cleaned prose into genuine factual sentences while protecting common abbreviations
 * (e.g. U.S., Rep., Sen., Ms., Mr., Dr., St., Oct.) and filtering out standalone subheaders.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => {
      if (!p) return false;
      // Exclude short subheadings that lack terminal sentence punctuation
      if (p.length < 75 && !/[.!?]["”']?$/.test(p)) {
        return false;
      }
      return true;
    });

  const joined = paragraphs.join(" ");
  if (!joined) return [];

  const protectedText = joined
    .replace(/\b(U\.S|U\.K|E\.U|U\.N)\./g, `$1${ABBREVIATION_PLACEHOLDER}`)
    .replace(
      /\b(Rep|Sen|Gov|Pres|Mr|Mrs|Ms|Dr|Prof|Gen|Col|Lt|Sgt|St|Ave|Inc|Corp|Co|Ltd|Jr|Sr|vs|v|No|Fig|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./gi,
      `$1${ABBREVIATION_PLACEHOLDER}`
    )
    .replace(/(\b[A-Z])\./g, `$1${ABBREVIATION_PLACEHOLDER}`);

  const rawSentences = protectedText
    .split(/(?<=[.!?]["”']?)\s+(?=[A-Z"“'‘(0-9])/)
    .map((s) =>
      s
        .replace(new RegExp(ABBREVIATION_PLACEHOLDER, "g"), ".")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((s) => s.length >= 20 && /[.!?]["”']?$/.test(s));

  return rawSentences;
}

function tokenizeContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Returns true if the description is identical to the title, is a broadcast host teaser
 * restating the headline, or contains almost exclusively words repeated from the headline.
 */
export function isHeadlineEcho(title: string, description: string): boolean {
  const normTitle = normalizeForComparison(title);
  const normDesc = normalizeForComparison(description);

  if (!normDesc || normDesc === normTitle) {
    return true;
  }

  if (normTitle.includes(normDesc)) {
    return true;
  }

  // Radio/podcast segment intro pattern that simply echoes the headline
  if (
    /^(?:npr's|pbs's|host|anchor|correspondent)\s+[a-z\s.]+\s+(?:talks|speaks|chats|discusses)\s+with\s+/i.test(
      description.trim()
    )
  ) {
    return true;
  }

  const titleWords = new Set(tokenizeContentWords(title));
  const descWords = tokenizeContentWords(description);
  if (descWords.length === 0) {
    return true;
  }

  const novelWords = descWords.filter((w) => !titleWords.has(w));
  const overlapRatio = (descWords.length - novelWords.length) / descWords.length;

  // If fewer than 4 novel content words exist, or >= 75% of words merely repeat the headline in a short blurb
  if (novelWords.length < 4 || (overlapRatio >= 0.75 && description.length < 180)) {
    return true;
  }

  return false;
}

/**
 * Checks whether a string contains banned internal library/pipeline nomenclature or Mad-Libs templates.
 */
export function hasBannedPipelineJargon(text: string | null | undefined): boolean {
  if (!text) return false;
  return BANNED_PIPELINE_PATTERNS.some((pattern) => pattern.test(text));
}

function startsWithProtectedProperTerm(text: string): boolean {
  const trimmed = text.trim();
  if (
    PROTECTED_PROPER_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  ) {
    return true;
  }
  const firstWord = trimmed.split(/[\s,.;:!?]+/)[0] || "";
  // Protect acronyms or mixed-case brand names (e.g. OpenAI, BioWare, iPhone, U.S.)
  if (firstWord.length >= 2 && /[A-Z]/.test(firstWord.slice(1))) {
    return true;
  }
  return false;
}

/**
 * Normalizes capitalization and punctuation boundaries when rubric definitions or clauses
 * are combined dynamically, preventing mid-sentence capital letters (e.g. "Concurrently, Slow, unmonitored...")
 * and stripping leaked pipeline jargon.
 */
export function sanitizeStringConcatenation(text: string): string {
  if (!text) return "";

  let out = text
    // Strip any leaked inline Jev annotations
    .replace(/\s*Evaluated via Jev\s*\([^)]*\)[^.]*\./gi, "")
    .replace(/\s*Classified under\s+[^.]+\(\d+%\)[^.]*\./gi, "")
    .replace(/\bSystem-1 TypeSafe Jev\s*\(jev-1\.14\.0\)/gi, "The diagnostic rubric")
    .replace(/\bTypeSafe Jev\s*\(jev-1\.14\.0\)/gi, "the diagnostic rubric")
    .replace(/\s*\(jev-1\.14\.0\)/gi, "")
    .replace(/\bsystemic probability by Jev\b/gi, "structural alignment")
    .replace(/\bat the ingestion gate\b/gi, "")
    .replace(/\bingestion gate\b/gi, "triage review")
    .replace(/\b\d+\.\d+\s+primary\s+(?:weight|probability)\b/gi, "primary alignment")
    // Fix ". compounded by" punctuation boundary bug
    .replace(/\.\s+compounded by\b/gi, ", compounded by")
    .replace(/\.\s+while\b/g, ", while");

  // Fix mid-sentence capital letters after transitional adverbs followed by a comma
  out = out.replace(
    /\b(Concurrently|Meanwhile|Specifically|Similarly|Furthermore|Moreover|However|Consequently|Accordingly),\s+([A-Z][a-zA-Z0-9-]*)/g,
    (fullMatch, adverb: string, nextWord: string, offset: number, fullStr: string) => {
      const remainingSlice = fullStr.slice(offset + adverb.length + 2);
      if (startsWithProtectedProperTerm(remainingSlice)) {
        return fullMatch;
      }
      const lowered = nextWord.charAt(0).toLowerCase() + nextWord.slice(1);
      return `${adverb}, ${lowered}`;
    }
  );

  // Collapse duplicate punctuation and extra whitespace
  out = out
    .replace(/\.\.+/g, ".")
    .replace(/\s+,/g, ",")
    .replace(/[ \t]+/g, " ")
    .trim();

  return out;
}

/**
 * Joins a transitional prefix (e.g. "Concurrently,") with a definition or clause,
 * normalizing the leading character's case and terminal punctuation.
 */
export function joinClauseWithTransition(
  transitionPrefix: string,
  clause: string
): string {
  const cleanPrefix = transitionPrefix.trim().replace(/[,:;]+$/, "");
  const cleanClause = clause.trim();
  if (!cleanClause) return "";

  const formattedClause = startsWithProtectedProperTerm(cleanClause)
    ? cleanClause
    : cleanClause.charAt(0).toLowerCase() + cleanClause.slice(1);

  const withPeriod = /[.!?]$/.test(formattedClause)
    ? formattedClause
    : `${formattedClause}.`;

  return sanitizeStringConcatenation(`${cleanPrefix}, ${withPeriod}`);
}

/**
 * Normalizes Socratic question text into standard sentence case while preserving
 * proper nouns and Working Tool names.
 */
export function normalizeQuestionSentenceCase(question: string): string {
  if (!question) return "";
  let q = sanitizeStringConcatenation(question.trim());

  // Strip verbose headline-repeating prefixes like `Applying The Square to "Long Headline", where...`
  q = q.replace(
    /^Applying\s+(The Square|The Plumb|The Level|The Trowel|The Common Gavel|Common Gavel|The 24-Inch Gauge|24-Inch Gauge)\s+to\s+["“'][^"”']+["”'],\s+([a-z])/i,
    (_, _tool: string, firstChar: string) => firstChar.toUpperCase()
  );

  // If the entire question was stored in ALL-CAPS, convert to sentence case
  const lettersOnly = q.replace(/[^a-zA-Z]/g, "");
  const upperCount = q.replace(/[^A-Z]/g, "").length;
  if (lettersOnly.length > 10 && upperCount / lettersOnly.length > 0.8) {
    q = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
    for (const proper of PROTECTED_PROPER_PREFIXES) {
      const regex = new RegExp(`\\b${proper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
      q = q.replace(regex, proper);
    }
  } else if (q.length > 0) {
    q = q.charAt(0).toUpperCase() + q.slice(1);
  }

  return q;
}

export interface SummaryValidationResult {
  valid: boolean;
  cleanedDescription: string;
  executiveSummary: string;
  factualBriefParagraph: string;
  reason?: string;
}

/**
 * Defensive validation gate for RSS items and incident records:
 * - Rejects null/empty descriptions, descriptions < 80 chars, descriptions identical to the title,
 *   or descriptions that only echo the headline.
 * - Requires a genuine 2-to-3 sentence plain-English factual summary derived from the source RSS item.
 * - Logs a warning during ingestion/build/normalization when an item is quarantined.
 */
export function validateAndNormalizeIncidentSummary(input: {
  id?: string | number;
  title: string;
  sourceFeed: string;
  rawExcerpt?: string | null;
  executiveSummary?: string | null;
  socraticBrief?: string | null;
  logWarnings?: boolean;
}): SummaryValidationResult {
  const shouldLog = input.logWarnings !== false;
  const title = (input.title || "").trim();
  const rawDesc =
    input.rawExcerpt !== undefined && input.rawExcerpt !== null
      ? input.rawExcerpt
      : input.executiveSummary || "";

  if (!rawDesc || typeof rawDesc !== "string" || !rawDesc.trim()) {
    const reason = `Null or empty description for "${title}" (${input.sourceFeed})`;
    if (shouldLog) {
      console.warn(`[Trestleboard Quarantine] ${reason}`);
    }
    return {
      valid: false,
      cleanedDescription: "",
      executiveSummary: "",
      factualBriefParagraph: "",
      reason,
    };
  }

  const cleanedDescription = cleanRssText(rawDesc);

  if (cleanedDescription.length < 80) {
    const reason = `Description shorter than 80 characters (${cleanedDescription.length} chars) for "${title}" (${input.sourceFeed})`;
    if (shouldLog) {
      console.warn(`[Trestleboard Quarantine] ${reason}`);
    }
    return {
      valid: false,
      cleanedDescription,
      executiveSummary: "",
      factualBriefParagraph: "",
      reason,
    };
  }

  if (normalizeForComparison(cleanedDescription) === normalizeForComparison(title)) {
    const reason = `Description is identical to title for "${title}" (${input.sourceFeed})`;
    if (shouldLog) {
      console.warn(`[Trestleboard Quarantine] ${reason}`);
    }
    return {
      valid: false,
      cleanedDescription,
      executiveSummary: "",
      factualBriefParagraph: "",
      reason,
    };
  }

  if (isHeadlineEcho(title, cleanedDescription)) {
    const reason = `Description only contains echoes of the headline for "${title}" (${input.sourceFeed})`;
    if (shouldLog) {
      console.warn(`[Trestleboard Quarantine] ${reason}`);
    }
    return {
      valid: false,
      cleanedDescription,
      executiveSummary: "",
      factualBriefParagraph: "",
      reason,
    };
  }

  // Candidate 1: Check if an existing executiveSummary is clean, non-Mad-Libs, and 2-3 factual sentences
  if (
    input.executiveSummary &&
    !hasBannedPipelineJargon(input.executiveSummary)
  ) {
    const cleanedExec = cleanRssText(input.executiveSummary);
    const execSentences = splitIntoSentences(cleanedExec);
    if (
      cleanedExec.length >= 80 &&
      execSentences.length >= 2 &&
      !isHeadlineEcho(title, cleanedExec)
    ) {
      const twoSent = sanitizeStringConcatenation(
        execSentences.slice(0, 2).join(" ")
      );
      // Also check if socraticBrief has a clean 2-3 sentence first paragraph
      let factualPara = sanitizeStringConcatenation(
        execSentences.slice(0, 3).join(" ")
      );
      if (input.socraticBrief) {
        const firstPara = extractCleanFirstParagraphFromBrief(
          title,
          input.socraticBrief
        );
        if (firstPara) {
          factualPara = firstPara;
        }
      }
      return {
        valid: true,
        cleanedDescription,
        executiveSummary: twoSent,
        factualBriefParagraph: factualPara,
      };
    }
  }

  // Candidate 2: Check if socraticBrief has a clean 2-3 sentence first paragraph
  if (input.socraticBrief) {
    const firstPara = extractCleanFirstParagraphFromBrief(
      title,
      input.socraticBrief
    );
    if (firstPara) {
      const sents = splitIntoSentences(firstPara);
      if (sents.length >= 2 && firstPara.length >= 80 && !isHeadlineEcho(title, firstPara)) {
        return {
          valid: true,
          cleanedDescription,
          executiveSummary: sanitizeStringConcatenation(sents.slice(0, 2).join(" ")),
          factualBriefParagraph: sanitizeStringConcatenation(sents.slice(0, 3).join(" ")),
        };
      }
    }
  }

  // Candidate 3: Extract 2-to-3 factual sentences directly from cleanedDescription
  const excerptSentences = splitIntoSentences(cleanedDescription);
  if (excerptSentences.length >= 2) {
    const twoSentenceSummary = sanitizeStringConcatenation(
      excerptSentences.slice(0, 2).join(" ")
    );
    const factualBriefParagraph = sanitizeStringConcatenation(
      excerptSentences.slice(0, 3).join(" ")
    );
    if (
      twoSentenceSummary.length >= 80 &&
      !isHeadlineEcho(title, twoSentenceSummary)
    ) {
      return {
        valid: true,
        cleanedDescription,
        executiveSummary: twoSentenceSummary,
        factualBriefParagraph,
      };
    }
  }

  const reason = `Item lacks a valid 2-to-3 sentence plain-English factual summary (found ${excerptSentences.length} sentence(s)) for "${title}" (${input.sourceFeed})`;
  if (shouldLog) {
    console.warn(`[Trestleboard Quarantine] ${reason}`);
  }
  return {
    valid: false,
    cleanedDescription,
    executiveSummary: "",
    factualBriefParagraph: "",
    reason,
  };
}

function extractCleanFirstParagraphFromBrief(
  title: string,
  socraticBrief: string
): string | null {
  if (!socraticBrief) return null;
  const paragraphs = socraticBrief
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  // Strip legacy "Telemetry ingested from ... entered the Change Advisory Board review queue as an active systems incident." prefix
  const cleanedFirst = cleanRssText(paragraphs[0])
    .replace(
      /^(?:Primary\s+)?(?:Source\s+)?telemetry\s+(?:ingested\s+|dispatch\s+)?from\s+[^.]+?\s+entered the Change Advisory Board[^.]*\.\s*/i,
      ""
    )
    .replace(
      /^Primary source dispatch from\s+[^.]+?\s+triaged by the Change Advisory Board[^.]*\.\s*/i,
      ""
    )
    .trim();

  if (!cleanedFirst || hasBannedPipelineJargon(cleanedFirst)) {
    return null;
  }

  const sents = splitIntoSentences(cleanedFirst);
  if (sents.length < 2 || cleanedFirst.length < 80 || isHeadlineEcho(title, cleanedFirst)) {
    return null;
  }

  return sanitizeStringConcatenation(sents.slice(0, 3).join(" "));
}

/**
 * Returns true if the text matches any banned pipeline jargon or robotic Mad-Libs fallback template.
 */
export function isTemplatedOrMalformedCopy(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (hasBannedPipelineJargon(trimmed)) return true;
  if (GENERIC_NOISE_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (GENERIC_SIGNAL_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (GENERIC_QUESTION_PATTERNS.some((p) => p.test(trimmed))) return true;
  return false;
}

export type DiagnosticsValidationResult =
  | {
      valid: true;
      noiseOverblown: string;
      structuralSignal: string;
      questions: [string, string];
      reason?: undefined;
    }
  | {
      valid: false;
      noiseOverblown: string;
      structuralSignal: string;
      questions: string[];
      reason: string;
    };

/**
 * Validates and sanitizes the editorial diagnostics (the_noise, the_signal, the_questions)
 * for an article WITHOUT falling back to Mad-Libs or robotic string-interpolation templates.
 * If any section is missing, truncated, or matches a fallback template, returns `valid: false`
 * so the caller transitions the article to `QUARANTINED` or suppresses it from public projection.
 */
export function buildOrSanitizeArticleDiagnostics(input: {
  title: string;
  sourceFeed: string;
  factualSummary: string;
  primaryTool: WorkingToolId;
  secondaryTool: WorkingToolId;
  sreFailureMode: SreFailureModeId;
  existingNoise?: string | null;
  existingSignal?: string | null;
  existingQuestions?: string[] | null;
}): DiagnosticsValidationResult {
  const primarySpec = getWorkingToolSpec(input.primaryTool);
  const failureSpec = getSreFailureModeSpec(input.sreFailureMode);

  const rawNoise = cleanRssText(input.existingNoise || "");
  const rawSignal = cleanRssText(input.existingSignal || "");

  const hasValidExistingNoise =
    rawNoise.length >= 30 &&
    !hasBannedPipelineJargon(rawNoise) &&
    !GENERIC_NOISE_PATTERNS.some((p) => p.test(rawNoise));

  if (!hasValidExistingNoise) {
    return {
      valid: false,
      noiseOverblown: "",
      structuralSignal: "",
      questions: [],
      reason: `Missing or templated 'the_noise' copy for "${input.title}"`,
    };
  }

  const hasValidExistingSignal =
    rawSignal.length >= 30 &&
    !hasBannedPipelineJargon(rawSignal) &&
    !GENERIC_SIGNAL_PATTERNS.some((p) => p.test(rawSignal)) &&
    rawSignal !== failureSpec.systemsDefinition &&
    rawSignal !== failureSpec.summary;

  if (!hasValidExistingSignal) {
    return {
      valid: false,
      noiseOverblown: "",
      structuralSignal: "",
      questions: [],
      reason: `Missing or templated 'the_signal' copy for "${input.title}"`,
    };
  }

  const validExistingQuestions = (input.existingQuestions || [])
    .map((q) => cleanRssText(String(q || "")))
    .filter(
      (q) =>
        q.length >= 25 &&
        q.endsWith("?") &&
        !hasBannedPipelineJargon(q) &&
        !GENERIC_QUESTION_PATTERNS.some((p) => p.test(q)) &&
        q !== primarySpec.diagnosticQuestionPattern
    )
    .map(normalizeQuestionSentenceCase);

  if (validExistingQuestions.length < 2) {
    return {
      valid: false,
      noiseOverblown: "",
      structuralSignal: "",
      questions: [],
      reason: `Fewer than 2 valid non-templated Socratic questions for "${input.title}"`,
    };
  }

  return {
    valid: true,
    noiseOverblown: sanitizeStringConcatenation(rawNoise),
    structuralSignal: sanitizeStringConcatenation(rawSignal),
    questions: [validExistingQuestions[0], validExistingQuestions[1]],
  };
}

