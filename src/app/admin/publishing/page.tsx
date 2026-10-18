import React from "react";
import Link from "next/link";
import { INITIAL_EPISODES } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Syndication & Outbound Feeds — The Editor's Study | The CAB Call",
  description:
    "Public RSS, Apple/Spotify Podcast XML, and JSON syndication channels for The CAB Call.",
};

const SYNDICATION_FEEDS = [
  {
    title: "Podcast RSS 2.0 Feed (iTunes & Spotify)",
    path: "/podcast.xml",
    url: "https://thecabcall.com/podcast.xml",
    format: "RSS 2.0 + iTunes XML",
    description:
      "Primary audio syndication feed with R2 MP3 enclosures, episode durations, and structured show notes.",
  },
  {
    title: "Editorial Case Briefs Feed",
    path: "/feed.xml",
    url: "https://thecabcall.com/feed.xml",
    format: "RSS 2.0 XML",
    description:
      "Public broadsheet feed of published Craftsman's Briefs and weekly rollups for RSS readers.",
  },
  {
    title: "Structured Episodes JSON API",
    path: "/api/episodes",
    url: "https://thecabcall.com/api/episodes",
    format: "JSON API",
    description:
      "Programmatic JSON feed of all published episodes, transcripts, and audio metadata.",
  },
];

export default function AdminPublishingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 p-6 shadow-xl">
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-[#C5A059]/70" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-[#C5A059]/70" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b border-l border-[#C5A059]/70" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b border-r border-[#C5A059]/70" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Settings &amp; Audit • Outbound Syndication
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
              Syndication &amp; Outbound Feeds
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl">
              Public distribution channels serving weekly podcast episodes and
              Craftsman&apos;s Briefs to podcast directories and RSS subscribers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/episodes"
              className="px-3.5 py-2 bg-[#0B0E14] border border-[#8A6D3B]/50 hover:border-[#C5A059] text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Open Podcast Studio →
            </Link>
            <a
              href="https://thecabcall.com/feeds"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-[#C5A059]/15 border border-[#C5A059] hover:bg-[#C5A059]/25 text-xs font-display uppercase tracking-wider text-[#F3EFE6] transition-all duration-200 ease-out"
            >
              Public Syndication Directory ↗
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {SYNDICATION_FEEDS.map((feed) => (
          <div
            key={feed.path}
            className="relative bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059]/80 p-5 flex flex-col justify-between gap-4 transition-all duration-200 ease-out"
          >
            <span className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l border-[#C5A059]/60" />
            <span className="pointer-events-none absolute top-1 right-1 w-2 h-2 border-t border-r border-[#C5A059]/60" />
            <span className="pointer-events-none absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#C5A059]/60" />
            <span className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#C5A059]/60" />

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/45 font-mono text-[10px] uppercase tracking-wider text-[#C5A059]">
                  {feed.format}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-sans text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>
              <h2 className="font-display text-base text-[#F3EFE6] tracking-wide">
                {feed.title}
              </h2>
              <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
                {feed.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[#8A6D3B]/30 space-y-2.5">
              <div className="font-mono text-[11px] text-[#C5A059] truncate bg-[#0B0E14] px-2.5 py-1.5 border border-[#8A6D3B]/30">
                {feed.url}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-sans text-[#94A3B8]">
                  {INITIAL_EPISODES.length} published episodes
                </span>
                <a
                  href={feed.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-display uppercase tracking-wider text-[#C5A059] hover:text-[#F3EFE6] transition-colors"
                >
                  Inspect Feed ↗
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
