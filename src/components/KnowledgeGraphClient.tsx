"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  RotateCcw,
  ArrowUpRight,
  Info,
} from "lucide-react";
import {
  DOMAIN_SECTORS,
  getSreFailureModeSpec,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SRE_FAILURE_MODES,
  WORKING_TOOLS,
} from "@/lib/taxonomy";
import {
  formatCraftLedgerEntry,
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicIncidentDto,
} from "@/lib/dto";
import { IncidentArticle } from "@/lib/types";
import { IncidentCard } from "./IncidentCard";
import { BrassSectionDivider } from "./MasonicEngravings";
import { useTelemetry } from "./TelemetryContext";

export function KnowledgeGraphClient({
  incidents,
}: {
  incidents: Array<PublicIncidentDto | IncidentArticle>;
}) {
  const searchParams = useSearchParams();
  const { openRubricInspector } = useTelemetry();

  const rawToolParam = searchParams.get("tool");
  const rawFailureParam = searchParams.get("failure");

  const [selectedTool, setSelectedTool] = useState<string>(
    rawToolParam && rawToolParam !== "ALL"
      ? mapWorkingToolToCraftLexicon(rawToolParam)
      : "ALL"
  );
  const [selectedFailure, setSelectedFailure] = useState<string>(
    rawFailureParam && rawFailureParam !== "ALL"
      ? mapFailureModeToCraftLexicon(rawFailureParam)
      : "ALL"
  );
  const [selectedSector, setSelectedSector] = useState<string>(
    searchParams.get("sector") || "ALL"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");

  const validIncidents = incidents
    .map((inc) => mapDtoToCraftLexicon(inc))
    .filter((inc) => isRenderablePublicIncident(inc));

  const filtered = validIncidents.filter((inc) => {
    if (selectedTool !== "ALL" && inc.primaryTool !== selectedTool) return false;
    if (selectedFailure !== "ALL" && inc.sreFailureMode !== selectedFailure)
      return false;
    if (selectedSector !== "ALL" && inc.domainSector !== selectedSector)
      return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        inc.title.toLowerCase().includes(q) ||
        inc.incidentCode.toLowerCase().includes(q) ||
        formatCraftLedgerEntry(inc.incidentCode).toLowerCase().includes(q) ||
        inc.executiveSummary.toLowerCase().includes(q) ||
        inc.sourceFeed.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Compute 6x6 Matrix counts (X = Working Tools, Y = SRE Failure Modes)
  const getCellCount = (toolId: string, failureId: string) =>
    validIncidents.filter(
      (i) => i.primaryTool === toolId && i.sreFailureMode === failureId
    ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="tracing-board-frame p-6 sm:p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              THE KNOWLEDGE GRAPH // DUAL-AXIS TAXONOMY EXPLORER
            </span>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] mt-1">
              Moral Working Tools × Structural Failure Modes Matrix
            </h1>
            <p className="font-serif text-sm sm:text-base text-[#94A3B8] mt-1 max-w-3xl">
              Cross-reference historical and active cases on the Trestleboard across Axis 1 (The Six Working Tools of Freemasonry), Axis 2 (Structural Failure Modes), and Axis 3 (Domain Sectors).
            </p>
          </div>

          {/* View Mode Toggle (High-Density Table vs. Cards) */}
          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 border cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                  : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>High-Density Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 border cursor-pointer ${
                viewMode === "cards"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                  : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Case Cards</span>
            </button>
          </div>
        </div>

        {/* Interactive 6x6 Cross-Reference Matrix */}
        <div className="mt-6 pt-6 border-t border-[#8A6D3B]/35 overflow-x-auto">
          <div className="flex items-center justify-between mb-3 font-mono text-xs">
            <span className="text-[#C5A059] uppercase tracking-wider">
              Interactive 6×6 Diagnostic Signature Matrix (Click any cell or axis header to filter)
            </span>
            {(selectedTool !== "ALL" ||
              selectedFailure !== "ALL" ||
              selectedSector !== "ALL" ||
              searchQuery !== "") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTool("ALL");
                  setSelectedFailure("ALL");
                  setSelectedSector("ALL");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-1 text-[#C5A059] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Active Matrix Filter</span>
              </button>
            )}
          </div>

          <table className="w-full border-collapse font-mono text-xs min-w-[720px]">
            <thead>
              <tr>
                <th className="p-2.5 bg-[#0B0E14] border border-[#8A6D3B]/40 text-left text-[10px] uppercase text-[#94A3B8]">
                  Y: Failure Mode \ X: Working Tool
                </th>
                {WORKING_TOOLS.map((tool) => {
                  const isToolSelected = selectedTool === tool.id;
                  return (
                    <th
                      key={tool.id}
                      className={`p-2.5 border border-[#8A6D3B]/40 text-center cursor-pointer transition-colors ${
                        isToolSelected
                          ? "bg-[#C5A059] text-[#0B0E14] font-bold"
                          : "bg-[#0B0E14] text-[#C5A059] hover:bg-[#C5A059]/15"
                      }`}
                      onClick={() =>
                        setSelectedTool(isToolSelected ? "ALL" : tool.id)
                      }
                    >
                      <div>{tool.numeral}</div>
                      <div className="text-[11px]">{tool.shortName}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {SRE_FAILURE_MODES.map((failure) => {
                const isFailureSelected = selectedFailure === failure.id;
                return (
                  <tr key={failure.id}>
                    <td
                      onClick={() =>
                        setSelectedFailure(
                          isFailureSelected ? "ALL" : failure.id
                        )
                      }
                      title={failure.summary}
                      className={`p-2.5 border border-[#8A6D3B]/40 cursor-pointer transition-colors ${
                        isFailureSelected
                          ? "bg-[#F59E0B]/25 text-[#F3EFE6] font-bold"
                          : "bg-[#0B0E14] text-[#F3EFE6] hover:bg-[#111726]"
                      }`}
                    >
                      <div>{failure.craftShortLabel}</div>
                      <div className="text-[10px] text-[#94A3B8] font-normal">
                        {failure.id}
                      </div>
                    </td>
                    {WORKING_TOOLS.map((tool) => {
                      const count = getCellCount(tool.id, failure.id);
                      const isCellSelected =
                        selectedTool === tool.id &&
                        selectedFailure === failure.id;
                      return (
                        <td
                          key={`${tool.id}-${failure.id}`}
                          onClick={() => {
                            if (isCellSelected) {
                              setSelectedTool("ALL");
                              setSelectedFailure("ALL");
                            } else {
                              setSelectedTool(tool.id);
                              setSelectedFailure(failure.id);
                            }
                          }}
                          className={`p-2.5 border border-[#8A6D3B]/40 text-center cursor-pointer transition-all ${
                            isCellSelected
                              ? "bg-[#C5A059] text-[#0B0E14] font-bold"
                              : count > 0
                              ? "bg-[#C5A059]/15 text-[#F3EFE6] hover:bg-[#C5A059]/30"
                              : "bg-[#0B0E14]/50 text-[#94A3B8]/40 hover:bg-[#111726]"
                          }`}
                        >
                          {count > 0 ? `${count} CASES` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Search & Domain Sector Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-5 border-t border-[#8A6D3B]/35">
          {/* Search Input */}
          <div className="flex items-center gap-2 bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2">
            <Search className="w-4 h-4 text-[#C5A059] shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ledger entry, headline, source..."
              className="bg-transparent font-mono text-xs text-[#F3EFE6] placeholder-[#94A3B8]/60 focus:outline-none w-full"
            />
          </div>

          {/* Domain Sector Filter */}
          <div className="flex items-center gap-2 bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2 font-mono text-xs">
            <span className="text-[#94A3B8] shrink-0">Axis 3 Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-transparent text-[#F3EFE6] focus:outline-none w-full"
            >
              <option value="ALL" className="bg-[#0B0E14]">
                All Sectors
              </option>
              {DOMAIN_SECTORS.map((s) => (
                <option key={s} value={s} className="bg-[#0B0E14]">
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <BrassSectionDivider
        label={`MATCHING CASES ON THE TRESTLEBOARD (${filtered.length} OF ${validIncidents.length})`}
      />

      {/* Results Display: High-Density Table vs. Card Grid */}
      {filtered.length === 0 ? (
        <div className="tracing-board-frame p-10 text-center space-y-3">
          <p className="font-display text-xl text-[#F3EFE6]">
            No Historical Records Match This Matrix Coordinate
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedTool("ALL");
              setSelectedFailure("ALL");
              setSelectedSector("ALL");
              setSearchQuery("");
            }}
            className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase cursor-pointer"
          >
            Reset Matrix Coordinates
          </button>
        </div>
      ) : viewMode === "table" ? (
        <div className="tracing-board-frame overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[880px]">
            <thead>
              <tr className="border-b border-[#8A6D3B]/50 bg-[#0B0E14] font-mono text-[11px] uppercase text-[#C5A059]">
                <th className="p-3.5">Case Ledger</th>
                <th className="p-3.5">Source / Date</th>
                <th className="p-3.5">Event Headline</th>
                <th className="p-3.5">Primary Working Tool</th>
                <th className="p-3.5">Secondary Tool</th>
                <th className="p-3.5">Structural Failure Mode</th>
                <th className="p-3.5 text-right">STRUCTURAL INSPECTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8A6D3B]/30 font-mono text-xs">
              {filtered.map((inc) => (
                <tr
                  key={inc.id}
                  className="hover:bg-[#0B0E14]/70 transition-colors"
                >
                  <td className="p-3.5 text-[#94A3B8] text-[11px] whitespace-nowrap">
                    {formatCraftLedgerEntry(inc.incidentCode)}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="text-[#F3EFE6]">{inc.sourceFeed}</div>
                    <div className="text-[10px] text-[#94A3B8]">
                      {inc.publishedAt.slice(0, 10)}
                    </div>
                  </td>
                  <td className="p-3.5 max-w-md">
                    <Link
                      href={`/incidents/${inc.slug}`}
                      className="font-serif text-sm text-[#F3EFE6] hover:text-[#C5A059] transition-colors line-clamp-2"
                    >
                      {inc.title}
                    </Link>
                    <span className="text-[10px] text-[#94A3B8] block mt-0.5">
                      Sector: {inc.domainSector}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({ tool: inc.primaryTool })
                      }
                      title={`View Tool Guide for ${inc.primaryTool}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0B0E14] border border-[#C5A059]/70 text-[#C5A059] hover:bg-[#C5A059]/15 cursor-pointer"
                    >
                      <span>{inc.primaryTool}</span>
                      <Info className="w-3 h-3 opacity-80" />
                    </button>
                  </td>
                  <td className="p-3.5 whitespace-nowrap text-[#94A3B8]">
                    {inc.secondaryTool}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        openRubricInspector({
                          failureMode: inc.sreFailureMode,
                        })
                      }
                      title={getSreFailureModeSpec(inc.sreFailureMode).summary}
                      className="px-2 py-1 bg-[#0B0E14] border border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/15 cursor-pointer text-left"
                    >
                      {getSreFailureModeSpec(inc.sreFailureMode).craftTitle}
                    </button>
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <Link
                      href={`/incidents/${inc.slug}`}
                      className="inline-flex items-center gap-1 text-[#C5A059] hover:text-[#F3EFE6]"
                    >
                      <span>Open</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}
    </div>
  );
}
