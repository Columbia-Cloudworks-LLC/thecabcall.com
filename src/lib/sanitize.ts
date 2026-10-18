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
  /^Viewed through .+ and .+, the underlying issue is /i,
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
  /demonstrating how live institutional execution drifted from its stated baseline without continuous verification/i,
  /showing why isolating the upstream incentive structure matters more than punishing proximate actors/i,
  /reflecting how deferred capacity investments eventually force emergency interventions under peak load/i,
];

const GENERIC_NOISE_PATTERNS: RegExp[] = [
  /^Reactive commentary framing ["“'].+?["”'] as an isolated personality clash or sudden catastrophe/i,
  /^Reactive headline (?:spin|framing) (?:surrounding|around) ["“'].+?["”'] that treats an/i,
  /^Coverage surrounding .+ centers on immediate reaction rather than structural constraints/i,
  /^Commentary framing .+ as a sudden, unforeseeable policy shock rather than the predictable outcome of unmonitored divergence between formal rules and day-to-day execution\.$/i,
  /^Headline panic treating the disruption around .+ as an isolated black-swan collapse rather than tracing the tightly coupled dependencies that allowed the fault to propagate\.$/i,
  /^Reactive coverage fixating on the immediate incident trigger in .+ while overlooking why backup safeguards failed to contain the blast radius when called upon\.$/i,
  /^Performative outrage demanding (?:aún )?more surface-level reporting around .+ when prior warning indicators were already present and routinely bypassed\.$/i,
  /^Public spectacle centering on individual personalities in .+ while ignoring the institutional incentives and missing guardrails that shaped the outcome\.$/i,
  /^Treating the strain exposed in .+ as a short-term political or market fluctuation rather than the compounding cost of deferred structural maintenance\.$/i,
  /predictable outcome of unmonitored divergence between formal rules and day-to-day execution/i,
  /as a short-term political or market fluctuation rather than the compounding cost of deferred structural maintenance/i,
];

const GENERIC_QUESTION_PATTERNS: RegExp[] = [
  /^Applying .+ to ["“']/i,
  /^Prompted by (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge):/i,
  /^How does (?:The Square|The Plumb|The Level|The Trowel|Common Gavel|24-Inch Gauge) apply to this incident\?$/i,
  /^What concrete post-mortem telemetry must be disclosed before an impartial observer/i,
  /^In .+, what concrete mechanism allowed live operational practice to diverge from the stated legal or institutional charter without triggering an earlier corrective audit\?$/i,
  /live operational practice to diverge from the stated legal or institutional charter/i,
  /without triggering an earlier corrective audit/i,
  /^When commercial or political pressures mounted around .+, which specific verification standard or safeguard was compromised first\?$/i,
  /^Across the stakeholders affected by .+, are the decision-makers who architected the policy bearing the same operational cost as those absorbing the downstream impact\?$/i,
  /decision-makers who architected the policy bearing the same operational cost as those absorbing the downstream impact/i,
  /^Once the partisan rhetoric surrounding .+ is stripped away, what structural defect in the underlying workflow or oversight boundary actually enabled this event\?$/i,
  /^How much finite institutional bandwidth in .+ was consumed by reactive symptom management rather than retiring the underlying capacity constraint\?$/i,
  /consumed by reactive symptom management rather than retiring the underlying capacity constraint/i,
  /^Which interface contract or coordination protocol between independent institutions fractured during .+, and what shared safeguard is required to restore trust\?$/i,
  /interface contract or coordination protocol between independent institutions fractured/i,
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
    // Strip trailing ".Check" artifact from model synthesis outputs
    .replace(/\.Check\b/g, ".")
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

function tokenizeNormalizedWords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Detects whether a `Noise`, `Signal`, or `Question` string interpolates the article's
 * `<H1>` headline or a contiguous >= 4-word (including >= 5-word) prefix/substring of the headline.
 */
export function containsInterpolatedHeadline(
  text: string | null | undefined,
  title: string | null | undefined
): boolean {
  if (!text || typeof text !== "string" || !title || typeof title !== "string") {
    return false;
  }

  const textWords = tokenizeNormalizedWords(text);
  const titleWords = tokenizeNormalizedWords(title);
  if (textWords.length === 0 || titleWords.length === 0) {
    return false;
  }

  const normText = ` ${textWords.join(" ")} `;
  const normTitle = titleWords.join(" ");

  if (normTitle.length >= 10 && normText.includes(` ${normTitle} `)) {
    return true;
  }

  // Check legacy extractSubjectClause (first 10 words or <= 72 chars of headline)
  const subjectWords = titleWords.slice(0, Math.min(10, titleWords.length));
  if (subjectWords.length >= 3) {
    const subjectPhrase = subjectWords.join(" ");
    if (subjectPhrase.length >= 14 && normText.includes(` ${subjectPhrase} `)) {
      return true;
    }
  }

  // Check any contiguous >= 4-word (and >= 5-word) substring of the headline
  const minWindow = Math.min(4, titleWords.length);
  if (minWindow >= 3) {
    for (let i = 0; i <= titleWords.length - minWindow; i += 1) {
      const slice = titleWords.slice(i, i + minWindow);
      const phrase = slice.join(" ");
      const contentWords = slice.filter(
        (w) => w.length >= 4 && !STOPWORDS.has(w)
      );
      if (
        phrase.length >= 14 &&
        (minWindow >= 4 ? contentWords.length >= 1 : contentWords.length >= 2)
      ) {
        if (normText.includes(` ${phrase} `)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Normalizes Socratic question text into standard sentence case while preserving
 * proper nouns and Working Tool names, and stripping verbose headline-interpolating prefixes.
 */
export function normalizeQuestionSentenceCase(
  question: string,
  title?: string
): string {
  if (!question) return "";
  let q = sanitizeStringConcatenation(question.trim());

  // Strip verbose headline-repeating prefixes like `Applying The Square to "Long Headline", where...`
  q = q.replace(
    /^Applying\s+(The Square|The Plumb|The Level|The Trowel|The Common Gavel|Common Gavel|The 24-Inch Gauge|24-Inch Gauge)\s+to\s+["“'][^"”']+["”'],\s+([a-z])/i,
    (_, _tool: string, firstChar: string) => firstChar.toUpperCase()
  );

  // Strip quoted-headline opener `In "Headline...", what...` -> `In this case, what...`
  q = q.replace(
    /^(?:In|Around|During|Across the stakeholders affected by)\s+["“'][^"”']{10,}["”'],\s+/i,
    "In this case, "
  );

  // If title is supplied and the question begins with `In <title prefix>, `, rewrite opener to `In this case, `
  if (title && containsInterpolatedHeadline(q, title)) {
    q = q.replace(
      /^(?:In|When commercial or political pressures mounted around|Across the stakeholders affected by|Once the partisan rhetoric surrounding)\s+[^,?]{15,},\s+/i,
      "In this case, "
    );
  }

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
 * Returns true if the text matches any banned pipeline jargon, corporate compliance legalese,
 * robotic Mad-Libs fallback template, or (when `title` is provided) an interpolated headline.
 */
export function isTemplatedOrMalformedCopy(
  text: string | null | undefined,
  title?: string | null
): boolean {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (hasBannedPipelineJargon(trimmed)) return true;
  if (GENERIC_NOISE_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (GENERIC_SIGNAL_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (GENERIC_QUESTION_PATTERNS.some((p) => p.test(trimmed))) return true;
  if (title && containsInterpolatedHeadline(trimmed, title)) return true;
  return false;
}

/**
 * Plain workshop English diagnostic for Section II ("Partisan Heat & Spin / The Noise").
 * Refers naturally to "this case", "this decision", "this action", or "this breakdown"
 * without ever interpolating the article headline or corporate compliance legalese.
 */
export function buildWorkshopNoiseDiagnostic(
  failureMode: SreFailureModeId,
  primaryTool: WorkingToolId
): string {
  switch (failureMode) {
    case "Configuration Drift":
      return sanitizeStringConcatenation(
        `Treating this decision as a sudden, out-of-nowhere shock rather than the natural result of daily habits quietly wandering away from the written rules under ${primaryTool}.`
      );
    case "Cascading Failure":
      return sanitizeStringConcatenation(
        `Framing this breakdown as an unavoidable freak accident instead of asking why a single missed handoff overloaded neighboring crews without a firebreak.`
      );
    case "Single Point of Failure (SPOF) / Untested Failover":
      return sanitizeStringConcatenation(
        `Fixating on the immediate spark that triggered this breakdown while ignoring why the backup plan failed the moment real weight was placed on it.`
      );
    case "Alert Fatigue & Signal Loss":
      return sanitizeStringConcatenation(
        `Demanding even more noisy warning bells and surface-level outrage around this case when earlier warning signs were already on the board and went unanswered.`
      );
    case "Blame Culture vs. Root-Cause Isolation":
      return sanitizeStringConcatenation(
        `Turning this case into a public hunt for a single scapegoat while leaving the flawed shop setup and skewed incentives untouched.`
      );
    case "Technical & Institutional Debt":
      return sanitizeStringConcatenation(
        `Brushing off the strain in this case as a passing rough patch rather than the overdue bill for years of skipped upkeep and short-term patches.`
      );
    case "Structural Friction":
    default:
      return sanitizeStringConcatenation(
        `Focusing on partisan heat and personality clashes around this action instead of inspecting where daily work on the ground pulled away from the blueprint.`
      );
  }
}

/**
 * Plain workshop English diagnostic for Section II ("The Actual Foundation / The Signal").
 * Refers naturally to "this case", "this decision", "this action", or "this breakdown"
 * without interpolating the headline or duplicating Section I sentences.
 */
export function buildWorkshopSignalDiagnostic(
  failureMode: SreFailureModeId,
  primaryTool: WorkingToolId,
  secondaryTool: WorkingToolId
): string {
  switch (failureMode) {
    case "Configuration Drift":
      return sanitizeStringConcatenation(
        `Checked with ${primaryTool}, this case shows how small, unrecorded shortcuts pile up over time until the actual work on the shop floor no longer matches the public promise.`
      );
    case "Cascading Failure":
      return sanitizeStringConcatenation(
        `Examined with ${primaryTool} and ${secondaryTool}, this breakdown shows what happens when separate teams work without clear handoffs or shutoff valves to keep a local slip from spreading.`
      );
    case "Single Point of Failure (SPOF) / Untested Failover":
      return sanitizeStringConcatenation(
        `Tested by ${primaryTool}, this case shows the danger of resting an essential operation on a single weak link while trusting a backup plan that was only ever proven on paper.`
      );
    case "Alert Fatigue & Signal Loss":
      return sanitizeStringConcatenation(
        `Measured with ${primaryTool}, this action shows how spending finite crew hours on constant false alarms and daily firefighting leaves no reserve strength for the real hazard.`
      );
    case "Blame Culture vs. Root-Cause Isolation":
      return sanitizeStringConcatenation(
        `Using ${primaryTool} alongside ${secondaryTool}, this case shows why an honest review must chip away defensive excuses and fix the broken guardrails rather than just punishing the last person on shift.`
      );
    case "Technical & Institutional Debt":
      return sanitizeStringConcatenation(
        `Laid on ${primaryTool}, this decision shows how putting off routine maintenance to win short-term relief leaves frontline workers and the public carrying a much heavier repair bill later.`
      );
    case "Structural Friction":
    default:
      return sanitizeStringConcatenation(
        `Measured against ${primaryTool} and ${secondaryTool}, this case highlights the strain that builds up when field decisions are made without clear guardrails or shared accountability.`
      );
  }
}

/**
 * Plain workshop English Socratic inquiry questions for Section III ("Questions for Fair & Consistent Judgment").
 * Refers naturally to "this case", "this decision", "this action", or "this breakdown"
 * with zero headline interpolation and zero corporate compliance legalese.
 */
export function buildWorkshopSocraticQuestions(
  primaryTool: WorkingToolId,
  secondaryTool: WorkingToolId,
  failureMode: SreFailureModeId
): [string, string] {
  const q1ByTool: Record<WorkingToolId, string> = {
    "The Square":
      "In this case, where did day-to-day actions on the ground quietly drift away from the written rules and public promises before anyone called a halt?",
    "The Plumb":
      "When pressure mounted around this decision, which safety standard or honest check was bent first to make the numbers look good?",
    "The Level":
      "Are the leaders who approved this decision standing on the same floor and carrying the same risk as the people living with the consequences?",
    "Common Gavel":
      "Once the partisan spin and finger-pointing around this case are chipped away, what flaw in the actual setup allowed this breakdown to happen?",
    "24-Inch Gauge":
      "How much time and attention in this action went toward putting out daily brushfires instead of fixing the known hazard at the root?",
    "The Trowel":
      "Where did communication break down between the separate crews involved in this case, and what plain agreement is needed to rebuild trust?",
  };

  const q2ByFailureMode: Record<SreFailureModeId, string> = {
    "Configuration Drift": `When applying ${secondaryTool} alongside ${primaryTool}, what regular on-site check would catch this kind of drift before a small gap turns into a major failure?`,
    "Cascading Failure": `Using ${secondaryTool} with ${primaryTool}, what practical firebreak between teams would keep a local breakdown in this action from spreading down the line?`,
    "Single Point of Failure (SPOF) / Untested Failover": `Weighing ${secondaryTool} with ${primaryTool}, how can the backup plan in this case be tested under real working weight instead of just being signed off on paper?`,
    "Alert Fatigue & Signal Loss": `With ${secondaryTool} and ${primaryTool} in hand, which noisy distractions should be cleared away so the crew can act on real warnings in time?`,
    "Blame Culture vs. Root-Cause Isolation": `Applying ${secondaryTool} alongside ${primaryTool}, what change to the rules or tools on the shop floor would keep the next worker from walking into the same trap?`,
    "Technical & Institutional Debt": `Measured by ${secondaryTool} and ${primaryTool}, what overdue repair work in this decision must be paid down now instead of being passed to the next shift?`,
    "Structural Friction": `When ${secondaryTool} is paired with ${primaryTool}, what clear, practical guardrail would keep day-to-day work aligned with the blueprint in this case?`,
  };

  return [
    normalizeQuestionSentenceCase(q1ByTool[primaryTool] || q1ByTool["The Square"]),
    normalizeQuestionSentenceCase(
      q2ByFailureMode[failureMode] || q2ByFailureMode["Configuration Drift"]
    ),
  ];
}

export type DiagnosticsValidationResult =
  | {
      valid: true;
      noiseOverblown: string;
      structuralSignal: string;
      questions: [string, string];
      repaired?: boolean;
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
 * Validates and sanitizes the editorial diagnostics (`noiseOverblown`, `structuralSignal`, `questions`)
 * for an article. When a stored D1 record has legacy headline-interpolated or compliance-jargon
 * `Noise`, `Signal`, or `Questions` (such as rows generated by `editorial-sanitization-v2`),
 * cleanly repairs/replaces those fields with plain-spoken, non-headline-interpolated craft diagnostics
 * referring naturally to "this case", "this decision", "this action", or "this breakdown".
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
  const cleanedSummary = cleanRssText(input.factualSummary || "");
  if (cleanedSummary.length < 40) {
    return {
      valid: false,
      noiseOverblown: "",
      structuralSignal: "",
      questions: [],
      reason: `Missing valid factual summary for "${input.title}"`,
    };
  }

  const primarySpec = getWorkingToolSpec(input.primaryTool);
  const failureSpec = getSreFailureModeSpec(input.sreFailureMode);

  const rawNoise = cleanRssText(input.existingNoise || "");
  const rawSignal = cleanRssText(input.existingSignal || "");

  const hasValidExistingNoise =
    rawNoise.length >= 30 &&
    !isTemplatedOrMalformedCopy(rawNoise, input.title) &&
    !containsInterpolatedHeadline(rawNoise, input.title);

  const hasValidExistingSignal =
    rawSignal.length >= 30 &&
    !isTemplatedOrMalformedCopy(rawSignal, input.title) &&
    !containsInterpolatedHeadline(rawSignal, input.title) &&
    rawSignal !== failureSpec.systemsDefinition &&
    rawSignal !== failureSpec.summary;

  const validExistingQuestions = (input.existingQuestions || [])
    .map((q) =>
      normalizeQuestionSentenceCase(cleanRssText(String(q || "")), input.title)
    )
    .filter(
      (q) =>
        q.length >= 25 &&
        q.endsWith("?") &&
        !isTemplatedOrMalformedCopy(q, input.title) &&
        !containsInterpolatedHeadline(q, input.title) &&
        q !== primarySpec.diagnosticQuestionPattern
    );

  const noiseOverblown = hasValidExistingNoise
    ? sanitizeStringConcatenation(rawNoise)
    : buildWorkshopNoiseDiagnostic(input.sreFailureMode, input.primaryTool);

  const structuralSignal = hasValidExistingSignal
    ? sanitizeStringConcatenation(rawSignal)
    : buildWorkshopSignalDiagnostic(
        input.sreFailureMode,
        input.primaryTool,
        input.secondaryTool
      );

  const workshopQuestions = buildWorkshopSocraticQuestions(
    input.primaryTool,
    input.secondaryTool,
    input.sreFailureMode
  );

  const q1 = validExistingQuestions[0] || workshopQuestions[0];
  const rawQ2 = validExistingQuestions[1] || workshopQuestions[1];
  const q2 =
    rawQ2 === q1
      ? workshopQuestions[1] !== q1
        ? workshopQuestions[1]
        : workshopQuestions[0]
      : rawQ2;

  const repaired =
    !hasValidExistingNoise ||
    !hasValidExistingSignal ||
    validExistingQuestions.length < 2;

  return {
    valid: true,
    noiseOverblown,
    structuralSignal,
    questions: [q1, q2],
    repaired,
  };
}

export interface NormalizedQuestionsPayload {
  executiveSummary: string | null;
  noiseOverblown: string | null;
  structuralSignal: string | null;
  questions: string[];
  isLeadPostMortem: boolean;
  leadPostMortemAnalysis: string | null;
}

/**
 * Normalizes stored `questions_json` from D1 across both `proportionality_check`
 * (`noise_overblown`, `structural_signal`) and legacy `proportionality` (`noise`, `signal`)
 * JSON shapes, repairing any headline-interpolated or compliance-jargon fields via
 * `buildOrSanitizeArticleDiagnostics`.
 */
export function normalizeStoredQuestionsPayload(
  questionsJson: string | null | undefined,
  options?:
    | {
        title?: string;
        sourceFeed?: string;
        factualSummary?: string;
        primaryTool?: WorkingToolId;
        secondaryTool?: WorkingToolId;
        sreFailureMode?: SreFailureModeId;
      }
    | string
): NormalizedQuestionsPayload {
  if (!questionsJson || typeof questionsJson !== "string") {
    return {
      executiveSummary: null,
      noiseOverblown: null,
      structuralSignal: null,
      questions: [],
      isLeadPostMortem: false,
      leadPostMortemAnalysis: null,
    };
  }

  const opts =
    typeof options === "string" ? { title: options } : options || {};
  const title = (opts.title || "").trim();
  const primaryTool: WorkingToolId = opts.primaryTool || "The Square";
  const secondaryTool: WorkingToolId = opts.secondaryTool || "24-Inch Gauge";
  const sreFailureMode: SreFailureModeId =
    opts.sreFailureMode || "Configuration Drift";

  try {
    const parsedQ = JSON.parse(questionsJson);
    if (Array.isArray(parsedQ)) {
      const rawQuestions = parsedQ.map((q) => String(q || "").trim()).filter(Boolean);
      const needsRepair = rawQuestions.some(
        (q) =>
          isTemplatedOrMalformedCopy(q, title) ||
          (title ? containsInterpolatedHeadline(q, title) : false)
      );
      if (needsRepair) {
        const repaired = buildOrSanitizeArticleDiagnostics({
          title: title || "Incident Dispatch",
          sourceFeed: opts.sourceFeed || "WIRE",
          factualSummary:
            opts.factualSummary ||
            "Operational review of the reported incident and the surrounding institutional safeguards across the field.",
          primaryTool,
          secondaryTool,
          sreFailureMode,
          existingQuestions: rawQuestions,
        });
        return {
          executiveSummary: null,
          noiseOverblown: null,
          structuralSignal: null,
          questions: repaired.valid ? [...repaired.questions] : [],
          isLeadPostMortem: false,
          leadPostMortemAnalysis: null,
        };
      }
      return {
        executiveSummary: null,
        noiseOverblown: null,
        structuralSignal: null,
        questions: rawQuestions.map((q) => normalizeQuestionSentenceCase(q, title)),
        isLeadPostMortem: false,
        leadPostMortemAnalysis: null,
      };
    }

    if (parsedQ && typeof parsedQ === "object") {
      const executiveSummary =
        typeof parsedQ.executive_summary === "string" &&
        parsedQ.executive_summary.trim()
          ? sanitizeStringConcatenation(parsedQ.executive_summary.trim())
          : typeof parsedQ.executiveSummary === "string" &&
              parsedQ.executiveSummary.trim()
            ? sanitizeStringConcatenation(parsedQ.executiveSummary.trim())
            : null;

      const propCheck =
        parsedQ.proportionality_check &&
        typeof parsedQ.proportionality_check === "object"
          ? parsedQ.proportionality_check
          : null;
      const legacyProp =
        parsedQ.proportionality && typeof parsedQ.proportionality === "object"
          ? parsedQ.proportionality
          : null;

      const rawNoiseCandidate =
        (typeof propCheck?.noise_overblown === "string" &&
          propCheck.noise_overblown.trim()) ||
        (typeof propCheck?.noise === "string" && propCheck.noise.trim()) ||
        (typeof legacyProp?.noise_overblown === "string" &&
          legacyProp.noise_overblown.trim()) ||
        (typeof legacyProp?.noise === "string" && legacyProp.noise.trim()) ||
        (typeof parsedQ.the_noise === "string" && parsedQ.the_noise.trim()) ||
        null;

      const rawSignalCandidate =
        (typeof propCheck?.structural_signal === "string" &&
          propCheck.structural_signal.trim()) ||
        (typeof propCheck?.signal === "string" && propCheck.signal.trim()) ||
        (typeof legacyProp?.structural_signal === "string" &&
          legacyProp.structural_signal.trim()) ||
        (typeof legacyProp?.signal === "string" && legacyProp.signal.trim()) ||
        (typeof parsedQ.the_signal === "string" && parsedQ.the_signal.trim()) ||
        null;

      const rawQuestionsArray: string[] = Array.isArray(parsedQ.questions)
        ? parsedQ.questions.map((q: unknown) => String(q || "").trim()).filter(Boolean)
        : Array.isArray(parsedQ.the_questions)
          ? parsedQ.the_questions
              .map((q: unknown) => String(q || "").trim())
              .filter(Boolean)
          : [];

      const hasAnyDiagnostics =
        Boolean(rawNoiseCandidate) ||
        Boolean(rawSignalCandidate) ||
        rawQuestionsArray.length > 0;

      if (hasAnyDiagnostics) {
        const sanitized = buildOrSanitizeArticleDiagnostics({
          title: title || "Incident Dispatch",
          sourceFeed: opts.sourceFeed || "WIRE",
          factualSummary:
            opts.factualSummary ||
            executiveSummary ||
            "Operational review of the reported incident and the surrounding institutional safeguards across the field.",
          primaryTool,
          secondaryTool,
          sreFailureMode,
          existingNoise: rawNoiseCandidate,
          existingSignal: rawSignalCandidate,
          existingQuestions: rawQuestionsArray,
        });

        if (sanitized.valid) {
          return {
            executiveSummary,
            noiseOverblown: sanitized.noiseOverblown,
            structuralSignal: sanitized.structuralSignal,
            questions: [...sanitized.questions],
            isLeadPostMortem: Boolean(parsedQ.is_lead_post_mortem),
            leadPostMortemAnalysis:
              typeof parsedQ.lead_post_mortem_analysis === "string" &&
              parsedQ.lead_post_mortem_analysis.trim()
                ? sanitizeStringConcatenation(
                    parsedQ.lead_post_mortem_analysis.trim()
                  )
                : null,
          };
        }
      }

      return {
        executiveSummary,
        noiseOverblown: rawNoiseCandidate,
        structuralSignal: rawSignalCandidate,
        questions: rawQuestionsArray,
        isLeadPostMortem: Boolean(parsedQ.is_lead_post_mortem),
        leadPostMortemAnalysis:
          typeof parsedQ.lead_post_mortem_analysis === "string" &&
          parsedQ.lead_post_mortem_analysis.trim()
            ? sanitizeStringConcatenation(parsedQ.lead_post_mortem_analysis.trim())
            : null,
      };
    }
  } catch {
    // Ignore malformed questions_json
  }

  return {
    executiveSummary: null,
    noiseOverblown: null,
    structuralSignal: null,
    questions: [],
    isLeadPostMortem: false,
    leadPostMortemAnalysis: null,
  };
}

