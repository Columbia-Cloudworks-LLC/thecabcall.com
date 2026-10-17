"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rss, Activity } from "lucide-react";
import { SquareAndCompassesCrest } from "./MasonicEngravings";

const NAV_ITEMS = [
  { href: "/", label: "The Trestleboard", sub: "Live Telemetry" },
  { href: "/knowledge-graph", label: "Knowledge Graph", sub: "Dual-Axis Matrix" },
  { href: "/archive", label: "CAB Call Archive", sub: "5-Min Briefs & Legacy" },
  { href: "/rubric", label: "The Rubric", sub: "Working Tools & SRE" },
  { href: "/status", label: "System Status", sub: "Pipeline & Charter" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="relative border-b border-[#8A6D3B]/45 bg-[#0B0E14] checkered-pavement">
      {/* Top SRE Telemetry Strip */}
      <div className="border-b border-[#8A6D3B]/25 bg-[#0B0E14]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-[#94A3B8]">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[#10B981]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              PIPELINE: NOMINAL
            </span>
            <span className="hidden sm:inline text-[#8A6D3B]">|</span>
            <span className="hidden sm:inline">
              SYSTEM-1 GATE: <strong className="text-[#F3EFE6]">JEV NLI (≥0.75)</strong>
            </span>
            <span className="hidden md:inline text-[#8A6D3B]">|</span>
            <span className="hidden md:inline">
              SYSTEM-2: <strong className="text-[#F3EFE6]">BOUNDED SOCRATIC SYNTHESIS</strong>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/status"
              className="inline-flex items-center gap-1 text-[#C5A059] hover:underline"
            >
              <Activity className="w-3 h-3" />
              <span>Run Live Ingestion Pass</span>
            </Link>
            <a
              href="/feed.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#F3EFE6] hover:text-[#C5A059] transition-colors"
              title="Podcast RSS 2.0 XML Feed"
            >
              <Rss className="w-3 h-3 text-[#C5A059]" />
              <span>/feed.xml</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Masthead */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <Link href="/" className="flex items-center gap-4 group">
          <SquareAndCompassesCrest className="w-14 h-14 shrink-0 transition-transform duration-300 group-hover:scale-105" />
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#C5A059]">
                THECABCALL.COM // EST. OBSERVABILITY LODGE
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl tracking-wide text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
              CHANGE ADVISORY BOARD
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] font-serif italic">
              Post-Incident Reviews for Current Events via Site Reliability Engineering &amp; the Working Tools of Freemasonry
            </p>
          </div>
        </Link>

        {/* Navigation Bar */}
        <nav
          aria-label="Primary Navigation"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 border transition-all ${
                  isActive
                    ? "bg-[#111726] border-[#C5A059] text-[#F3EFE6] shadow-[inset_0_0_0_1px_rgba(197,160,89,0.35)]"
                    : "bg-[#0B0E14]/80 border-[#8A6D3B]/35 text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/60"
                }`}
              >
                <div className="font-display text-xs sm:text-sm tracking-wider uppercase">
                  {item.label}
                </div>
                <div className="font-mono text-[9px] text-[#C5A059]/80 uppercase tracking-widest hidden sm:block">
                  {item.sub}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
