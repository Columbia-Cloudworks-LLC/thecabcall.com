"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
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
import { SRE_FAILURE_MODES, WORKING_TOOLS } from "@/lib/taxonomy";
import {
  BrassSectionDivider,
  SquareAndCompassesCrest,
  WorkingToolEngraving,
} from "./MasonicEngravings";

export interface PublicSourcedFeedInfo {
  name: string;
  category: string;
  cadence: string;
}

const DEFAULT_SYNDICATED_SOURCED_FEEDS: PublicSourcedFeedInfo[] = [
  {
    name: "NPR News",
    category: "National & Civic Infrastructure",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "PBS NewsHour",
    category: "Public Policy & Institutional Governance",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "New York Times",
    category: "National & Global Dispatches",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "Wall Street Journal",
    category: "Markets, Supply Chain & Enterprise Operations",
    cadence: "Concurrent Scheduled Poll",
  },
  {
    name: "Ars Technica",
    category: "Systems Engineering, Cloud & Security",
    cadence: "Concurrent Scheduled Poll",
  },
];

interface SystemStatusClientProps {
  sourcedFeeds?: PublicSourcedFeedInfo[];
  publishedBriefCount?: number;
  publishedEpisodeCount?: number;
  latestEpisodeTitle?: string;
  latestEpisodeNumber?: number;
}

