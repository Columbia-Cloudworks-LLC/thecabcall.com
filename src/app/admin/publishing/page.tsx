import React from "react";
import Link from "next/link";
import { INITIAL_EPISODES } from "@/lib/seed-data";
import { HeroCornerBrackets } from "@/components/ui/BroadsheetPrimitives";

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
        <HeroCornerBrackets size="sm" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Settings &amp; Audit • Outbound Syndication
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] tracking-wide">
              Syndication &amp; Outbound Feeds
            </h1>
            <p className="font-serif text-sm text-[#94A3B8] max-w-2xl">
              All three public distribution channels are active, serving{" "}
              {INITIAL_EPISODES.length} published podcast episodes and
              Craftsman&apos;s Briefs to podcast directories and RSS subscribers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/admin/episodes"
              className="text-xs font-display uppercase tracking-wider text-[#94A3B8] hover:text-[#C5A059] transition-colors"
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
          <a
            key={feed.path}
            href={feed.path}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative bg-[#111726] border border-[#8A6D3B]/45 hover:border-[#C5A059] p-5 flex flex-col justify-between gap-4 transition-all duration-200 ease-out"
          >
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] font-semibold">
                {feed.format}
              </div>
              <h2 className="font-display text-base text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors tracking-wide">
                {feed.title}
              </h2>
              <p className="font-serif text-xs text-[#94A3B8] leading-relaxed">
                {feed.description}
              </p>
            </div>

            <div className="pt-3 border-t border-[#8A6D3B]/30 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-[#94A3B8] truncate">
                {feed.url}
              </span>
              <span className="text-xs font-display uppercase tracking-wider text-[#C5A059] group-hover:text-[#F3EFE6] transition-colors shrink-0">
                Inspect Feed ↗
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
