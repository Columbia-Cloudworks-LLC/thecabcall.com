"use client";

import React from "react";

export interface SourceOutletSpec {
  id: string;
  displayName: string;
  monogram: string;
  style: "serif" | "sans" | "mono" | "emblem";
  emblemType?:
    | "npr"
    | "pbs"
    | "nyt"
    | "wsj"
    | "ars"
    | "reuters"
    | "bbc"
    | "propublica"
    | "guardian"
    | "aljazeera"
    | "defenseone"
    | "conversation"
    | "reason"
    | "scotus"
    | "lawfare"
    | "economist"
    | "ft"
    | "krebs"
    | "schneier"
    | "register"
    | "ieee"
    | "mit"
    | "quanta"
    | "bleeping"
    | "cisa"
    | "gao"
    | "courthouse";
}

interface CatalogMatchRule {
  pattern: RegExp;
  hostPattern?: RegExp;
  spec: SourceOutletSpec;
}

const OUTLET_CATALOG: CatalogMatchRule[] = [
  // Original 5 Baseline Feeds
  {
    pattern: /\bnpr\b/i,
    hostPattern: /npr\.org/i,
    spec: {
      id: "npr",
      displayName: "NPR",
      monogram: "npr",
      style: "emblem",
      emblemType: "npr",
    },
  },
  {
    pattern: /\bpbs\b/i,
    hostPattern: /pbs\.org/i,
    spec: {
      id: "pbs",
      displayName: "PBS NewsHour",
      monogram: "PBS",
      style: "emblem",
      emblemType: "pbs",
    },
  },
  {
    pattern: /\b(?:nyt|new\s+york\s+times)\b/i,
    hostPattern: /nytimes\.com/i,
    spec: {
      id: "nyt",
      displayName: "The New York Times",
      monogram: "T",
      style: "emblem",
      emblemType: "nyt",
    },
  },
  {
    pattern: /\b(?:wsj|wall\s+street\s+journal)\b/i,
    hostPattern: /wsj\.com|dj\.com/i,
    spec: {
      id: "wsj",
      displayName: "Wall Street Journal",
      monogram: "WSJ",
      style: "emblem",
      emblemType: "wsj",
    },
  },
  {
    pattern: /\bars\s*technica\b/i,
    hostPattern: /arstechnica\.com/i,
    spec: {
      id: "arstechnica",
      displayName: "Ars Technica",
      monogram: "λ",
      style: "emblem",
      emblemType: "ars",
    },
  },

  // 1. Global Wire, Center & Investigative
  {
    pattern: /\bbbc\b/i,
    hostPattern: /bbc\.co\.uk|bbc\.com/i,
    spec: {
      id: "bbc",
      displayName: "BBC News",
      monogram: "BBC",
      style: "emblem",
      emblemType: "bbc",
    },
  },
  {
    pattern: /\bpropublica\b/i,
    hostPattern: /propublica\.org/i,
    spec: {
      id: "propublica",
      displayName: "ProPublica",
      monogram: "PP",
      style: "emblem",
      emblemType: "propublica",
    },
  },
  {
    pattern: /\bguardian\b/i,
    hostPattern: /theguardian\.com/i,
    spec: {
      id: "guardian",
      displayName: "The Guardian",
      monogram: "G",
      style: "emblem",
      emblemType: "guardian",
    },
  },
  {
    pattern: /\bal\s+jazeera\b/i,
    hostPattern: /aljazeera\.com/i,
    spec: {
      id: "aljazeera",
      displayName: "Al Jazeera",
      monogram: "AJ",
      style: "emblem",
      emblemType: "aljazeera",
    },
  },
  {
    pattern: /\bdefense\s+one\b/i,
    hostPattern: /defenseone\.com/i,
    spec: {
      id: "defenseone",
      displayName: "Defense One",
      monogram: "D1",
      style: "emblem",
      emblemType: "defenseone",
    },
  },
  {
    pattern: /\bthe\s+conversation\b/i,
    hostPattern: /theconversation\.com/i,
    spec: {
      id: "conversation",
      displayName: "The Conversation",
      monogram: "TC",
      style: "emblem",
      emblemType: "conversation",
    },
  },
  {
    pattern: /\breuters\b/i,
    hostPattern: /reuters\.com/i,
    spec: {
      id: "reuters",
      displayName: "Reuters",
      monogram: "R",
      style: "emblem",
      emblemType: "reuters",
    },
  },
  {
    pattern: /\b(?:ap\s+news|associated\s+press|^ap$)\b/i,
    hostPattern: /apnews\.com/i,
    spec: {
      id: "ap",
      displayName: "Associated Press",
      monogram: "AP",
      style: "sans",
    },
  },

  // 2. Right-of-Center, Conservative & Libertarian
  {
    pattern: /\bvolokh\b/i,
    hostPattern: /reason\.com\/volokh/i,
    spec: {
      id: "volokh",
      displayName: "The Volokh Conspiracy",
      monogram: "VC",
      style: "serif",
    },
  },
  {
    pattern: /\breason\b/i,
    hostPattern: /reason\.com/i,
    spec: {
      id: "reason",
      displayName: "Reason Magazine",
      monogram: "R",
      style: "emblem",
      emblemType: "reason",
    },
  },
  {
    pattern: /\bnational\s+review\b/i,
    hostPattern: /nationalreview\.com/i,
    spec: {
      id: "nationalreview",
      displayName: "National Review",
      monogram: "NR",
      style: "serif",
    },
  },
  {
    pattern: /\bamerican\s+conservative\b/i,
    hostPattern: /theamericanconservative\.com/i,
    spec: {
      id: "tac",
      displayName: "The American Conservative",
      monogram: "TAC",
      style: "serif",
    },
  },
  {
    pattern: /\bthe\s+dispatch\b/i,
    hostPattern: /thedispatch\.com/i,
    spec: {
      id: "thedispatch",
      displayName: "The Dispatch",
      monogram: "TD",
      style: "serif",
    },
  },
  {
    pattern: /\bcity\s+journal\b/i,
    hostPattern: /city-journal\.org/i,
    spec: {
      id: "cityjournal",
      displayName: "City Journal",
      monogram: "CJ",
      style: "serif",
    },
  },
  {
    pattern: /\bcato\b/i,
    hostPattern: /cato\.org/i,
    spec: {
      id: "cato",
      displayName: "Cato Institute",
      monogram: "CI",
      style: "serif",
    },
  },
  {
    pattern: /\b(?:american\s+enterprise\s+institute|^aei$)\b/i,
    hostPattern: /aei\.org/i,
    spec: {
      id: "aei",
      displayName: "AEI",
      monogram: "AEI",
      style: "serif",
    },
  },

  // 3. Left-of-Center, Progressive & Labor
  {
    pattern: /\bthe\s+atlantic\b/i,
    hostPattern: /theatlantic\.com/i,
    spec: {
      id: "theatlantic",
      displayName: "The Atlantic",
      monogram: "A",
      style: "serif",
    },
  },
  {
    pattern: /\bamerican\s+prospect\b/i,
    hostPattern: /prospect\.org/i,
    spec: {
      id: "prospect",
      displayName: "The American Prospect",
      monogram: "TAP",
      style: "serif",
    },
  },
  {
    pattern: /\bmother\s+jones\b/i,
    hostPattern: /motherjones\.com/i,
    spec: {
      id: "motherjones",
      displayName: "Mother Jones",
      monogram: "MJ",
      style: "sans",
    },
  },
  {
    pattern: /\bvox\b/i,
    hostPattern: /vox\.com/i,
    spec: {
      id: "vox",
      displayName: "Vox",
      monogram: "V",
      style: "serif",
    },
  },
  {
    pattern: /\bthe\s+intercept\b/i,
    hostPattern: /theintercept\.com/i,
    spec: {
      id: "theintercept",
      displayName: "The Intercept",
      monogram: "TI",
      style: "mono",
    },
  },
  {
    pattern: /\bjacobin\b/i,
    hostPattern: /jacobin\.com/i,
    spec: {
      id: "jacobin",
      displayName: "Jacobin",
      monogram: "J",
      style: "serif",
    },
  },

  // 4. U.S. Capitol Hill, Legal & Regulatory
  {
    pattern: /\bscotusblog\b/i,
    hostPattern: /scotusblog\.com/i,
    spec: {
      id: "scotusblog",
      displayName: "SCOTUSblog",
      monogram: "§",
      style: "emblem",
      emblemType: "scotus",
    },
  },
  {
    pattern: /\blawfare\b/i,
    hostPattern: /lawfaremedia\.org/i,
    spec: {
      id: "lawfare",
      displayName: "Lawfare",
      monogram: "LF",
      style: "emblem",
      emblemType: "lawfare",
    },
  },
  {
    pattern: /\broll\s+call\b/i,
    hostPattern: /rollcall\.com/i,
    spec: {
      id: "rollcall",
      displayName: "Roll Call",
      monogram: "RC",
      style: "serif",
    },
  },
  {
    pattern: /\bthe\s+hill\b/i,
    hostPattern: /thehill\.com/i,
    spec: {
      id: "thehill",
      displayName: "The Hill",
      monogram: "TH",
      style: "sans",
    },
  },
  {
    pattern: /\bpolitico\b/i,
    hostPattern: /politico\.com/i,
    spec: {
      id: "politico",
      displayName: "Politico",
      monogram: "P",
      style: "serif",
    },
  },
  {
    pattern: /\bcourthouse\s+news\b/i,
    hostPattern: /courthousenews\.com/i,
    spec: {
      id: "courthousenews",
      displayName: "Courthouse News",
      monogram: "CN",
      style: "emblem",
      emblemType: "courthouse",
    },
  },
  {
    pattern: /\b(?:gao|government\s+accountability\s+office)\b/i,
    hostPattern: /gao\.gov/i,
    spec: {
      id: "gao",
      displayName: "U.S. GAO",
      monogram: "GAO",
      style: "emblem",
      emblemType: "gao",
    },
  },
  {
    pattern: /\bcisa\b/i,
    hostPattern: /cisa\.gov/i,
    spec: {
      id: "cisa",
      displayName: "CISA",
      monogram: "CISA",
      style: "emblem",
      emblemType: "cisa",
    },
  },

  // 5. Macroeconomics, Finance & Geopolitics
  {
    pattern: /\bforeign\s+affairs\b/i,
    hostPattern: /foreignaffairs\.com/i,
    spec: {
      id: "foreignaffairs",
      displayName: "Foreign Affairs",
      monogram: "FA",
      style: "serif",
    },
  },
  {
    pattern: /\bforeign\s+policy\b/i,
    hostPattern: /foreignpolicy\.com/i,
    spec: {
      id: "foreignpolicy",
      displayName: "Foreign Policy",
      monogram: "FP",
      style: "serif",
    },
  },
  {
    pattern: /\bthe\s+economist\b/i,
    hostPattern: /economist\.com/i,
    spec: {
      id: "economist",
      displayName: "The Economist",
      monogram: "E",
      style: "emblem",
      emblemType: "economist",
    },
  },
  {
    pattern: /\b(?:financial\s+times|^ft$)\b/i,
    hostPattern: /ft\.com/i,
    spec: {
      id: "ft",
      displayName: "Financial Times",
      monogram: "FT",
      style: "emblem",
      emblemType: "ft",
    },
  },
  {
    pattern: /\bcalculated\s+risk\b/i,
    hostPattern: /calculatedriskblog\.com/i,
    spec: {
      id: "calculatedrisk",
      displayName: "Calculated Risk",
      monogram: "CR",
      style: "mono",
    },
  },
  {
    pattern: /\bmarginal\s+revolution\b/i,
    hostPattern: /marginalrevolution\.com/i,
    spec: {
      id: "marginalrevolution",
      displayName: "Marginal Revolution",
      monogram: "MR",
      style: "serif",
    },
  },

  // 6. Systems Engineering, Cyber, Science & Infrastructure
  {
    pattern: /\bkrebs\b/i,
    hostPattern: /krebsonsecurity\.com/i,
    spec: {
      id: "krebs",
      displayName: "Krebs on Security",
      monogram: "KS",
      style: "emblem",
      emblemType: "krebs",
    },
  },
  {
    pattern: /\bschneier\b/i,
    hostPattern: /schneier\.com/i,
    spec: {
      id: "schneier",
      displayName: "Schneier on Security",
      monogram: "SS",
      style: "emblem",
      emblemType: "schneier",
    },
  },
  {
    pattern: /\bthe\s+register\b/i,
    hostPattern: /theregister\.com/i,
    spec: {
      id: "theregister",
      displayName: "The Register",
      monogram: "El",
      style: "emblem",
      emblemType: "register",
    },
  },
  {
    pattern: /\bieee\s+spectrum\b/i,
    hostPattern: /spectrum\.ieee\.org/i,
    spec: {
      id: "ieeespectrum",
      displayName: "IEEE Spectrum",
      monogram: "IEEE",
      style: "emblem",
      emblemType: "ieee",
    },
  },
  {
    pattern: /\bmit\s+technology\s+review\b/i,
    hostPattern: /technologyreview\.com/i,
    spec: {
      id: "mittr",
      displayName: "MIT Tech Review",
      monogram: "MIT",
      style: "emblem",
      emblemType: "mit",
    },
  },
  {
    pattern: /\bquanta\b/i,
    hostPattern: /quantamagazine\.org/i,
    spec: {
      id: "quanta",
      displayName: "Quanta Magazine",
      monogram: "Q",
      style: "emblem",
      emblemType: "quanta",
    },
  },
  {
    pattern: /\bbleeping\s*computer\b/i,
    hostPattern: /bleepingcomputer\.com/i,
    spec: {
      id: "bleepingcomputer",
      displayName: "BleepingComputer",
      monogram: "BC",
      style: "emblem",
      emblemType: "bleeping",
    },
  },

  // 7. Philosophy, Culture & Heterodox Thought
  {
    pattern: /\baeon\b/i,
    hostPattern: /aeon\.co/i,
    spec: {
      id: "aeon",
      displayName: "Aeon Magazine",
      monogram: "Æ",
      style: "serif",
    },
  },
  {
    pattern: /\bnoema\b/i,
    hostPattern: /noemamag\.com/i,
    spec: {
      id: "noema",
      displayName: "Noema Magazine",
      monogram: "N",
      style: "serif",
    },
  },
  {
    pattern: /\bunherd\b/i,
    hostPattern: /unherd\.com/i,
    spec: {
      id: "unherd",
      displayName: "UnHerd",
      monogram: "UH",
      style: "serif",
    },
  },
  {
    pattern: /\bcompact\b/i,
    hostPattern: /compactmag\.com/i,
    spec: {
      id: "compact",
      displayName: "Compact Magazine",
      monogram: "CM",
      style: "serif",
    },
  },
  {
    pattern: /\bquillette\b/i,
    hostPattern: /quillette\.com/i,
    spec: {
      id: "quillette",
      displayName: "Quillette",
      monogram: "Q",
      style: "serif",
    },
  },
  {
    pattern: /\bastral\s+codex\s+ten\b/i,
    hostPattern: /astralcodexten\.com/i,
    spec: {
      id: "acx",
      displayName: "Astral Codex Ten",
      monogram: "ACX",
      style: "mono",
    },
  },
  {
    pattern: /\bnew\s+atlantis\b/i,
    hostPattern: /thenewatlantis\.com/i,
    spec: {
      id: "newatlantis",
      displayName: "The New Atlantis",
      monogram: "TNA",
      style: "serif",
    },
  },
];

