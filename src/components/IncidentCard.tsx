"use client";

import React from "react";
import Link from "next/link";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicIncidentDto,
} from "@/lib/dto";
import { IncidentArticle } from "@/lib/types";
import { SreFailureModeId } from "@/lib/taxonomy";
import { useTelemetry } from "./TelemetryContext";

const SHORT_FAILURE_LABELS: Record<SreFailureModeId, string> = {
  "Configuration Drift": "Configuration Drift",
  "Cascading Failure": "Cascading Failure",
  "Alert Fatigue & Signal Loss": "Alert Fatigue",
  "Single Point of Failure (SPOF) / Untested Failover": "Untested Failover",
  "Blame Culture vs. Root-Cause Isolation": "Blame Culture",
  "Technical & Institutional Debt": "Institutional Debt",
  "Structural Friction": "Structural Friction",
};

function formatBroadsheetDateline(isoDate: string): string {
  const date = new Date(isoDate);
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const month = months[date.getUTCMonth()] || "OCT";
  const day = date.getUTCDate();
  return `${month} ${day}`;
}

export function IncidentCard({
  incident: rawIncident,
}: {
  incident: PublicIncidentDto | IncidentArticle;
}) {
  const { openRubricInspector } = useTelemetry();

  const incident = mapDtoToCraftLexicon(rawIncident);

  // Defensive rendering gate: suppress rendering if editorial copy or attribution is incomplete
  if (!isRenderablePublicIncident(incident)) {
    return null;
  }

  const datelinePrefix = formatBroadsheetDateline(incident.publishedAt);
  const shortFailureLabel =
    SHORT_FAILURE_LABELS[incident.sreFailureMode] || "Structural Friction";

  return (
    <article className="group relative bg-[#111726]/90 border border-[#8A6D3B]/45 p-6 sm:p-7 transition-all duration-300 hover:border-[#C5A059]/80 hover:shadow-[0_12px_36px_rgba(0,0,0,0.65)] flex flex-col justify-between">
      {/* Subtle Inset Hairline Rule */}
      <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/20 group-hover:border-[#C5A059]/35 transition-colors" />

      {/* Burnished Brass Corner Brackets */}
      <span className="pointer-events-none absolute top-1 left-1 w-2.5 h-2.5 border-t border-l border-[#C5A059]/60 group-hover:border-[#C5A059] transition-colors" />
      <span className="pointer-events-none absolute top-1 right-1 w-2.5 h-2.5 border-t border-r border-[#C5A059]/60 group-hover:border-[#C5A059] transition-colors" />
      <span className="pointer-events-none absolute bottom-1 left-1 w-2.5 h-2.5 border-b border-l border-[#C5A059]/60 group-hover:border-[#C5A059] transition-colors" />
      <span className="pointer-events-none absolute bottom-1 right-1 w-2.5 h-2.5 border-b border-r border-[#C5A059]/60 group-hover:border-[#C5A059] transition-colors" />

      <div className="relative z-10">
        {/* Metadata Header: Strictly {Date} • {Source} */}
        <div className="pb-3 mb-3.5 border-b border-[#8A6D3B]/35 font-mono text-[11px] uppercase tracking-[0.14em] text-[#94A3B8]">
          <span className="text-[#C5A059]">{datelinePrefix}</span>
          <span className="mx-2 text-[#8A6D3B]">•</span>
          <span className="text-[#F3EFE6]/90">{incident.sourceFeed}</span>
        </div>

        {/* Crisp Serif Headline */}
        <Link
          href={`/incidents/${incident.slug}`}
          className="block group/title"
        >
          <h3 className="font-display text-lg sm:text-[21px] text-[#F3EFE6] group-hover/title:text-[#C5A059] transition-colors leading-snug">
            {incident.title}
          </h3>
        </Link>

        {/* 2-Sentence Plain-English Factual Summary */}
        <p className="font-serif text-[15px] text-[#F3EFE6]/85 mt-3.5 leading-relaxed">
          {incident.executiveSummary}
        </p>
      </div>

      {/* Footer Row: Strictly Aligned at the Bottom of Every Card */}
      <div className="relative z-10 mt-6 pt-4 border-t border-[#8A6D3B]/35 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-serif">
          <button
            type="button"
            onClick={() => openRubricInspector({ tool: incident.primaryTool })}
            className="px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059]/15 transition-colors cursor-pointer"
            title={`Examine ${incident.primaryTool} in The Rubric`}
          >
            [{incident.primaryTool}]
          </button>
          <span className="text-[#8A6D3B] font-bold">·</span>
          <button
            type="button"
            onClick={() =>
              openRubricInspector({ failureMode: incident.sreFailureMode })
            }
            className="px-2.5 py-1 bg-[#0B0E14] border border-[#8A6D3B]/55 text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/60 transition-colors cursor-pointer"
            title={`Examine ${shortFailureLabel} in The Rubric`}
          >
            [{shortFailureLabel}]
          </button>
        </div>

        <Link
          href={`/incidents/${incident.slug}`}
          className="font-serif text-sm text-[#C5A059] hover:text-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
        >
          Read Brief →
        </Link>
      </div>
    </article>
  );
}
