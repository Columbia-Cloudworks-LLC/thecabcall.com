"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Compass,
  Copy,
  ExternalLink,
  FileJson,
  Radio,
  Rss,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { SquareAndCompassesCrest } from "./MasonicEngravings";
import {
  HeroCornerBrackets,
  SectionHeader,
} from "./ui/BroadsheetPrimitives";

export interface PublicSourcedFeedInfo {
  name: string;
  category: string;
  cadence?: string;
}

export type PublicationBeatCategory =
  | "Wire & Mainstream"
  | "Tech, Cyber & Science"
  | "Policy, Law & Markets"
  | "Journals & Commentary";

export const PUBLICATION_BEAT_ORDER: PublicationBeatCategory[] = [
  "Wire & Mainstream",
  "Tech, Cyber & Science",
  "Policy, Law & Markets",
  "Journals & Commentary",
];

export const DEFAULT_SYNDICATED_SOURCED_FEEDS: PublicSourcedFeedInfo[] = [
  // 1. Wire & Mainstream
  { name: "NPR Top News", category: "Broad US Top Stories" },
  { name: "PBS NewsHour Nation", category: "Institutional & Policy" },
  { name: "NYT HomePage", category: "Mainstream Agenda-Setting" },
  { name: "BBC News (World)", category: "International / Center" },
  { name: "ProPublica", category: "Investigative / Public Accountability" },
  { name: "The Guardian (World)", category: "International / Center-Left" },
  { name: "Al Jazeera English", category: "Global South / International" },
  { name: "Defense One", category: "US National Security & Military" },
  { name: "The Conversation (US)", category: "Academic & Research-Driven News" },
  { name: "Reuters (via Google News)", category: "Global Wire" },

  // 2. Tech, Cyber & Science
  { name: "Ars Technica", category: "Tech, Infrastructure & Security" },
  { name: "Krebs on Security", category: "Deep-Dive Cybercrime & Infrastructure Breaches" },
  { name: "Schneier on Security", category: "Security Engineering, Cryptography & Policy" },
  { name: "The Register", category: "Enterprise IT, Cloud Outages & Regulatory Analysis" },
  { name: "IEEE Spectrum", category: "Hard Engineering, Energy Grid & Robotics" },
  { name: "MIT Technology Review", category: "Emerging Tech, AI Governance & Biotech" },
  { name: "Quanta Magazine", category: "Pure Science, Mathematics & Complex Systems" },
  { name: "BleepingComputer", category: "Zero-Day Exploits, Ransomware & Outage News" },

  // 3. Policy, Law & Markets
  { name: "WSJ US Business", category: "Corporate, Supply Chain & Fed" },
  { name: "SCOTUSblog", category: "Supreme Court & Constitutional Law" },
  { name: "Lawfare", category: "Hard National Security, Cybersecurity & Law" },
  { name: "Roll Call", category: "Legislative Process & Capitol Hill Mechanics" },
  { name: "The Hill (News)", category: "Bipartisan Beltway Reporting" },
  { name: "Politico (Policy & Politics)", category: "Executive Branch & Campaign Mechanics" },
  { name: "Foreign Affairs", category: "Deep Geopolitical Strategy (CFR)" },
  { name: "Foreign Policy", category: "Global Statecraft & Diplomacy" },
  { name: "The Economist (World)", category: "Macroeconomics & Global News" },
  { name: "Financial Times (World)", category: "Global Markets & Sovereign Finance" },
  { name: "Calculated Risk", category: "Data-Heavy US Housing & Macro Indicators" },
  { name: "Marginal Revolution", category: "Economics & Institutional Incentives" },
  { name: "Cato Institute", category: "Constitutional & Market Policy Think Tank" },
  { name: "American Enterprise Institute", category: "Market & Regulatory Policy Think Tank" },
  { name: "The Volokh Conspiracy", category: "Constitutional Law & Legal Theory" },
  { name: "City Journal (Manhattan Inst.)", category: "Urban Policy, Governance & Municipal Systems" },

  // 4. Journals & Commentary
  { name: "Reason Magazine", category: "Free Markets & Civil Liberties" },
  { name: "National Review", category: "Constitutional & Institutional Conservative" },
  { name: "The American Conservative", category: "Main Street & Non-Interventionist Critique" },
  { name: "The Dispatch", category: "Center-Right Fact-Focused Reporting" },
  { name: "The Atlantic", category: "Institutional & Cultural Analysis" },
  { name: "The American Prospect", category: "Public Policy & Political Economy" },
  { name: "Mother Jones", category: "Investigative & Accountability Journalism" },
  { name: "Vox", category: "Policy Explainers & Institutional Mechanics" },
  { name: "The Intercept", category: "National Security, Surveillance & Accountability" },
  { name: "Jacobin", category: "Labor, Industrial & Class Analysis" },
  { name: "Aeon Magazine", category: "Philosophy, Psychology & History Essays" },
  { name: "Noema Magazine (Berggruen)", category: "Governance, Philosophy & Planetary Systems" },
  { name: "UnHerd", category: "Heterodox Political & Cultural Commentary" },
  { name: "Compact Magazine", category: "Post-Liberal & Civic Critique" },
  { name: "Quillette", category: "Free Inquiry, Science & Culture" },
  { name: "Astral Codex Ten", category: "Systems, Psychiatry & Meta-Science" },
  { name: "The New Atlantis", category: "Ethics & Philosophy of Technology and Science" },
];