function extractDomainMonogram(sourceFeed: string, sourceUrl: string): SourceOutletSpec {
  const cleanedFeed = (sourceFeed || "").trim();
  for (const rule of OUTLET_CATALOG) {
    if (cleanedFeed && rule.pattern.test(cleanedFeed)) {
      return rule.spec;
    }
    if (sourceUrl && rule.hostPattern && rule.hostPattern.test(sourceUrl)) {
      return rule.spec;
    }
  }

  let hostname = "";
  if (sourceUrl) {
    try {
      hostname = new URL(sourceUrl).hostname.replace(/^www\./i, "");
    } catch {
      hostname = "";
    }
  }

  const labelSource =
    cleanedFeed ||
    (hostname ? hostname.split(".")[0]?.toUpperCase() || "SOURCE" : "SOURCE");

  const tokens = labelSource
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 0 &&
        !/^(?:the|of|and|for|in|on|via|news|top|world|us|rss|feed)$/i.test(w)
    );

  let monogram = "SRC";
  if (tokens.length >= 2) {
    monogram = `${tokens[0]?.[0] || ""}${tokens[1]?.[0] || ""}`.toUpperCase();
  } else if (tokens.length === 1 && tokens[0]) {
    monogram = tokens[0].slice(0, 3).toUpperCase();
  } else if (hostname) {
    monogram = hostname.slice(0, 2).toUpperCase();
  }

  return {
    id: hostname || "custom-outlet",
    displayName: cleanedFeed || hostname || "Original Source",
    monogram,
    style: "serif",
  };
}

