"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  RotateCcw,
  ArrowUpRight,
  Info,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import {
  DOMAIN_SECTOR_SPECS,
  DOMAIN_SECTORS,
  DomainSectorId,
  formatCompactCaseId,
  formatFriendlyDate,
  formatFriendlySourceName,
  getDomainSectorBySlug,
  getFailureModeBySlug,
  getFailureModeHref,
  getSreFailureModeSpec,
  getWorkingToolBySlug,
  getWorkingToolHref,
  getWorkingToolSpec,
  SRE_FAILURE_MODES,
  SreFailureModeId,
  WORKING_TOOLS,
  WorkingToolId,
} from "@/lib/taxonomy";
import {
  isRenderablePublicIncident,
  mapDtoToCraftLexicon,
  PublicIncidentDto,
} from "@/lib/dto";
import {
  ArchivePaginationResult,
  DEFAULT_ARCHIVE_PAGE_SIZE,
  paginateAndAggregateIncidentCorpus,
} from "@/lib/archive-pagination";
import { IncidentArticle } from "@/lib/types";
import { IncidentCard } from "./IncidentCard";
import { BrassSectionDivider } from "./MasonicEngravings";
import { useTelemetry } from "./TelemetryContext";

export interface KnowledgeGraphClientProps {
  incidents: Array<PublicIncidentDto | IncidentArticle>;
  initialArchivePage?: ArchivePaginationResult;
}

