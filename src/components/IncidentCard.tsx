"use client";

import React from "react";
import Link from "next/link";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicIncidentDto,
} from "@/lib/dto";
import { IncidentArticle } from "@/lib/types";
import { formatFailureModeDisplayLabel } from "@/lib/taxonomy";
import { SourceOutletBadge } from "./SourceOutletBadge";
import { useTelemetry } from "./TelemetryContext";

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
  const shortFailureLabel = formatFailureModeDisplayLabel(
    incident.sreFailureMode
  );
  const effectiveImageUrl =
    incident.imageUrl && incident.imageUrl.trim().length > 0
      ? incident.imageUrl.trim()
      : `/media/card-${incident.id}.svg`;
  const isWikimediaArchival =
    incident.imageSourceType === "wikimedia_commons";

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
        {/* Metadata Header: Dateline on left, optional PINNED badge on right */}
        <div className="pb-3 mb-3.5 border-b border-[#8A6D3B]/35 font-mono text-[11px] uppercase tracking-[0.14em] text-[#94A3B8] flex items-center justify-between gap-2">
          <div>
            <span className="text-[#C5A059]">{datelinePrefix}</span>
          </div>
          {incident.isPinned && (
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 bg-[#C5A059]/15 border border-[#C5A059]/60 text-[#C5A059] text-[9px] tracking-widest">
                PINNED
              </span>
            </div>
          )}
        </div>

        {/* Hero Visual Banner Container with Interactive Source Outlet Drawer Overlay */}
        <div className="relative mb-4 overflow-hidden border border-[#8A6D3B]/40 bg-[#0B0E14] h-48">
          <SourceOutletBadge
            sourceFeed={incident.sourceFeed}
            sourceUrl={incident.sourceUrl}
          />
          <Link
            href={`/incidents/${incident.slug}`}
            className="block w-full h-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveImageUrl}
              alt={incident.imageAlt || incident.title}
              loading="lazy"
              className={`w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity ${
                isWikimediaArchival
                  ? "grayscale-[35%] contrast-[1.08] brightness-95"
                  : ""
              }`}
            />
          </Link>
          {isWikimediaArchival && (
            <span
              className="absolute bottom-2 right-2 z-20 px-1.5 py-0.5 bg-[#0B0E14]/80 border border-[#8A6D3B]/40 font-mono text-[9px] uppercase tracking-wider text-[#94A3B8]"
              title={incident.imageCaption || "Archival reference via Wikimedia Commons"}
            >
              Archival Photo
            </span>
          )}
        </div>

        {/* Crisp Mixed-Case Broadsheet Serif Headline */}
        <Link
          href={`/incidents/${incident.slug}`}
          className="block group/title"
        >
          <h3 className="font-serif font-semibold text-xl sm:text-[22px] text-[#F3EFE6] group-hover/title:text-[#C5A059] transition-colors leading-snug tracking-[-0.01em] normal-case">
            {incident.title}
          </h3>
        </Link>

        {incident.titleRewritten && incident.originalTitle && (
          <div
            className="mt-2 px-2.5 py-1.5 bg-[#0B0E14]/80 border-l-2 border-[#10B981]/60 font-mono text-[10px] text-[#94A3B8]"
            title={
              incident.titleRewriteReason
                ? `Rationale: ${incident.titleRewriteReason}`
                : undefined
            }
          >
            <span className="text-[#10B981] uppercase tracking-wider">
              Title Neutralized · View Original in Audit Log:
            </span>{" "}
            <span className="italic text-[#F3EFE6]/75">
              &ldquo;{incident.originalTitle}&rdquo;
            </span>
          </div>
        )}

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
            className="px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059]/15 hover:border-[#C5A059] transition-colors cursor-pointer"
            title={`Examine ${incident.primaryTool} in The Rubric`}
          >
            {incident.primaryTool}
          </button>
          <span className="text-[#8A6D3B] font-bold">·</span>
          <button
            type="button"
            onClick={() =>
              openRubricInspector({ failureMode: incident.sreFailureMode })
            }
            className="px-2.5 py-1 bg-[#0B0E14] border border-[#8A6D3B]/55 text-[#94A3B8] hover:text-[#F3EFE6] hover:bg-[#C5A059]/10 hover:border-[#C5A059]/60 transition-colors cursor-pointer"
            title={`Examine ${shortFailureLabel} in The Rubric`}
          >
            {shortFailureLabel}
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
