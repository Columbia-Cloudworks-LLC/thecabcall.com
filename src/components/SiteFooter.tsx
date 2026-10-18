import React from "react";
import Link from "next/link";
import { SquareAndCompassesCrest } from "./MasonicEngravings";

const COLUMBIA_CLOUDWORKS_URL = "https://columbiacloudworks.com";
const PUBLIC_SITE_ORIGIN = "https://thecabcall.com";

export function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#8A6D3B]/50 bg-[#0B0E14] checkered-pavement pb-20 pt-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#8A6D3B]/30">
          <div className="md:col-span-2 space-y-3">
            <Link
              href={PUBLIC_SITE_ORIGIN}
              className="inline-flex items-center gap-3 group"
            >
              <SquareAndCompassesCrest className="w-9 h-9 shrink-0 transition-transform duration-300 group-hover:scale-105" />
              <div>
                <h2 className="font-display text-lg text-[#F3EFE6] group-hover:text-[#C5A059] tracking-wider transition-colors">
                  CHANGE ADVISORY BOARD
                </h2>
                <p className="font-serif italic text-xs text-[#C5A059]">
                  The CAB Call — Site Reliability Engineering &amp; the Working Tools of Freemasonry
                </p>
              </div>
            </Link>
            <p className="font-serif text-sm text-[#94A3B8] max-w-xl leading-relaxed">
              An editorial broadsheet examining public infrastructure, institutional governance, and technical post-mortems through the diagnostic discipline of Site Reliability Engineering and the Six Working Tools of Operative and Speculative Masonry. Every brief separates sourced facts from public panic to pose Socratic inquiries rather than partisan conclusions.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xs uppercase tracking-widest text-[#C5A059] mb-3">
              Broadsheet Sections
            </h3>
            <ul className="space-y-2 text-sm text-[#94A3B8] font-serif">
              <li>
                <Link
                  href={PUBLIC_SITE_ORIGIN}
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  The Trestleboard (Home)
                </Link>
              </li>
              <li>
                <Link
                  href="/knowledge-graph"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  The Archive &amp; Knowledge Graph
                </Link>
              </li>
              <li>
                <Link
                  href="/archive"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  The CAB Call Podcast
                </Link>
              </li>
              <li>
                <Link
                  href="/rubric"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  The Working Tools &amp; Rubric
                </Link>
              </li>
              <li>
                <Link
                  href="/status"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  About &amp; Feeds
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xs uppercase tracking-widest text-[#C5A059] mb-3">
              Colophon &amp; Feeds
            </h3>
            <ul className="space-y-2 text-xs text-[#94A3B8]">
              <li className="font-mono">
                <a
                  href="/feed.xml"
                  className="text-[#C5A059] hover:underline"
                >
                  Podcast RSS Feed (/feed.xml)
                </a>
              </li>
              <li className="font-mono">
                <a
                  href="/feeds/incidents.xml"
                  className="text-[#C5A059] hover:underline"
                >
                  Case Briefs RSS (/feeds/incidents.xml)
                </a>
              </li>
              <li className="font-mono">
                <a
                  href="/feeds/incidents.json"
                  className="text-[#C5A059] hover:underline"
                >
                  Case Ledger JSON (/feeds/incidents.json)
                </a>
              </li>
              <li className="pt-2 font-serif text-[#94A3B8]/85 leading-relaxed">
                Crafted in Deep Obsidian &amp; Burnished Brass with 18th-century copperplate vector engravings of the Working Tools. Audio synthesis, conversational voices, and episode artwork across The CAB Call Podcast are generated with AI assistance (Google NotebookLM &amp; Google Gemini) from human-curated Trestleboard dispatches and research dossiers.
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <div className="inline-flex flex-wrap items-center justify-center lg:justify-start font-mono">
            <span className="mr-1.5">© {currentYear}</span>
            <a
              href={COLUMBIA_CLOUDWORKS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[#F3EFE6] hover:text-[#C5A059] transition-colors font-semibold underline-offset-4 hover:underline"
            >
              <img
                src="/images/brand/icons/Columbia-Cloudworks-Icon-Small.png"
                alt="Columbia Cloudworks LLC"
                width={18}
                height={18}
                className="w-4.5 h-4.5 shrink-0 rounded-sm opacity-95 ring-1 ring-white/10"
              />
              <span>Columbia Cloudworks LLC</span>
            </a>
            <span>. All rights reserved.</span>
          </div>
          <span className="font-serif italic text-sm text-[#C5A059]">
            &ldquo;Meet on the Level. Act by the Plumb. Part upon the Square.&rdquo;
          </span>
        </div>
      </div>
    </footer>
  );
}