export function KnowledgeGraphClient({
  incidents,
  initialArchivePage,
}: KnowledgeGraphClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openRubricInspector } = useTelemetry();

  // Normalize full corpus for instant URL-synchronized pagination & 6x6 matrix aggregation
  const validIncidents = useMemo(
    () =>
      incidents
        .map((inc) => mapDtoToCraftLexicon(inc))
        .filter((inc) => isRenderablePublicIncident(inc)),
    [incidents]
  );

  // Parse URL query parameters
  const urlToolParam = searchParams.get("tool");
  const urlFailureParam = searchParams.get("failure");
  const urlSectorParam = searchParams.get("sector");
  const urlSourceParam = searchParams.get("source");
  const urlQueryParam = searchParams.get("q") || "";
  const urlViewParam = searchParams.get("view");
  const urlPageParam = parseInt(searchParams.get("page") || "1", 10);

  const resolvedToolSpec = useMemo(
    () =>
      urlToolParam && urlToolParam !== "ALL"
        ? getWorkingToolBySlug(urlToolParam)
        : null,
    [urlToolParam]
  );
  const resolvedFailureSpec = useMemo(
    () =>
      urlFailureParam && urlFailureParam !== "ALL"
        ? getFailureModeBySlug(urlFailureParam)
        : null,
    [urlFailureParam]
  );
  const resolvedSectorSpec = useMemo(
    () =>
      urlSectorParam && urlSectorParam !== "ALL"
        ? getDomainSectorBySlug(urlSectorParam)
        : null,
    [urlSectorParam]
  );

  const selectedTool: WorkingToolId | "ALL" = resolvedToolSpec
    ? resolvedToolSpec.id
    : "ALL";
  const selectedFailure: SreFailureModeId | "ALL" = resolvedFailureSpec
    ? resolvedFailureSpec.id
    : "ALL";
  const selectedSector: DomainSectorId | "ALL" = resolvedSectorSpec
    ? resolvedSectorSpec.id
    : "ALL";
  const selectedSource: string =
    urlSourceParam && urlSourceParam !== "ALL" ? urlSourceParam : "ALL";
  const viewMode: "table" | "cards" | "sources" =
    urlViewParam === "cards"
      ? "cards"
      : urlViewParam === "sources"
      ? "sources"
      : "table";
  const requestedPage = Math.max(1, Number.isNaN(urlPageParam) ? 1 : urlPageParam);

  const [searchInput, setSearchInput] = useState<string>(urlQueryParam);
  useEffect(() => {
    setSearchInput(urlQueryParam);
  }, [urlQueryParam]);

  // Update URL search params deterministically
  const updateArchiveUrl = (updates: {
    tool?: WorkingToolId | "ALL";
    failure?: SreFailureModeId | "ALL";
    sector?: DomainSectorId | "ALL";
    source?: string | "ALL";
    q?: string;
    view?: "table" | "cards" | "sources";
    page?: number;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextTool = updates.tool !== undefined ? updates.tool : selectedTool;
    const nextFailure =
      updates.failure !== undefined ? updates.failure : selectedFailure;
    const nextSector =
      updates.sector !== undefined ? updates.sector : selectedSector;
    const nextSource =
      updates.source !== undefined ? updates.source : selectedSource;
    const nextQuery = updates.q !== undefined ? updates.q : urlQueryParam;
    const nextView = updates.view !== undefined ? updates.view : viewMode;
    const nextPage = updates.page !== undefined ? updates.page : 1;

    if (nextTool === "ALL") {
      params.delete("tool");
    } else {
      params.set("tool", getWorkingToolSpec(nextTool).slug);
    }

    if (nextFailure === "ALL") {
      params.delete("failure");
    } else {
      params.set("failure", getSreFailureModeSpec(nextFailure).slug);
    }

    if (nextSector === "ALL") {
      params.delete("sector");
    } else {
      const secSpec = DOMAIN_SECTOR_SPECS.find((s) => s.id === nextSector);
      params.set("sector", secSpec ? secSpec.slug : nextSector);
    }

    if (!nextSource || nextSource === "ALL") {
      params.delete("source");
    } else {
      params.set("source", nextSource);
    }

    if (!nextQuery.trim()) {
      params.delete("q");
    } else {
      params.set("q", nextQuery.trim());
    }

    if (nextView === "table") {
      params.delete("view");
    } else {
      params.set("view", nextView);
    }

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Compute paginated slice & full-corpus 6x6 matrix counts
  const archivePage: ArchivePaginationResult = useMemo(() => {
    const computed = paginateAndAggregateIncidentCorpus(validIncidents, {
      page: requestedPage,
      pageSize: DEFAULT_ARCHIVE_PAGE_SIZE,
      tool: selectedTool === "ALL" ? null : selectedTool,
      failure: selectedFailure === "ALL" ? null : selectedFailure,
      sector: selectedSector === "ALL" ? null : selectedSector,
      source: selectedSource === "ALL" ? null : selectedSource,
      query: urlQueryParam,
    });
    if (
      validIncidents.length === 0 &&
      initialArchivePage &&
      initialArchivePage.items.length > 0
    ) {
      return initialArchivePage;
    }
    return computed;
  }, [
    validIncidents,
    requestedPage,
    selectedTool,
    selectedFailure,
    selectedSector,
    selectedSource,
    urlQueryParam,
    initialArchivePage,
  ]);

  const hasActiveFilters =
    selectedTool !== "ALL" ||
    selectedFailure !== "ALL" ||
    selectedSector !== "ALL" ||
    selectedSource !== "ALL" ||
    urlQueryParam.trim() !== "";

  // Compute brass heatmap cell style based on count / maxCellCount
  const getMatrixCellHeatmapStyle = (
    count: number,
    isCellSelected: boolean
  ): React.CSSProperties | undefined => {
    if (isCellSelected || count <= 0) return undefined;
    const ratio = Math.min(1, count / Math.max(1, archivePage.maxCellCount));
    const alpha = Math.round((0.06 + ratio * 0.26) * 1000) / 1000;
    const borderAlpha = Math.round((0.28 + ratio * 0.45) * 1000) / 1000;
    return {
      backgroundColor: `rgba(212, 175, 55, ${alpha})`,
      borderColor: `rgba(212, 175, 55, ${borderAlpha})`,
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Masthead & View Switcher */}
      <div className="tracing-board-frame p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C5A059]">
              THE ARCHIVE // STRUCTURAL INSPECTION &amp; MASTER CASE LEDGER
            </span>
            <h1 className="font-display text-2xl sm:text-3xl text-[#F3EFE6] mt-1">
              Moral Working Tools × Structural Failure Modes Archive
            </h1>
            <p className="font-serif text-sm sm:text-base text-[#94A3B8] mt-1 max-w-3xl">
              Cross-reference verified post-incident dispatches across Axis I (The Six Working Tools of Freemasonry), Axis II (Structural Failure Modes), and Axis III (Civic &amp; Industrial Sectors).
            </p>
          </div>

          {/* View Mode Toggle (Master Case Ledger Table / Case Cards / Monitored Publications) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono text-xs">
            <button
              type="button"
              onClick={() => updateArchiveUrl({ view: "table" })}
              className={`inline-flex items-center gap-1.5 px-3 py-2 border cursor-pointer transition-colors ${
                viewMode === "table"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                  : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Case Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => updateArchiveUrl({ view: "cards" })}
              className={`inline-flex items-center gap-1.5 px-3 py-2 border cursor-pointer transition-colors ${
                viewMode === "cards"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                  : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Case Cards</span>
            </button>
            <button
              type="button"
              onClick={() => updateArchiveUrl({ view: "sources" })}
              className={`inline-flex items-center gap-1.5 px-3 py-2 border cursor-pointer transition-colors ${
                viewMode === "sources"
                  ? "bg-[#C5A059] text-[#0B0E14] border-[#C5A059] font-bold"
                  : "bg-[#0B0E14] text-[#94A3B8] border-[#8A6D3B]/50 hover:text-[#F3EFE6]"
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>Monitored Publications ({archivePage.sourceCounts.length})</span>
            </button>
          </div>
        </div>

        {/* Interactive 6x6 Cross-Reference Matrix with Brass Heatmap Shading */}
        <div
          id="matrix"
          className="mt-6 pt-6 border-t border-[#8A6D3B]/35 scroll-mt-24"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[#C5A059] uppercase tracking-wider">
                Interactive 6×6 Diagnostic Heatmap Matrix ({archivePage.corpusTotalCount} Verified Dispatches)
              </span>
              <span className="text-[11px] text-[#94A3B8]">
                Click any cell to filter · Brass intensity scales with incident density
              </span>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateArchiveUrl({
                    tool: "ALL",
                    failure: "ALL",
                    sector: "ALL",
                    source: "ALL",
                    q: "",
                    page: 1,
                  });
                }}
                className="inline-flex items-center gap-1 text-[#C5A059] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Active Filters</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">
              <thead>
                <tr>
                  <th className="p-2.5 bg-[#0B0E14] border border-[#8A6D3B]/40 text-left text-[10px] uppercase text-[#94A3B8] w-48">
                    Axis II Failure \ Axis I Tool
                  </th>
                  {WORKING_TOOLS.map((tool) => {
                    const isToolSelected = selectedTool === tool.id;
                    const colTotal = archivePage.toolRowTotals[tool.id] || 0;
                    return (
                      <th
                        key={tool.id}
                        className={`p-2 border border-[#8A6D3B]/40 text-center transition-colors ${
                          isToolSelected
                            ? "bg-[#C5A059] text-[#0B0E14] font-bold"
                            : "bg-[#0B0E14] text-[#C5A059] hover:bg-[#C5A059]/15"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateArchiveUrl({
                                tool: isToolSelected ? "ALL" : tool.id,
                                page: 1,
                              })
                            }
                            className="cursor-pointer text-center"
                          >
                            <div className="text-[10px] opacity-80">
                              {tool.numeral} ({colTotal})
                            </div>
                            <div className="text-[11px] font-semibold">
                              {tool.shortName}
                            </div>
                          </button>
                          <Link
                            href={getWorkingToolHref(tool.id)}
                            title={`Open ${tool.id} Hub Page`}
                            className={`p-0.5 rounded hover:opacity-100 ${
                              isToolSelected
                                ? "text-[#0B0E14] opacity-80"
                                : "text-[#C5A059] opacity-60"
                            }`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SRE_FAILURE_MODES.map((failure) => {
                  const isFailureSelected = selectedFailure === failure.id;
                  const rowTotal = archivePage.failureColTotals[failure.id] || 0;
                  return (
                    <tr key={failure.id}>
                      <td
                        title={failure.summary}
                        className={`p-2.5 border border-[#8A6D3B]/40 transition-colors ${
                          isFailureSelected
                            ? "bg-[#F59E0B]/25 text-[#F3EFE6] font-bold"
                            : "bg-[#0B0E14] text-[#F3EFE6] hover:bg-[#111726]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateArchiveUrl({
                                failure: isFailureSelected ? "ALL" : failure.id,
                                page: 1,
                              })
                            }
                            className="text-left cursor-pointer"
                          >
                            <div className="text-xs leading-snug">
                              {failure.craftShortLabel}
                            </div>
                            <div className="text-[10px] text-[#94A3B8] font-normal">
                              {rowTotal} total cases
                            </div>
                          </button>
                          <Link
                            href={getFailureModeHref(failure.id)}
                            title={`Open ${failure.craftShortLabel} Hub Page`}
                            className="p-1 text-[#C5A059] opacity-70 hover:opacity-100 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                      {WORKING_TOOLS.map((tool) => {
                        const count =
                          archivePage.matrixCounts[tool.id]?.[failure.id] || 0;
                        const isCellSelected =
                          selectedTool === tool.id &&
                          selectedFailure === failure.id;
                        const isPrimaryPairing =
                          tool.pairedFailureMode === failure.id;
                        return (
                          <td
                            key={`${tool.id}-${failure.id}`}
                            onClick={() => {
                              if (isCellSelected) {
                                updateArchiveUrl({
                                  tool: "ALL",
                                  failure: "ALL",
                                  page: 1,
                                });
                              } else {
                                updateArchiveUrl({
                                  tool: tool.id,
                                  failure: failure.id,
                                  page: 1,
                                });
                              }
                            }}
                            style={getMatrixCellHeatmapStyle(count, isCellSelected)}
                            data-heatmap-count={count}
                            className={`p-2.5 border border-[#8A6D3B]/40 text-center cursor-pointer transition-all ${
                              isCellSelected
                                ? "bg-[#C5A059] text-[#0B0E14] font-bold"
                                : count > 0
                                ? "text-[#F3EFE6] hover:brightness-125"
                                : "bg-[#0B0E14]/50 text-[#94A3B8]/40 hover:bg-[#111726]"
                            }`}
                          >
                            <div className="text-xs font-semibold">
                              {count > 0 ? `${count} ${count === 1 ? "CASE" : "CASES"}` : "—"}
                            </div>
                            {isPrimaryPairing && (
                              <div
                                className={`text-[9px] uppercase tracking-wider mt-0.5 ${
                                  isCellSelected
                                    ? "text-[#0B0E14]/80"
                                    : "text-[#C5A059]/85"
                                }`}
                              >
                                Primary Pair
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Search, Sector (Axis III) & Publication Source Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-6 pt-5 border-t border-[#8A6D3B]/35">
          {/* Search Input (5 cols) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateArchiveUrl({ q: searchInput, page: 1 });
            }}
            className="md:col-span-5 flex items-center gap-2 bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2"
          >
            <Search className="w-4 h-4 text-[#C5A059] shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                updateArchiveUrl({ q: e.target.value, page: 1 });
              }}
              placeholder="Search case ID, headline, or brief..."
              className="bg-transparent font-mono text-xs text-[#F3EFE6] placeholder-[#94A3B8]/60 focus:outline-none w-full"
            />
          </form>

          {/* Axis III Domain Sector Filter (4 cols) */}
          <div className="md:col-span-4 flex items-center gap-2 bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2 font-mono text-xs">
            <span className="text-[#94A3B8] shrink-0">Axis III Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) =>
                updateArchiveUrl({
                  sector: e.target.value as DomainSectorId | "ALL",
                  page: 1,
                })
              }
              aria-label="Filter by Axis III Domain Sector"
              className="bg-transparent text-[#F3EFE6] focus:outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="bg-[#0B0E14]">
                All Sectors ({archivePage.corpusTotalCount})
              </option>
              {DOMAIN_SECTORS.map((s) => (
                <option key={s} value={s} className="bg-[#0B0E14]">
                  {s} ({archivePage.sectorCounts[s] || 0})
                </option>
              ))}
            </select>
          </div>

          {/* Monitored Publication Filter (3 cols) */}
          <div className="md:col-span-3 flex items-center gap-2 bg-[#0B0E14] border border-[#8A6D3B]/50 px-3 py-2 font-mono text-xs">
            <span className="text-[#94A3B8] shrink-0">Source:</span>
            <select
              value={selectedSource}
              onChange={(e) =>
                updateArchiveUrl({
                  source: e.target.value,
                  view: viewMode === "sources" ? "table" : viewMode,
                  page: 1,
                })
              }
              aria-label="Filter by Monitored Publication"
              className="bg-transparent text-[#F3EFE6] focus:outline-none w-full cursor-pointer"
            >
              <option value="ALL" className="bg-[#0B0E14]">
                All Publications ({archivePage.sourceCounts.length})
              </option>
              {archivePage.sourceCounts.map((src) => (
                <option
                  key={src.sourceFeed}
                  value={src.sourceFeed}
                  className="bg-[#0B0E14]"
                >
                  {src.friendlyName} ({src.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Top Pagination & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#111726]/90 border border-[#8A6D3B]/45 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-2 text-[#F3EFE6]">
          <span className="text-[#C5A059] font-semibold">
            Showing {archivePage.startIndex}–{archivePage.endIndex} of{" "}
            {archivePage.totalCount} Dispatches
          </span>
          {hasActiveFilters && (
            <span className="text-[#94A3B8]">
              (filtered from {archivePage.corpusTotalCount} total in Archive)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[#94A3B8]">
            Page {archivePage.page} of {archivePage.totalPages} ({archivePage.pageSize} per page)
          </span>
          {archivePage.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={archivePage.page <= 1}
                onClick={() => updateArchiveUrl({ page: archivePage.page - 1 })}
                className="px-2.5 py-1 border border-[#8A6D3B]/50 bg-[#0B0E14] text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={archivePage.page >= archivePage.totalPages}
                onClick={() => updateArchiveUrl({ page: archivePage.page + 1 })}
                className="px-2.5 py-1 border border-[#8A6D3B]/50 bg-[#0B0E14] text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results Display: Monitored Publications / Streamlined 6-Column Table / Case Cards */}
      {viewMode === "sources" ? (
        <section aria-label="Monitored Publications Directory" className="space-y-4">
          <BrassSectionDivider
            label={`MONITORED PUBLICATIONS DIRECTORY (${archivePage.sourceCounts.length} ACTIVE FEEDS)`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {archivePage.sourceCounts.map((src) => (
              <div
                key={src.sourceFeed}
                className="tracing-board-frame bg-[#111726]/95 p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[#C5A059] uppercase tracking-wider">
                      Monitored Feed
                    </span>
                    <span className="px-2 py-0.5 bg-[#0B0E14] border border-[#8A6D3B]/40 text-[#F3EFE6]">
                      {src.count} {src.count === 1 ? "Dispatch" : "Dispatches"}
                    </span>
                  </div>
                  <h2 className="font-display text-xl text-[#F3EFE6]">
                    {src.friendlyName}
                  </h2>
                  <p className="font-mono text-[11px] text-[#94A3B8]">
                    Feed Key: {src.sourceFeed}
                  </p>
                  {src.latestPublishedAt && (
                    <p className="font-mono text-[11px] text-[#94A3B8]">
                      Latest Verified Case: {formatFriendlyDate(src.latestPublishedAt)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateArchiveUrl({
                      source: src.sourceFeed,
                      view: "table",
                      page: 1,
                    })
                  }
                  className="w-full py-2 px-3 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#d6b36a] transition-colors cursor-pointer"
                >
                  Inspect {src.count} {src.friendlyName} Dispatches →
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : archivePage.items.length === 0 ? (
        <div className="tracing-board-frame p-10 text-center space-y-3">
          <p className="font-display text-xl text-[#F3EFE6]">
            No Historical Records Match This Matrix Coordinate
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              updateArchiveUrl({
                tool: "ALL",
                failure: "ALL",
                sector: "ALL",
                source: "ALL",
                q: "",
                page: 1,
              });
            }}
            className="px-4 py-2 bg-[#C5A059] text-[#0B0E14] font-mono text-xs font-bold uppercase cursor-pointer"
          >
            Reset Matrix Coordinates
          </button>
        </div>
      ) : viewMode === "table" ? (
        /* Streamlined 6-Column Master Case Ledger Table — Zero Horizontal Overflow on 1280px/1440px */
        <div className="tracing-board-frame overflow-hidden">
          <table className="w-full border-collapse text-left table-auto">
            <thead>
              <tr className="border-b border-[#8A6D3B]/50 bg-[#0B0E14] font-mono text-[11px] uppercase text-[#C5A059]">
                <th className="py-3.5 px-3 w-[118px]">Case ID</th>
                <th className="py-3.5 px-3 w-[140px]">Source / Date</th>
                <th className="py-3.5 px-3">Event Headline &amp; Sector</th>
                <th className="py-3.5 px-3 w-[195px]">Working Tools</th>
                <th className="py-3.5 px-3 w-[185px]">Failure Mode</th>
                <th className="py-3.5 px-3 w-[76px] text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8A6D3B]/30 font-mono text-xs">
              {archivePage.items.map((inc) => {
                const fmSpec = getSreFailureModeSpec(inc.sreFailureMode);
                const secSpec = DOMAIN_SECTOR_SPECS.find(
                  (s) => s.id === inc.domainSector
                );
                return (
                  <tr
                    key={inc.id}
                    className="hover:bg-[#0B0E14]/70 transition-colors align-top"
                  >
                    {/* Col 1: Compact Case ID (CAB-2026-XXXX) */}
                    <td className="py-3.5 px-3 text-[#C5A059] text-[11px] font-semibold whitespace-nowrap">
                      <Link
                        href={`/incidents/${inc.slug}`}
                        className="hover:underline"
                      >
                        {formatCompactCaseId(inc.incidentCode, inc.id)}
                      </Link>
                    </td>

                    {/* Col 2: Friendly Source / Date */}
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateArchiveUrl({ source: inc.sourceFeed, page: 1 })
                        }
                        className="text-left text-[#F3EFE6] hover:text-[#C5A059] transition-colors cursor-pointer font-medium leading-snug"
                      >
                        {formatFriendlySourceName(inc.sourceFeed)}
                      </button>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        {formatFriendlyDate(inc.publishedAt)}
                      </div>
                    </td>

                    {/* Col 3: Event Headline & Sector */}
                    <td className="py-3.5 px-3">
                      <Link
                        href={`/incidents/${inc.slug}`}
                        className="font-serif text-sm text-[#F3EFE6] hover:text-[#C5A059] transition-colors line-clamp-2 leading-snug font-medium"
                      >
                        {inc.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateArchiveUrl({
                              sector: inc.domainSector,
                              page: 1,
                            })
                          }
                          className="text-[10px] text-[#94A3B8] hover:text-[#C5A059] transition-colors cursor-pointer"
                        >
                          Sector: {secSpec ? secSpec.shortLabel : inc.domainSector}
                        </button>
                      </div>
                    </td>

                    {/* Col 4: Consolidated Working Tools (1° Primary + 2° Secondary) */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Link
                            href={getWorkingToolHref(inc.primaryTool)}
                            className="inline-flex items-center px-2 py-0.5 bg-[#0B0E14] border border-[#C5A059]/70 text-[#C5A059] hover:bg-[#C5A059]/15 text-[11px] leading-tight"
                          >
                            1° {inc.primaryTool}
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              openRubricInspector({ tool: inc.primaryTool })
                            }
                            title={`Inspect ${inc.primaryTool} in Drawer`}
                            className="p-1 text-[#C5A059]/75 hover:text-[#C5A059] cursor-pointer"
                          >
                            <Info className="w-3 h-3" />
                          </button>
                        </div>
                        <Link
                          href={getWorkingToolHref(inc.secondaryTool)}
                          className="text-[10px] text-[#94A3B8] hover:text-[#C5A059] transition-colors pl-0.5"
                        >
                          2° {inc.secondaryTool}
                        </Link>
                      </div>
                    </td>

                    {/* Col 5: Concise Failure Mode Pill with Controlled Wrapping */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-start gap-1">
                        <Link
                          href={getFailureModeHref(inc.sreFailureMode)}
                          title={fmSpec.summary}
                          className="inline-block px-2 py-1 bg-[#0B0E14] border border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/15 text-[11px] leading-snug break-words"
                        >
                          {fmSpec.craftShortLabel}
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            openRubricInspector({
                              failureMode: inc.sreFailureMode,
                            })
                          }
                          title={`Inspect ${fmSpec.craftShortLabel} in Drawer`}
                          className="p-1 text-[#F59E0B]/75 hover:text-[#F59E0B] cursor-pointer shrink-0"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Col 6: Inspect */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <Link
                        href={`/incidents/${inc.slug}`}
                        className="inline-flex items-center gap-1 text-[#C5A059] hover:text-[#F3EFE6]"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {archivePage.items.map((inc) => (
            <IncidentCard key={inc.id} incident={inc} />
          ))}
        </div>
      )}

      {/* Bottom Broadsheet Pagination Bar */}
      {archivePage.totalPages > 1 && viewMode !== "sources" && (
        <nav
          aria-label="Master Case Ledger Pagination"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#111726]/95 border border-[#8A6D3B]/50 font-mono text-xs"
        >
          <div className="text-[#94A3B8]">
            Showing <span className="text-[#F3EFE6]">{archivePage.startIndex}</span>–
            <span className="text-[#F3EFE6]">{archivePage.endIndex}</span> of{" "}
            <span className="text-[#C5A059] font-semibold">
              {archivePage.totalCount}
            </span>{" "}
            Dispatches · Page {archivePage.page} of {archivePage.totalPages}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={archivePage.page <= 1}
              onClick={() => updateArchiveUrl({ page: archivePage.page - 1 })}
              className="px-3 py-1.5 border border-[#8A6D3B]/50 bg-[#0B0E14] text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
            >
              ← Previous
            </button>

            {Array.from({ length: archivePage.totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => updateArchiveUrl({ page: pageNum })}
                  className={`px-3 py-1.5 border cursor-pointer ${
                    pageNum === archivePage.page
                      ? "border-[#C5A059] bg-[#C5A059] text-[#0B0E14] font-bold"
                      : "border-[#8A6D3B]/40 bg-[#0B0E14] text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/60"
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}

            <button
              type="button"
              disabled={archivePage.page >= archivePage.totalPages}
              onClick={() => updateArchiveUrl({ page: archivePage.page + 1 })}
              className="px-3 py-1.5 border border-[#8A6D3B]/50 bg-[#0B0E14] text-[#F3EFE6] disabled:opacity-40 hover:border-[#C5A059] cursor-pointer"
            >
              Next →
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