export function SystemStatusClient({
  sourcedFeeds = DEFAULT_SYNDICATED_SOURCED_FEEDS,
  publishedBriefCount = 12,
  publishedEpisodeCount = 4,
  latestEpisodeTitle = "The Friday CAB Weekly Brief",
  latestEpisodeNumber = 43,
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
      badge: "PODCAST AUDIO & TRANSCRIPTS // RSS 2.0 + ITUNES",
      title: "The CAB Call Podcast Feed",
      path: "/feed.xml",
      fullUrl: "https://thecabcall.com/feed.xml",
      formatLabel: "application/rss+xml (Audio Enclosures)",
      cadence: "Published Every Friday + Legacy Deep-Dive Archive",
      countLabel: `${publishedEpisodeCount} Published Episodes (Latest: Ep. #${latestEpisodeNumber})`,
      description:
        "Delivers the 5-minute Friday CAB Weekly Brief spoken retrospectives (~750 words) and the full-length Legacy Deep-Dive Archive. Includes direct MP3 enclosures, chapter markers, and complete three-part transcripts.",
      readers: "Apple Podcasts, Spotify, Overcast, Pocket Casts, AntennaPod",
      icon: Radio,
      browseHref: "/archive",
      browseLabel: "Browse Podcast Archive →",
    },
    {
      key: "incidents-rss",
      badge: "TRESTLEBOARD CASE BRIEFS // RSS 2.0 FULL TEXT",
      title: "The Craftsman's Brief Syndication Feed",
      path: "/feeds/incidents.xml",
      fullUrl: "https://thecabcall.com/feeds/incidents.xml",
      formatLabel: "application/rss+xml (Full HTML Content)",
      cadence: "Continuous Syndication on Case Verification",
      countLabel: `${publishedBriefCount} Verified Case Briefs on The Trestleboard`,
      description:
        "Full-text RSS 2.0 feed of every verified Craftsman's Brief published to The Trestleboard—complete with Plain Facts, Partisan Heat & Spin vs. Actual Foundation diagnostics, and Socratic verification questions.",
      readers: "NetNewsWire, Feedly, Inoreader, Readwise Reader, NewsBlur",
      icon: Rss,
      browseHref: "/",
      browseLabel: "Read The Trestleboard →",
    },
    {
      key: "incidents-json",
      badge: "STRUCTURED CASE LEDGER // JSON FEED 1.1",
      title: "The Trestleboard JSON Feed",
      path: "/feeds/incidents.json",
      fullUrl: "https://thecabcall.com/feeds/incidents.json",
      formatLabel: "application/feed+json (JSON Feed 1.1)",
      cadence: "Continuous Syndication on Case Verification",
      countLabel: `${publishedBriefCount} Structured Case Records`,
      description:
        "Machine-readable JSON Feed 1.1 edition of The Trestleboard Case Ledger, tagged by Primary Working Tool, Secondary Working Tool, Shop-Floor Failure Mode, and civic sector for modern feed readers and research archives.",
      readers: "JSON Feed 1.1 Readers, Feedbin, Tapestry & Archival Scripts",
      icon: FileJson,
      browseHref: "/knowledge-graph",
      browseLabel: "Explore The Archive →",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* 1. Masthead & Philosophy Hero */}
      <div className="tracing-board-frame p-6 sm:p-10 mb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              <Compass className="w-4 h-4" />
              <span>ABOUT &amp; FEEDS // MISSION, PHILOSOPHY &amp; SYNDICATION LEDGER</span>
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

          {/* Right Colophon Summary Card */}
          <div className="lg:col-span-4 bg-[#0B0E14] border border-[#C5A059]/60 p-6 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-[#8A6D3B]/40">
              <SquareAndCompassesCrest className="w-10 h-10 shrink-0" />
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                  BROADSHEET COLOPHON
                </div>
                <div className="font-display text-base text-[#F3EFE6]">
                  The CAB Call Charter
                </div>
              </div>
            </div>

            <p className="font-serif italic text-sm text-[#C5A059] leading-relaxed">
              &ldquo;Meet on the Level. Act by the Plumb. Part upon the Square.&rdquo;
            </p>

            <div className="space-y-2.5 pt-1 text-xs font-serif text-[#94A3B8]">
              <div className="flex items-start justify-between gap-2 border-b border-[#8A6D3B]/25 pb-2">
                <span className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Editorial Posture
                </span>
                <span className="text-[#F3EFE6] text-right">
                  Blameless Structural Inspection
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-[#8A6D3B]/25 pb-2">
                <span className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Moral Architecture
                </span>
                <span className="text-[#F3EFE6] text-right">
                  The Six Working Tools
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 border-b border-[#8A6D3B]/25 pb-2">
                <span className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Systems Discipline
                </span>
                <span className="text-[#F3EFE6] text-right">
                  Site Reliability Engineering
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono uppercase text-[11px] text-[#C5A059]">
                  Published Feeds
                </span>
                <span className="text-[#F3EFE6] text-right">
                  Podcast RSS, Briefs RSS &amp; JSON
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <a
                href="#published-feeds"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors"
              >
                <Rss className="w-3.5 h-3.5" />
                <span>View All Published Feeds</span>
              </a>
              <Link
                href="/rubric"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#111726] border border-[#8A6D3B]/60 text-[#F3EFE6] font-mono text-xs uppercase tracking-wider hover:border-[#C5A059] transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Explore Working Tools &amp; Rubric</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. The Point & Philosophy of the Website (Two Pillars) */}
      <BrassSectionDivider label="THE PHILOSOPHY // OPERATIVE CRAFT MEETS SITE RELIABILITY" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Pillar I: Why Freemasonry's Working Tools? */}
        <div className="tracing-board-frame p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <span className="font-mono text-xs text-[#C5A059] uppercase">
                PILLAR I // SPECULATIVE &amp; OPERATIVE MASONRY
              </span>
              <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                The Six Working Tools as Civic Instruments
              </h2>
            </div>
            <Scale className="w-6 h-6 text-[#C5A059] shrink-0" />
          </div>

          <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/90 leading-relaxed">
            Operative stonemasons built cathedrals and civic halls that stood for centuries because they did not trust guesswork. Every stone was tried against physical instruments—the Gauge, the Gavel, the Plumb, the Square, the Level, and the Trowel—before it was trusted to bear weight.
          </p>

          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            Speculative Freemasonry preserved those six instruments as a practical philosophy for human conduct and institutional stewardship. On <strong className="text-[#F3EFE6]">The CAB Call</strong>, the Working Tools are never treated as dusty museum curiosities or esoteric trivia; they are used as active diagnostic lenses to ask whether leaders and institutions are budgeting their time honestly, stripping away reactive vices, standing upright when convenient shortcuts beckon, squaring their public promises with their actual deeds, meeting citizens on the level of shared accountability, and spreading the mortar of civic trust.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
            {WORKING_TOOLS.map((tool) => (
              <Link
                key={tool.id}
                href={`/knowledge-graph?tool=${encodeURIComponent(tool.id)}`}
                className="p-3 bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-colors flex flex-col justify-between gap-2 group"
              >
                <div className="flex items-center gap-2">
                  <WorkingToolEngraving
                    tool={tool.id}
                    className="w-6 h-6 shrink-0"
                  />
                  <span className="font-display text-xs text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                    {tool.id}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#94A3B8]">
                  {tool.moralLens}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Pillar II: Why Site Reliability Engineering? */}
        <div className="tracing-board-frame p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[#8A6D3B]/35 pb-3">
            <div>
              <span className="font-mono text-xs text-[#C5A059] uppercase">
                PILLAR II // SITE RELIABILITY ENGINEERING
              </span>
              <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                Blameless Inspection Over Partisan Scapegoating
              </h2>
            </div>
            <ShieldCheck className="w-6 h-6 text-[#C5A059] shrink-0" />
          </div>

          <p className="font-serif text-sm sm:text-base text-[#F3EFE6]/90 leading-relaxed">
            When a complex distributed system suffers an outage, seasoned Site Reliability Engineers do not ask, <em>&ldquo;Who can we fire by sundown?&rdquo;</em> They ask, <em>&ldquo;What missing guardrail, untested backup, or silent drift allowed a single mistake to cascade across the system?&rdquo;</em>
          </p>

          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            Public institutions, supply chains, courts, and municipal utilities fail along the exact same fault lines as large-scale engineering systems. By translating technical failure analysis into plain-spoken shop-floor concepts, every Craftsman&apos;s Brief diagnoses the structural root cause rather than amplifying the daily outrage cycle:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            {SRE_FAILURE_MODES.map((mode) => (
              <Link
                key={mode.id}
                href={`/knowledge-graph?failure=${encodeURIComponent(mode.id)}`}
                className="p-3 bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] transition-colors space-y-1 group"
              >
                <div className="font-display text-xs text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
                  {mode.craftShortLabel}
                </div>
                <div className="font-mono text-[10px] text-[#C5A059]">
                  {mode.id}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 3. All Currently Published Feeds (Outbound Syndication Ledger) */}
      <div id="published-feeds" className="scroll-mt-8">
        <BrassSectionDivider label="PUBLISHED SYNDICATION FEEDS // SUBSCRIBE & FOLLOW" />
      </div>

      <div className="tracing-board-frame p-6 sm:p-8 mb-12 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#8A6D3B]/40 pb-5">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              PUBLIC SYNDICATION DIRECTORY // OPEN PROTOCOLS (RSS 2.0 &amp; JSON FEED 1.1)
            </span>
            <h2 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] mt-1">
              Feeds Published by The Change Advisory Board
            </h2>
            <p className="font-serif text-sm sm:text-base text-[#94A3B8] mt-2 max-w-3xl leading-relaxed">
              The Change Advisory Board publishes all audio retrospectives and written Craftsman&apos;s Briefs over open syndication feeds with zero paywalls, zero algorithmic tracking, and full text/transcript inclusion. Copy any feed URL below into your preferred podcast player or RSS reader.
            </p>
          </div>

          <div className="font-mono text-xs text-[#C5A059] bg-[#0B0E14] border border-[#8A6D3B]/50 px-3.5 py-2 shrink-0">
            READ-ONLY PUBLIC SYNDICATION
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {outboundPublishedFeeds.map((feed) => {
            const IconComponent = feed.icon;
            const isCopied = copiedFeedKey === feed.key;

            return (
              <div
                key={feed.key}
                className="bg-[#0B0E14] border border-[#8A6D3B]/55 p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] px-2 py-0.5 bg-[#111726] border border-[#C5A059]/40">
                      {feed.badge}
                    </span>
                    <IconComponent className="w-4 h-4 text-[#C5A059] shrink-0" />
                  </div>

                  <h3 className="font-display text-xl text-[#F3EFE6]">
                    {feed.title}
                  </h3>

                  <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
                    {feed.description}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-[#8A6D3B]/30">
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-[#94A3B8]">
                      <span>Format:</span>
                      <span className="text-[#F3EFE6]">{feed.formatLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#94A3B8]">
                      <span>Volume:</span>
                      <span className="text-[#C5A059]">{feed.countLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#94A3B8]">
                      <span>Cadence:</span>
                      <span className="text-[#F3EFE6]">{feed.cadence}</span>
                    </div>
                  </div>

                  {/* Copyable Feed URL Box */}
                  <div className="flex items-center bg-[#111726] border border-[#8A6D3B]/50 p-1.5">
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

                  <div className="text-[11px] font-serif text-[#94A3B8]">
                    <strong className="text-[#F3EFE6] font-mono uppercase text-[10px]">
                      Works with:{" "}
                    </strong>
                    {feed.readers}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                    <a
                      href={feed.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#111726] border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0B0E14] transition-colors"
                    >
                      <span>Open {feed.path}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <Link
                      href={feed.browseHref}
                      className="inline-flex items-center justify-center py-2 px-3 bg-[#111726] border border-[#8A6D3B]/45 text-[#F3EFE6] hover:border-[#C5A059] transition-colors text-center"
                    >
                      {feed.browseLabel}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Inbound Monitored Publications (Read-Only Transparency Ledger) */}
        <div className="pt-6 border-t border-[#8A6D3B]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="font-mono text-xs uppercase tracking-wider text-[#C5A059]">
                SOURCED INPUT LEDGER // MONITORED PUBLICATIONS ({sourcedFeeds.length} ACTIVE SOURCES)
              </div>
              <p className="font-serif text-xs sm:text-sm text-[#94A3B8] mt-0.5">
                The Change Advisory Board polls the following publications on an automated schedule to identify candidate civic, infrastructure, and institutional events for structural inspection. Feed configuration and editorial triage are strictly governed by the Board&apos;s administrators.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {sourcedFeeds.map((feed) => (
              <div
                key={feed.name}
                className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/45 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="font-display text-base text-[#F3EFE6]">
                    {feed.name}
                  </div>
                  <p className="font-serif text-xs text-[#94A3B8] mt-1 leading-relaxed">
                    {feed.category}
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] pt-2 border-t border-[#8A6D3B]/30">
                  {feed.cadence}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. How the Application Works & Anatomy of a Craftsman's Brief */}
      <BrassSectionDivider label="HOW THIS APPLICATION WORKS // METHODOLOGY & BRIEF ANATOMY" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left: Four-Stage Structural Inspection Discipline (7 cols, strictly read-only) */}
        <div className="lg:col-span-7 tracing-board-frame p-6 sm:p-7 space-y-5">
          <div className="border-b border-[#8A6D3B]/35 pb-4">
            <span className="font-mono text-xs text-[#C5A059] uppercase">
              EDITORIAL METHODOLOGY // SOURCED TRIAGE &amp; SOCRATIC REVIEW
            </span>
            <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
              Four-Stage Structural Inspection Discipline
            </h2>
            <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
              Every dispatch on The Trestleboard passes through a four-stage automated and editorial pipeline before publication.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                I
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Concurrent Sourced Ingestion &amp; Canonical De-duplication
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Target dispatches are polled concurrently on a scheduled cadence under strict byte and timeout bounds, stripped of unsafe markup and tracking parameters, and fingerprinted via canonical URL and GUID hashing.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#C5A059]/60 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                II
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Dual-Axis Structural Triage
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Each candidate dispatch is evaluated for structural signal versus transient celebrity or horse-race commentary. High-signal events are paired with their primary Masonic Working Tool and Shop-Floor Failure Mode.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                III
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  Bounded Socratic Structural Inspection
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Verified cases are synthesized into Craftsman&apos;s Briefs that establish the plain facts, separate partisan heat and spin from the actual structural foundation, and pose open Socratic questions for fair judgment.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 flex gap-4">
              <div className="font-mono text-xs font-bold px-2.5 py-1 bg-[#111726] border border-[#C5A059] text-[#C5A059] h-fit">
                IV
              </div>
              <div>
                <h3 className="font-display text-base text-[#F3EFE6]">
                  The Friday CAB Weekly Brief ({latestEpisodeTitle})
                </h3>
                <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                  Every Friday, the week&rsquo;s anchor dispatches are distilled into a 5-minute spoken retrospective (~750 words) and syndicated via the public RSS 2.0 podcast feed (<code>/feed.xml</code>).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Anatomy of a Craftsman's Brief (5 cols, replacing the old public submission form) */}
        <div className="lg:col-span-5 tracing-board-frame p-6 sm:p-7 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="border-b border-[#8A6D3B]/35 pb-4">
              <span className="font-mono text-xs text-[#C5A059] uppercase">
                HOW TO READ THE TRESTLEBOARD // BRIEF STRUCTURE
              </span>
              <h2 className="font-display text-xl sm:text-2xl text-[#F3EFE6] mt-0.5">
                Anatomy of a Craftsman&apos;s Brief
              </h2>
              <p className="font-serif text-sm text-[#94A3B8] mt-1 leading-relaxed">
                Every case published on The Trestleboard follows a strict three-part layout designed so you can inspect the facts and test the structure in under two minutes.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="p-4 bg-[#0B0E14] border-l-2 border-l-[#C5A059] border border-[#8A6D3B]/40 space-y-1">
                <div className="font-mono text-xs text-[#C5A059] uppercase">
                  SECTION I // WHAT HAPPENED (THE PLAIN FACTS)
                </div>
                <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                  A sober, multi-sentence account of the event—what broke, which institution or infrastructure was affected, and what concrete evidence is currently on the table—stripped of sensational adjectives.
                </p>
              </div>

              <div className="p-4 bg-[#0B0E14] border-l-2 border-l-[#F59E0B] border border-[#8A6D3B]/40 space-y-1">
                <div className="font-mono text-xs text-[#F59E0B] uppercase">
                  SECTION II // PARTISAN HEAT &amp; SPIN vs. THE ACTUAL FOUNDATION
                </div>
                <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                  Side-by-side diagnostic contrast isolating the loud emotional or partisan distraction (<em>The Noise</em>) from the underlying architectural or governance weakness (<em>The Signal</em>).
                </p>
              </div>

              <div className="p-4 bg-[#0B0E14] border-l-2 border-l-[#10B981] border border-[#8A6D3B]/40 space-y-1">
                <div className="font-mono text-xs text-[#10B981] uppercase">
                  SECTION III // QUESTIONS FOR FAIR &amp; CONSISTENT JUDGMENT
                </div>
                <p className="font-serif text-sm text-[#F3EFE6]/90 leading-relaxed">
                  Two open Socratic questions anchored in the case&apos;s Working Tool and Failure Mode. Rather than telling you what conclusion to reach, the Board asks what standard should apply to everyone on the level.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-[#0B0E14] border border-[#8A6D3B]/50 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#C5A059]">
              EDITORIAL INDEPENDENCE &amp; AUDITABLE PROVENANCE
            </div>
            <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
              Public visitors cannot alter feeds, inject articles, or trigger pipeline runs. All feed curation, headline de-escalation, and episode publishing are restricted to authenticated Board administrators and recorded in an append-only SHA-256 cryptographic audit ledger.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase hover:bg-[#d6b36a] transition-colors"
              >
                <span>Inspect The Trestleboard</span>
              </Link>
              <Link
                href="/knowledge-graph"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#111726] border border-[#8A6D3B]/60 text-[#F3EFE6] font-mono text-xs uppercase hover:border-[#C5A059] transition-colors"
              >
                <span>Browse The Archive</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BrassSectionDivider label="EDITORIAL GOVERNANCE CHARTER" />

      {/* 5. Governance Charter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#C5A059] uppercase">
            CHARTER RULE 01 // ZERO DEFINITIONS
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            Never Lecture the Craft
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            Weekly rollup scripts and Craftsman&apos;s Briefs are strictly forbidden from reciting monitorial textbook definitions of the Working Tools or basic engineering acronyms. Tools are invoked as operational verbs and diagnostic instruments that the reader experiences in action.
          </p>
        </div>

        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#C5A059] uppercase">
            CHARTER RULE 02 // EPISTEMIC HUMILITY
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            The &ldquo;Pending Post-Mortem&rdquo; Rule
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            The Board never declares a partisan villain or predicts catastrophic outcomes. Ongoing stories are framed as active cases awaiting complete inspection—highlighting what evidence is still missing and what Socratic questions will prove whether the system is recovering.
          </p>
        </div>

        <div className="tracing-board-frame p-6 space-y-3">
          <div className="font-mono text-xs text-[#C5A059] uppercase">
            CHARTER RULE 03 // PROPORTIONALITY CHECK
          </div>
          <h3 className="font-display text-lg text-[#F3EFE6]">
            Separate Noise from the Foundation
          </h3>
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            Every synthesized brief must explicitly separate one sensationalized detail the news cycle is overblowing (Partisan Heat &amp; Spin) from the underlying structural or architectural constraint (The Actual Foundation).
          </p>
        </div>
      </div>
    </div>
  );
}