const WIRE_AND_MAINSTREAM_NAMES = new Set([
  "npr top news",
  "npr news",
  "pbs newshour nation",
  "pbs newshour",
  "nyt homepage",
  "new york times",
  "bbc news (world)",
  "propublica",
  "the guardian (world)",
  "al jazeera english",
  "defense one",
  "the conversation (us)",
  "reuters (via google news)",
  "reuters",
  "associated press",
]);

const TECH_CYBER_SCIENCE_NAMES = new Set([
  "ars technica",
  "krebs on security",
  "schneier on security",
  "the register",
  "ieee spectrum",
  "mit technology review",
  "quanta magazine",
  "bleepingcomputer",
]);

const POLICY_LAW_MARKETS_NAMES = new Set([
  "wsj us business",
  "wall street journal",
  "scotusblog",
  "lawfare",
  "roll call",
  "the hill (news)",
  "politico (policy & politics)",
  "foreign affairs",
  "foreign policy",
  "the economist (world)",
  "financial times (world)",
  "calculated risk",
  "marginal revolution",
  "cato institute",
  "american enterprise institute",
  "the volokh conspiracy",
  "city journal (manhattan inst.)",
]);

export function categorizePublicationBeat(
  name: string,
  descriptor: string
): PublicationBeatCategory {
  const normName = name.trim().toLowerCase();
  const normDesc = descriptor.trim().toLowerCase();

  if (WIRE_AND_MAINSTREAM_NAMES.has(normName)) {
    return "Wire & Mainstream";
  }
  if (TECH_CYBER_SCIENCE_NAMES.has(normName)) {
    return "Tech, Cyber & Science";
  }
  if (POLICY_LAW_MARKETS_NAMES.has(normName)) {
    return "Policy, Law & Markets";
  }

  if (
    /\b(cyber|security|tech|engineering|science|quantum|robotics|ransomware|cloud|biotech|math)\b/i.test(
      normDesc
    ) &&
    !/\b(national security|lawfare|intercept|philosophy of technology)\b/i.test(
      `${normName} ${normDesc}`
    )
  ) {
    return "Tech, Cyber & Science";
  }

  if (
    /\b(wire|top stories|mainstream|international|world|investigative|broadcast)\b/i.test(
      normDesc
    ) &&
    !/\b(economist|financial times|mother jones)\b/i.test(normName)
  ) {
    return "Wire & Mainstream";
  }

  if (
    /\b(court|constitutional|law|legislative|capitol|beltway|markets|macro|finance|housing|supply chain|fed|diplomacy|geopolitical|think tank|urban policy)\b/i.test(
      normDesc
    )
  ) {
    return "Policy, Law & Markets";
  }

  return "Journals & Commentary";
}

