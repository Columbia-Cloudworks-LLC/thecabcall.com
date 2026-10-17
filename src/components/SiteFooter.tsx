import React from "react";
import Link from "next/link";
import { SquareAndCompassesCrest } from "./MasonicEngravings";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#8A6D3B]/45 bg-[#0B0E14] checkered-pavement pb-28 pt-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#8A6D3B]/30">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <SquareAndCompassesCrest className="w-9 h-9" />
              <div>
                <h2 className="font-display text-lg text-[#F3EFE6] tracking-wider">
                  CHANGE ADVISORY BOARD (THE CAB CALL)
                </h2>
                <p className="font-mono text-[10px] text-[#C5A059] uppercase tracking-widest">
                  SYSTEM 1 TRIAGE + SYSTEM 2 SOCRATIC SYNTHESIS
                </p>
              </div>
            </div>
            <p className="text-sm text-[#94A3B8] max-w-xl leading-relaxed">
              An automated observability platform treating current events as active system incidents. Every article is triaged by a zero-shot classifier against the Six Working Tools of Freemasonry and Site Reliability Engineering failure modes—presenting sourced facts and Socratic questions rather than partisan conclusions.
            </p>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#C5A059] mb-3">
              Architecture &amp; Pages
            </h3>
            <ul className="space-y-2 text-sm text-[#94A3B8]">
              <li>
                <Link href="/" className="hover:text-[#F3EFE6] transition-colors">
                  1. The Trestleboard (Live Dashboard)
                </Link>
              </li>
              <li>
                <Link
                  href="/incidents/municipal-water-scada-patch-deferral-audit"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  2. Incident Brief (PIR Deep-Dive)
                </Link>
              </li>
              <li>
                <Link
                  href="/knowledge-graph"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  3. The Knowledge Graph (Matrix)
                </Link>
              </li>
              <li>
                <Link
                  href="/archive"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  4. The CAB Call Archive (Podcast)
                </Link>
              </li>
              <li>
                <Link
                  href="/rubric"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  5. The Rubric &amp; Working Tools
                </Link>
              </li>
              <li>
                <Link
                  href="/status"
                  className="hover:text-[#F3EFE6] transition-colors"
                >
                  6. System Status &amp; Pipeline Colophon
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-[#C5A059] mb-3">
              Feeds &amp; Governance
            </h3>
            <ul className="space-y-2 text-xs font-mono text-[#94A3B8]">
              <li>
                <a
                  href="/feed.xml"
                  className="text-[#C5A059] hover:underline"
                >
                  RSS 2.0 Podcast Feed (/feed.xml)
                </a>
              </li>
              <li>
                <a
                  href="/api/telemetry"
                  className="hover:text-[#F3EFE6]"
                >
                  JSON Telemetry API (/api/telemetry)
                </a>
              </li>
              <li className="pt-2 text-[#94A3B8]/80">
                Zero AI-Generated Imagery Policy: All visual geometry is rendered via deterministic SVG copperplate vectors.
              </li>
              <li className="text-[#10B981]">
                Epistemic Humility Charter Active
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#94A3B8]">
          <span>
            © {new Date().getFullYear()} Change Advisory Board (thecabcall.com). All rights reserved.
          </span>
          <span className="text-[#C5A059]">
            &ldquo;Tried by the Plumb, Proved by the Square, Leveled by Accountability.&rdquo;
          </span>
        </div>
      </div>
    </footer>
  );
}