function renderOutletVectorMark(spec: SourceOutletSpec): React.ReactNode {
  switch (spec.emblemType) {
    case "npr":
      // Classic 3-block NPR geometric mark in brass/parchment
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="0.5" y="4.5" width="6" height="11" fill="#C5A059" fillOpacity="0.22" stroke="#C5A059" strokeWidth="1" />
          <rect x="7" y="4.5" width="6" height="11" fill="#0B0E14" stroke="#C5A059" strokeWidth="1" />
          <rect x="13.5" y="4.5" width="6" height="11" fill="#C5A059" fillOpacity="0.22" stroke="#C5A059" strokeWidth="1" />
          <text x="3.5" y="12.2" textAnchor="middle" fill="#F3EFE6" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">n</text>
          <text x="10" y="12.2" textAnchor="middle" fill="#C5A059" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">p</text>
          <text x="16.5" y="12.2" textAnchor="middle" fill="#F3EFE6" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">r</text>
        </svg>
      );
    case "bbc":
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="0.5" y="5" width="5.8" height="10" fill="#0B0E14" stroke="#C5A059" strokeWidth="1" />
          <rect x="7.1" y="5" width="5.8" height="10" fill="#0B0E14" stroke="#C5A059" strokeWidth="1" />
          <rect x="13.7" y="5" width="5.8" height="10" fill="#0B0E14" stroke="#C5A059" strokeWidth="1" />
          <text x="3.4" y="12.1" textAnchor="middle" fill="#F3EFE6" fontSize="6.2" fontWeight="700" fontFamily="sans-serif">B</text>
          <text x="10" y="12.1" textAnchor="middle" fill="#F3EFE6" fontSize="6.2" fontWeight="700" fontFamily="sans-serif">B</text>
          <text x="16.6" y="12.1" textAnchor="middle" fill="#F3EFE6" fontSize="6.2" fontWeight="700" fontFamily="sans-serif">C</text>
        </svg>
      );
    case "reuters":
      // Reuters orbital dot-ring emblem
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="#C5A059" strokeWidth="1.2" strokeDasharray="1.6 2.1" />
          <circle cx="10" cy="10" r="4.5" fill="none" stroke="#F3EFE6" strokeWidth="1" strokeDasharray="1.2 1.8" />
          <circle cx="10" cy="10" r="1.6" fill="#C5A059" />
        </svg>
      );
    case "ars":
      // Ars Technica orbital lambda/compass mark
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="1.5" y="1.5" width="17" height="17" rx="2" fill="#C5A059" fillOpacity="0.16" stroke="#C5A059" strokeWidth="1.1" />
          <path d="M6 14.5L10 5.5L14 14.5M7.5 11.5H12.5" stroke="#F3EFE6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "reason":
      // Reason bold geometric slanted masthead R
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="1.5" y="1.5" width="17" height="17" fill="#C5A059" fillOpacity="0.18" stroke="#C5A059" strokeWidth="1.1" />
          <text x="10" y="14.5" textAnchor="middle" fill="#F3EFE6" fontSize="12" fontWeight="800" fontStyle="italic" fontFamily="Georgia, serif">R</text>
        </svg>
      );
    case "scotus":
    case "courthouse":
      // Neoclassical temple / scales column mark
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <path d="M2.5 7L10 2.5L17.5 7H2.5Z" fill="#C5A059" fillOpacity="0.25" stroke="#C5A059" strokeWidth="1.1" strokeLinejoin="round" />
          <line x1="5.5" y1="7.5" x2="5.5" y2="15" stroke="#F3EFE6" strokeWidth="1.3" />
          <line x1="10" y1="7.5" x2="10" y2="15" stroke="#F3EFE6" strokeWidth="1.3" />
          <line x1="14.5" y1="7.5" x2="14.5" y2="15" stroke="#F3EFE6" strokeWidth="1.3" />
          <line x1="2.5" y1="16" x2="17.5" y2="16" stroke="#C5A059" strokeWidth="1.4" />
        </svg>
      );
    case "krebs":
    case "schneier":
    case "cisa":
      // Cyber / shield / terminal reticle mark
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <path
            d="M10 2L16.5 4.8V9.8C16.5 13.8 13.7 16.9 10 18C6.3 16.9 3.5 13.8 3.5 9.8V4.8L10 2Z"
            fill="#C5A059"
            fillOpacity="0.16"
            stroke="#C5A059"
            strokeWidth="1.2"
          />
          <text x="10" y="12.2" textAnchor="middle" fill="#F3EFE6" fontSize="5.8" fontWeight="700" fontFamily="monospace">
            {spec.monogram.slice(0, 3)}
          </text>
        </svg>
      );
    case "bleeping":
    case "register":
      // Terminal command prompt emblem
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect x="1.5" y="2.5" width="17" height="15" rx="1.5" fill="#0B0E14" stroke="#C5A059" strokeWidth="1.1" />
          <path d="M5 7.5L8 10L5 12.5" fill="none" stroke="#C5A059" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="9.5" y1="12.5" x2="14.5" y2="12.5" stroke="#F3EFE6" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    default: {
      const fontSize =
        spec.monogram.length >= 3
          ? "6.2"
          : spec.monogram.length === 2
          ? "8.2"
          : "11";
      const fontFamily =
        spec.style === "mono"
          ? "monospace"
          : spec.style === "sans"
          ? "system-ui, sans-serif"
          : "Georgia, 'Times New Roman', serif";
      return (
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0" aria-hidden="true">
          <rect
            x="1"
            y="1"
            width="18"
            height="18"
            fill="#C5A059"
            fillOpacity="0.14"
            stroke="#C5A059"
            strokeWidth="1.1"
          />
          <text
            x="10"
            y="13.2"
            textAnchor="middle"
            fill="#F3EFE6"
            fontSize={fontSize}
            fontWeight="700"
            fontFamily={fontFamily}
            letterSpacing="0.03em"
          >
            {spec.monogram}
          </text>
        </svg>
      );
    }
  }
}