interface SystemStatusClientProps {
  sourcedFeeds?: PublicSourcedFeedInfo[];
  publishedBriefCount?: number;
  publishedEpisodeCount?: number;
  latestEpisodeTitle?: string;
  latestEpisodeNumber?: number;
}

export function SystemStatusClient({
  sourcedFeeds = DEFAULT_SYNDICATED_SOURCED_FEEDS,
  latestEpisodeTitle = "The Friday CAB Weekly Brief",
}: SystemStatusClientProps) {
  const [copiedFeedKey, setCopiedFeedKey] = useState<string | null>(null);

  const handleCopyUrl = (key: string, url: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedFeedKey(key);
      setTimeout(() => setCopiedFeedKey(null), 2500);
    }
  };

  const outboundPublishedFeeds = [
    {
      key: "podcast-rss",
      title: "The CAB Call Podcast Feed",
      path: "/feed.xml",
      fullUrl: "https://thecabcall.com/feed.xml",
      description:
        "Delivers our weekly spoken retrospectives and deep-dive conversational episodes with direct audio enclosures and full transcripts.",
      icon: Radio,
    },
    {
      key: "incidents-rss",
      title: "The Craftsman's Brief Syndication Feed",
      path: "/feeds/incidents.xml",
      fullUrl: "https://thecabcall.com/feeds/incidents.xml",
      description:
        "Full-text RSS 2.0 feed of every verified Craftsman's Brief published to The Trestleboard, including plain facts, structural signal, and Socratic questions.",
      icon: Rss,
    },
    {
      key: "incidents-json",
      title: "The Trestleboard JSON Feed",
      path: "/feeds/incidents.json",
      fullUrl: "https://thecabcall.com/feeds/incidents.json",
      description:
        "Machine-readable JSON Feed 1.1 edition of The Trestleboard Case Ledger tagged by Working Tool, Failure Mode, and civic sector.",
      icon: FileJson,
    },
  ];

  const groupedFeedsByBeat: Record<
    PublicationBeatCategory,
    PublicSourcedFeedInfo[]
  > = {
    "Wire & Mainstream": [],
    "Tech, Cyber & Science": [],
    "Policy, Law & Markets": [],
    "Journals & Commentary": [],
  };

  for (const feed of sourcedFeeds) {
    const beat = categorizePublicationBeat(feed.name, feed.category);
    groupedFeedsByBeat[beat].push(feed);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
      {/* 1. Masthead & Philosophy Hero */}
      <section
        id="mission"
        className="tracing-board-frame p-6 sm:p-10 relative scroll-mt-20"
      >
        <HeroCornerBrackets size="md" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              <Compass className="w-4 h-4" />
              <span>About &amp; Feeds · Mission, Philosophy &amp; Syndication Ledger</span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl text-[#F3EFE6] leading-tight">
              Why Examine Current Events Through Site Reliability Engineering &amp; the Working Tools of Freemasonry?
            </h1>

            <p className="font-serif text-base sm:text-lg text-[#F3EFE6]/90 leading-relaxed">
              Modern news cycles are built to reward speed, outrage, and partisan blame. When a power grid falters, a public agency stumbles, or a critical institution breaks down, public commentary immediately hunts for a villain to scold rather than inspecting the load-bearing structure that failed.
            </p>

            <p className="font-serif text-sm sm:text-base text-[#94A3B8] leading-relaxed">
              <strong className="text-[#F3EFE6]">The Change Advisory Board (The CAB Call)</strong> exists as a calm, methodical counterweight to that panic. In both high-reliability systems engineering and traditional operative stonecraft, you never repair a cracked foundation by shouting at the last worker who touched the lever. You convene a Change Advisory Board: you steady the room, establish the plain facts, separate loud bystander chatter (<em className="text-[#F3EFE6]">the noise</em>) from the underlying architectural flaw (<em className="text-[#F3EFE6]">the signal</em>), and ask the Socratic questions required to rebuild on the square.
            </p>
          </div>

          {/* Right Colophon Summary (Flattened via hairline rule — zero nested box) */}
          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-[#8A6D3B]/35 pt-6 lg:pt-0 lg:pl-8 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#8A6D3B]/35">
              <SquareAndCompassesCrest className="w-10 h-10 shrink-0" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                  Broadsheet Colophon
                </div>
                <div className="font-display text-base text-[#F3EFE6]">
                  The CAB Call Charter
                </div>
              </div>
            </div>

            <p className="font-serif italic text-sm text-[#C5A059] leading-relaxed">
              &ldquo;Meet on the Level. Act by the Plumb. Part upon the Square.&rdquo;
            </p>

            <dl className="space-y-2.5 pt-1 text-xs font-serif text-[#94A3B8]">
              <div className="flex items-start justify-between gap-2 border-b border-[#8A6D3B]/25 pb-2">
                <dt className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Editorial Posture
                </dt>
                <dd className="text-[#F3EFE6] text-right">
                  Blameless Structural Inspection
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-[#8A6D3B]/25 pb-2">
                <dt className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Moral Architecture
                </dt>
                <dd className="text-[#F3EFE6] text-right">
                  The Six Working Tools
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-[#8A6D3B]/25 pb-2">
                <dt className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Systems Discipline
                </dt>
                <dd className="text-[#F3EFE6] text-right">
                  Site Reliability Engineering
                </dd>
              </div>
              <div className="flex items-start justify-between gap-2">
                <dt className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Published Feeds
                </dt>
                <dd className="text-[#F3EFE6] text-right">
                  Podcast RSS, Briefs RSS &amp; JSON
                </dd>
              </div>
            </dl>

            <div className="pt-2">
              <a
                href="#published-feeds"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors"
              >
                <Rss className="w-3.5 h-3.5" />
                <span>View All Published Feeds</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The Point & Philosophy of the Website (Two De-Nested Pillars) */}
      <section className="space-y-6">
        <SectionHeader
          eyebrow="The Philosophy · Operative Craft Meets Site Reliability"
          title="Two Diagnostic Lenses for Civic & Institutional Failures"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pillar I: Why Freemasonry's Working Tools? */}
          <div className="tracing-board-frame p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
                <div>
                  <span className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
                    Pillar I · Moral Architecture
                  </span>
                  <h3 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                    The Six Working Tools as Civic Instruments
                  </h3>
                </div>
                <Scale className="w-6 h-6 text-[#C5A059] shrink-0" />
              </div>

              <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/90 leading-relaxed">
                Operative stonemasons built cathedrals and civic halls that stood for centuries because they did not trust guesswork. Every stone was tried against physical instruments—the Gauge, the Gavel, the Plumb, the Square, the Level, and the Trowel—before it was trusted to bear weight.
              </p>

              <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                Speculative Freemasonry preserved those six instruments as a practical philosophy for human conduct and institutional stewardship. On <strong className="text-[#F3EFE6]">The CAB Call</strong>, the Working Tools are never treated as dusty museum curiosities or esoteric trivia; they are used as active diagnostic lenses to ask whether leaders and institutions are budgeting their time honestly, stripping away reactive vices, standing upright when convenient shortcuts beckon, squaring their public promises with their actual deeds, meeting citizens on the level of shared accountability, and spreading the mortar of civic trust.
              </p>
            </div>

            <div className="pt-4 border-t border-[#8A6D3B]/30">
              <Link
                href="/rubric"
                className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
              >
                <span>Explore the Working Tools &amp; Fault Taxonomy →</span>
              </Link>
            </div>
          </div>

          {/* Pillar II: Why Site Reliability Engineering? */}
          <div className="tracing-board-frame p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
                <div>
                  <span className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
                    Pillar II · Systems Reliability
                  </span>
                  <h3 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                    Blameless Inspection Over Partisan Scapegoating
                  </h3>
                </div>
                <ShieldCheck className="w-6 h-6 text-[#C5A059] shrink-0" />
              </div>

              <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/90 leading-relaxed">
                When a complex distributed system suffers an outage, seasoned Site Reliability Engineers do not ask, <em>&ldquo;Who can we fire by sundown?&rdquo;</em> They ask, <em>&ldquo;What missing guardrail, untested backup, or silent drift allowed a single mistake to cascade across the system?&rdquo;</em>
              </p>

              <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                Public institutions, supply chains, courts, and municipal utilities fail along the exact same fault lines as large-scale engineering systems. By translating technical failure analysis into plain-spoken shop-floor concepts, every Craftsman&apos;s Brief diagnoses the structural root cause rather than amplifying the daily outrage cycle.
              </p>
            </div>

            <div className="pt-4 border-t border-[#8A6D3B]/30">
              <Link
                href="/rubric"
                className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
              >
                <span>Explore the Working Tools &amp; Fault Taxonomy →</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. All Currently Published Feeds (Slimmed Outbound Syndication Cards) */}
      <section id="feeds" className="scroll-mt-20 space-y-6">
        <div id="published-feeds" className="scroll-mt-20">
          <SectionHeader
            eyebrow="Published Syndication Feeds · RSS 2.0 & JSON Feed 1.1"
            title="Feeds Published by The Change Advisory Board"
            subtitle="All audio retrospectives and written Craftsman's Briefs are published over open syndication protocols with zero paywalls, zero algorithmic tracking, and full text inclusion."
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {outboundPublishedFeeds.map((feed) => {
            const IconComponent = feed.icon;
            const isCopied = copiedFeedKey === feed.key;

            return (
              <div
                key={feed.key}
                className="tracing-board-frame p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl text-[#F3EFE6]">
                      {feed.title}
                    </h3>
                    <IconComponent className="w-4 h-4 text-[#C5A059] shrink-0 mt-1" />
                  </div>

                  <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                    {feed.description}
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-[#8A6D3B]/30">
                  {/* Copyable Feed URL Bar */}
                  <div className="flex items-center bg-[#0B0E14] border border-[#8A6D3B]/45 p-1.5">
                    <code className="font-mono text-xs text-[#F3EFE6] px-2 flex-1 truncate">
                      {feed.fullUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(feed.key, feed.fullUrl)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#C5A059] text-[#0B0E14] font-mono text-[11px] font-bold uppercase hover:bg-[#d6b36a] transition-colors cursor-pointer shrink-0"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-end">
                    <a
                      href={feed.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                    >
                      <span>Open Raw Feed →</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Sourced Input Ledger (Compact 4-Column Typography Directory) */}
      <section id="monitored-publications" className="scroll-mt-20 space-y-6">
        <SectionHeader
          eyebrow={`Sourced Input Ledger · ${sourcedFeeds.length} Active Sources`}
          title="Monitored Upstream Publications"
          subtitle="All monitored publications are polled on an automated schedule to identify candidate civic, infrastructure, and institutional events for structural inspection."
        />

        <div className="tracing-board-frame p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PUBLICATION_BEAT_ORDER.map((beat) => {
              const items = groupedFeedsByBeat[beat];
              return (
                <div key={beat} className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2 pb-2.5 border-b border-[#C5A059]/45">
                    <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-[#C5A059] font-semibold">
                      {beat}
                    </h3>
                    <span className="font-mono text-[11px] text-[#94A3B8]">
                      {items.length}
                    </span>
                  </div>

                  <ul className="divide-y divide-[#8A6D3B]/20" role="list">
                    {items.map((feed) => (
                      <li key={feed.name} className="py-2">
                        <div className="font-display text-sm text-[#F3EFE6] leading-snug">
                          {feed.name}
                        </div>
                        <div className="font-serif text-xs text-[#94A3B8] leading-snug mt-0.5">
                          {feed.category}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. How the Application Works & Anatomy of a Craftsman's Brief (Flattened Lists) */}
      <section id="editorial-standards" className="scroll-mt-20 space-y-6">
        <SectionHeader
          eyebrow="Methodology & Brief Anatomy"
          title="How Every Case Is Triaged & Synthesized"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Four-Stage Structural Inspection Discipline (7 cols, flattened typographic list) */}
          <div className="lg:col-span-7 tracing-board-frame p-6 sm:p-8 space-y-4">
            <div className="border-b border-[#8A6D3B]/35 pb-4">
              <span className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
                Editorial Methodology · Sourced Triage &amp; Socratic Review
              </span>
              <h3 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                Four-Stage Structural Inspection Discipline
              </h3>
              <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                Every dispatch on The Trestleboard passes through a four-stage automated and editorial pipeline before publication.
              </p>
            </div>

            <ol className="divide-y divide-[#8A6D3B]/30">
              <li className="py-4 first:pt-1 flex gap-4">
                <span className="font-mono text-xs font-bold text-[#C5A059] w-6 shrink-0 pt-1">
                  I.
                </span>
                <div>
                  <h4 className="font-display text-base text-[#F3EFE6]">
                    Concurrent Sourced Ingestion &amp; Canonical De-duplication
                  </h4>
                  <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                    Target dispatches are polled concurrently under strict byte and timeout bounds, stripped of unsafe markup and tracking parameters, and fingerprinted via canonical URL and GUID hashing.
                  </p>
                </div>
              </li>

              <li className="py-4 flex gap-4">
                <span className="font-mono text-xs font-bold text-[#C5A059] w-6 shrink-0 pt-1">
                  II.
                </span>
                <div>
                  <h4 className="font-display text-base text-[#F3EFE6]">
                    Dual-Axis Structural Triage
                  </h4>
                  <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                    Each candidate dispatch is evaluated for structural signal versus transient celebrity or horse-race commentary. High-signal events are paired with their primary Masonic Working Tool and Shop-Floor Failure Mode.
                  </p>
                </div>
              </li>

              <li className="py-4 flex gap-4">
                <span className="font-mono text-xs font-bold text-[#C5A059] w-6 shrink-0 pt-1">
                  III.
                </span>
                <div>
                  <h4 className="font-display text-base text-[#F3EFE6]">
                    Bounded Socratic Structural Inspection
                  </h4>
                  <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                    Verified cases are synthesized into Craftsman&apos;s Briefs that establish the plain facts, separate partisan heat and spin from the actual structural foundation, and pose open Socratic questions for fair judgment.
                  </p>
                </div>
              </li>

              <li className="py-4 last:pb-1 flex gap-4">
                <span className="font-mono text-xs font-bold text-[#C5A059] w-6 shrink-0 pt-1">
                  IV.
                </span>
                <div>
                  <h4 className="font-display text-base text-[#F3EFE6]">
                    The Friday CAB Weekly Brief ({latestEpisodeTitle})
                  </h4>
                  <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                    Every Friday, the week&rsquo;s anchor dispatches are distilled into a spoken retrospective and syndicated via the public RSS 2.0 podcast feed (<code>/feed.xml</code>).
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Right: Anatomy of a Craftsman's Brief (5 cols, flattened typographic list) */}
          <div className="lg:col-span-5 tracing-board-frame p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="border-b border-[#8A6D3B]/35 pb-4">
                <span className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
                  How to Read The Trestleboard · Brief Structure
                </span>
                <h3 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                  Anatomy of a Craftsman&apos;s Brief
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Every case published on The Trestleboard follows a strict three-part layout designed so you can inspect the facts and test the structure in under two minutes.
                </p>
              </div>

              <ol className="divide-y divide-[#8A6D3B]/30">
                <li className="py-3.5 first:pt-1 space-y-1">
                  <div className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
                    I. What Happened (The Plain Facts)
                  </div>
                  <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                    A sober, multi-sentence account of the event—what broke, which institution or infrastructure was affected, and what concrete evidence is currently on the table—stripped of sensational adjectives.
                  </p>
                </li>

                <li className="py-3.5 space-y-1">
                  <div className="font-mono text-xs text-[#F59E0B] uppercase tracking-wider">
                    II. Partisan Heat &amp; Spin vs. The Actual Foundation
                  </div>
                  <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                    Side-by-side diagnostic contrast isolating the loud emotional or partisan distraction (<em>The Noise</em>) from the underlying architectural or governance weakness (<em>The Signal</em>).
                  </p>
                </li>

                <li className="py-3.5 last:pb-1 space-y-1">
                  <div className="font-mono text-xs text-[#10B981] uppercase tracking-wider">
                    III. Questions for Fair &amp; Consistent Judgment
                  </div>
                  <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                    Two open Socratic questions anchored in the case&apos;s Working Tool and Failure Mode. Rather than telling you what conclusion to reach, the Board asks what standard should apply to everyone on the level.
                  </p>
                </li>
              </ol>
            </div>

            <div className="pt-4 border-t border-[#8A6D3B]/30 space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#C5A059]">
                Editorial Independence &amp; Auditable Provenance
              </div>
              <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
                Public visitors cannot alter feeds, inject articles, or trigger pipeline runs. All feed curation, headline de-escalation, and episode publishing are restricted to authenticated Board administrators and recorded in an append-only SHA-256 cryptographic audit ledger.
              </p>
              <div className="pt-1">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                >
                  <span>Inspect The Trestleboard →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Governance Charter */}
      <section className="space-y-6">
        <SectionHeader
          eyebrow="Editorial Governance Charter"
          title="Three Non-Negotiable House Rules"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="tracing-board-frame p-6 space-y-3">
            <div className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
              Charter Rule 01 · Zero Definitions
            </div>
            <h3 className="font-display text-lg text-[#F3EFE6]">
              Never Lecture the Craft
            </h3>
            <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
              Weekly rollup scripts and Craftsman&apos;s Briefs are strictly forbidden from reciting monitorial textbook definitions of the Working Tools or basic engineering acronyms. Tools are invoked as operational verbs and diagnostic instruments that the reader experiences in action.
            </p>
          </div>

          <div className="tracing-board-frame p-6 space-y-3">
            <div className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
              Charter Rule 02 · Epistemic Humility
            </div>
            <h3 className="font-display text-lg text-[#F3EFE6]">
              The &ldquo;Pending Post-Mortem&rdquo; Rule
            </h3>
            <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
              The Board never declares a partisan villain or predicts catastrophic outcomes. Ongoing stories are framed as active cases awaiting complete inspection—highlighting what evidence is still missing and what Socratic questions will prove whether the system is recovering.
            </p>
          </div>

          <div className="tracing-board-frame p-6 space-y-3">
            <div className="font-mono text-xs text-[#C5A059] uppercase tracking-wider">
              Charter Rule 03 · Proportionality Check
            </div>
            <h3 className="font-display text-lg text-[#F3EFE6]">
              Separate Noise from the Foundation
            </h3>
            <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
              Every synthesized brief must explicitly separate one sensationalized detail the news cycle is overblowing (Partisan Heat &amp; Spin) from the underlying structural or architectural constraint (The Actual Foundation).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
