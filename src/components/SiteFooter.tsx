import React from "react";
import Link from "next/link";
import { SquareAndCompassesCrest } from "./MasonicEngravings";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#8A6D3B]/50 bg-[#0B0E14] checkered-pavement pb-16 pt-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#8A6D3B]/30">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <SquareAndCompassesCrest className="w-9 h-9" />
              <div>
                <h2 className="font-display text-lg text-[#F3EFE6] tracking-wider">
                  CHANGE ADVISORY BOARD
                </h2>
                <p className="font-serif italic text-xs text-[#C5A059]">
                  The CAB Call — Site Reliability Engineering &amp; the Working Tools of Freemasonry
                </p>
              </div>
            </div>
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
                <Link href="/" className="hover:text-[#F3EFE6] transition-colors">
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
                <Link
                  href="/incidents/municipal-water-scada-patch-deferral-audit"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  Lead Brief: SCADA Segmentation Audit
                </Link>
              </li>
              <li className="pt-2 font-serif text-[#94A3B8]/85 leading-relaxed">
                Crafted in Deep Obsidian &amp; Burnished Brass with authentic 18th-century copperplate vector engravings of the Working Tools (strictly zero AI-generated art).
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <span className="font-mono">
            © {new Date().getFullYear()} Change Advisory Board (thecabcall.com). All rights reserved.
          </span>
          <span className="font-serif italic text-sm text-[#C5A059]">
            &ldquo;Tried by the Plumb, Proved by the Square, Leveled by Accountability.&rdquo;
          </span>
        </div>
      </div>
    </footer>
  );
}