export function SourceOutletBadge({
  sourceFeed,
  sourceUrl,
  className = "absolute top-3 left-3 z-20",
}: {
  sourceFeed: string;
  sourceUrl: string;
  className?: string;
}) {
  const spec = extractDomainMonogram(sourceFeed, sourceUrl);
  const label = (sourceFeed || spec.displayName || "SOURCE").toUpperCase();

  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open original dispatch on ${spec.displayName}`}
      aria-label={`Source: ${spec.displayName} (opens in new tab)`}
      className={`group/badge ${className} bg-[#0B0E14]/85 backdrop-blur-md border border-[#C5A059]/50 hover:border-[#C5A059] text-[#F3EFE6] shadow-lg transition-all duration-300 flex items-center h-8 px-2`}
    >
      {renderOutletVectorMark(spec)}
      <span className="overflow-hidden whitespace-nowrap max-w-0 opacity-0 group-hover/badge:max-w-[240px] group-hover/badge:opacity-100 group-hover/badge:pl-2.5 group-hover/badge:pr-1 group-focus-visible/badge:max-w-[240px] group-focus-visible/badge:opacity-100 transition-all duration-300 ease-out font-mono text-[10px] uppercase tracking-[0.12em] text-[#F3EFE6] flex items-center gap-1.5">
        <span>{label}</span>
        <span className="text-[#C5A059]" aria-hidden="true">
          ↗
        </span>
      </span>
    </a>
  );
}
