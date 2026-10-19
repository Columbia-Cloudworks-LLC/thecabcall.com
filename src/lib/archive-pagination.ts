import { projectPublicIncidentDto, PublicIncidentDto } from "./dto";
import {
  DOMAIN_SECTOR_SPECS,
  DomainSectorId,
  formatFriendlySourceName,
  getDomainSectorBySlug,
  getFailureModeBySlug,
  getSreFailureModeSpec,
  getWorkingToolBySlug,
  getWorkingToolSpec,
  mapFailureModeToCraftLexicon,
  mapWorkingToolToCraftLexicon,
  SRE_FAILURE_MODES,
  SreFailureModeId,
  WORKING_TOOLS,
  WorkingToolId,
} from "./taxonomy";
import { IncidentArticle } from "./types";

export const DEFAULT_ARCHIVE_PAGE_SIZE = 25;

export interface ArchiveSourceSummary {
  sourceFeed: string;
  friendlyName: string;
  count: number;
  latestPublishedAt: string;
}

export interface PaginatedArchiveQueryParams {
  page?: number;
  pageSize?: number;
  tool?: string | null;
  failure?: string | null;
  sector?: string | null;
  q?: string | null;
  query?: string | null;
  source?: string | null;
  role?: "all" | "primary" | "secondary";
}

export type ArchivePaginationQueryOptions = PaginatedArchiveQueryParams;

export interface PaginatedArchiveResult {
  items: PublicIncidentDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalCount: number;
  totalPages: number;
  totalCorpusCount: number;
  corpusTotalCount: number;
  startIndex: number;
  endIndex: number;
  matrixCounts: Record<WorkingToolId, Record<SreFailureModeId, number>>;
  toolRowTotals: Record<WorkingToolId, number>;
  failureColTotals: Record<SreFailureModeId, number>;
  maxCellCount: number;
  sectorCounts: Record<DomainSectorId, number>;
  sourceSummaries: ArchiveSourceSummary[];
  sourceCounts: ArchiveSourceSummary[];
}

export type ArchivePaginationResult = PaginatedArchiveResult;

export interface WorkingToolHubTelemetry {
  toolId: WorkingToolId;
  primaryCount: number;
  secondaryCount: number;
  totalMatching: number;
  totalTagged: number;
  coOccurringFailures: Array<{
    failureMode: SreFailureModeId;
    count: number;
    percentage: number;
  }>;
  coOccurringFailureModes: Array<{
    failureMode: SreFailureModeId;
    count: number;
    percentage: number;
  }>;
  sectorBreakdown: Array<{
    sector: DomainSectorId;
    slug: string;
    count: number;
    percentage: number;
  }>;
  paginatedDispatches: {
    items: PublicIncidentDto[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    role: "all" | "primary" | "secondary";
  };
}

export type WorkingToolHubAggregationResult = WorkingToolHubTelemetry;

export interface FailureModeHubTelemetry {
  failureModeId: SreFailureModeId;
  totalCases: number;
  totalTagged: number;
  intersectingTools: Array<{
    tool: WorkingToolId;
    slug: string;
    numeral: string;
    primaryCases: number;
    secondaryCases: number;
    totalCases: number;
    primaryCount: number;
    secondaryCount: number;
    totalCount: number;
    percentage: number;
    isDefaultPaired: boolean;
  }>;
  sectorBreakdown: Array<{
    sector: DomainSectorId;
    slug: string;
    count: number;
    percentage: number;
  }>;
  paginatedDispatches: {
    items: PublicIncidentDto[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export type FailureModeHubAggregationResult = FailureModeHubTelemetry;

export function createEmptyMatrixCounts(): Record<
  WorkingToolId,
  Record<SreFailureModeId, number>
> {
  const matrix = {} as Record<WorkingToolId, Record<SreFailureModeId, number>>;
  for (const tool of WORKING_TOOLS) {
    matrix[tool.id] = {
      "Configuration Drift": 0,
      "Cascading Failure": 0,
      "Alert Fatigue & Signal Loss": 0,
      "Single Point of Failure (SPOF) / Untested Failover": 0,
      "Blame Culture vs. Root-Cause Isolation": 0,
      "Technical & Institutional Debt": 0,
      "Structural Friction": 0,
    };
  }
  return matrix;
}

export function createEmptySectorCounts(): Record<DomainSectorId, number> {
  return {
    "Public Policy & Governance": 0,
    "Infrastructure & Supply Chain": 0,
    "Technology & Cyber": 0,
    "Economics & Markets": 0,
    "Institutional Leadership": 0,
  };
}

export function paginateAndAggregateIncidentCorpus(
  allIncidents: Array<IncidentArticle | PublicIncidentDto>,
  params: PaginatedArchiveQueryParams = {}
): PaginatedArchiveResult {
  const projectedCorpus: PublicIncidentDto[] = [];
  for (const raw of allIncidents) {
    const dto = projectPublicIncidentDto(raw);
    if (dto) {
      projectedCorpus.push(dto);
    }
  }

  const matrixCounts = createEmptyMatrixCounts();
  const toolRowTotals: Record<WorkingToolId, number> = {
    "24-Inch Gauge": 0,
    "Common Gavel": 0,
    "The Plumb": 0,
    "The Square": 0,
    "The Level": 0,
    "The Trowel": 0,
  };
  const failureColTotals: Record<SreFailureModeId, number> = {
    "Configuration Drift": 0,
    "Cascading Failure": 0,
    "Alert Fatigue & Signal Loss": 0,
    "Single Point of Failure (SPOF) / Untested Failover": 0,
    "Blame Culture vs. Root-Cause Isolation": 0,
    "Technical & Institutional Debt": 0,
    "Structural Friction": 0,
  };
  let maxCellCount = 1;

  const sectorCounts = createEmptySectorCounts();
  const sourceMap = new Map<
    string,
    {
      sourceFeed: string;
      friendlyName: string;
      count: number;
      latestPublishedAt: string;
    }
  >();

  for (const inc of projectedCorpus) {
    if (
      matrixCounts[inc.primaryTool] &&
      typeof matrixCounts[inc.primaryTool][inc.sreFailureMode] === "number"
    ) {
      matrixCounts[inc.primaryTool][inc.sreFailureMode] += 1;
      const cellCount = matrixCounts[inc.primaryTool][inc.sreFailureMode];
      if (cellCount > maxCellCount) maxCellCount = cellCount;
    }
    toolRowTotals[inc.primaryTool] = (toolRowTotals[inc.primaryTool] || 0) + 1;
    failureColTotals[inc.sreFailureMode] =
      (failureColTotals[inc.sreFailureMode] || 0) + 1;

    if (typeof sectorCounts[inc.domainSector] === "number") {
      sectorCounts[inc.domainSector] += 1;
    }
    const feedKey = inc.sourceFeed.trim().toUpperCase();
    const existing = sourceMap.get(feedKey);
    if (!existing) {
      sourceMap.set(feedKey, {
        sourceFeed: inc.sourceFeed,
        friendlyName: formatFriendlySourceName(inc.sourceFeed),
        count: 1,
        latestPublishedAt: inc.publishedAt,
      });
    } else {
      existing.count += 1;
      if (inc.publishedAt > existing.latestPublishedAt) {
        existing.latestPublishedAt = inc.publishedAt;
      }
    }
  }

  const resolvedTool =
    params.tool && params.tool !== "ALL"
      ? getWorkingToolBySlug(params.tool)?.id ||
        mapWorkingToolToCraftLexicon(params.tool)
      : null;

  const resolvedFailure =
    params.failure && params.failure !== "ALL"
      ? getFailureModeBySlug(params.failure)?.id ||
        mapFailureModeToCraftLexicon(params.failure)
      : null;

  const resolvedSector =
    params.sector && params.sector !== "ALL"
      ? getDomainSectorBySlug(params.sector)?.id || null
      : null;

  const resolvedSource =
    params.source && params.source !== "ALL" && params.source.trim()
      ? params.source.trim().toLowerCase()
      : null;

  const rawQuery = params.q ?? params.query;
  const searchQ =
    rawQuery && rawQuery.trim() ? rawQuery.trim().toLowerCase() : null;

  const role = params.role || "all";

  const filtered = projectedCorpus.filter((inc) => {
    if (resolvedTool) {
      if (role === "primary" && inc.primaryTool !== resolvedTool) return false;
      if (role === "secondary" && inc.secondaryTool !== resolvedTool)
        return false;
      if (
        role === "all" &&
        inc.primaryTool !== resolvedTool &&
        inc.secondaryTool !== resolvedTool
      ) {
        if (inc.primaryTool !== resolvedTool) return false;
      }
    }
    if (resolvedFailure && inc.sreFailureMode !== resolvedFailure) {
      return false;
    }
    if (resolvedSector && inc.domainSector !== resolvedSector) {
      return false;
    }
    if (resolvedSource) {
      const feedMatch =
        inc.sourceFeed.toLowerCase() === resolvedSource ||
        formatFriendlySourceName(inc.sourceFeed).toLowerCase() ===
          resolvedSource;
      if (!feedMatch) return false;
    }
    if (searchQ) {
      const hay =
        `${inc.title} ${inc.incidentCode} ${inc.executiveSummary} ${inc.socraticBrief} ${inc.sourceFeed} ${inc.domainSector}`.toLowerCase();
      if (!hay.includes(searchQ)) return false;
    }
    return true;
  });

  const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || 25)));
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number(params.page || 1)));
  const offset = (page - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);
  const startIndex = totalItems === 0 ? 0 : offset + 1;
  const endIndex =
    totalItems === 0 ? 0 : Math.min(totalItems, offset + items.length);

  const sourceSummaries = Array.from(sourceMap.values()).sort(
    (a, b) => b.count - a.count || a.friendlyName.localeCompare(b.friendlyName)
  );

  return {
    items,
    page,
    pageSize,
    totalItems,
    totalCount: totalItems,
    totalPages,
    totalCorpusCount: projectedCorpus.length,
    corpusTotalCount: projectedCorpus.length,
    startIndex,
    endIndex,
    matrixCounts,
    toolRowTotals,
    failureColTotals,
    maxCellCount,
    sectorCounts,
    sourceSummaries,
    sourceCounts: sourceSummaries,
  };
}

export function buildWorkingToolHubTelemetryFromCorpus(
  toolSpecOrSlug: string,
  allIncidents: Array<IncidentArticle | PublicIncidentDto>,
  options?: {
    page?: number;
    pageSize?: number;
    role?: "all" | "primary" | "secondary";
    roleFilter?: "all" | "primary" | "secondary";
  }
): WorkingToolHubTelemetry {
  const toolSpec =
    getWorkingToolBySlug(toolSpecOrSlug) || getWorkingToolSpec(toolSpecOrSlug);
  const toolId = toolSpec.id;

  const projected: PublicIncidentDto[] = [];
  for (const raw of allIncidents) {
    const dto = projectPublicIncidentDto(raw);
    if (dto) projected.push(dto);
  }

  const matchingAll = projected.filter(
    (inc) => inc.primaryTool === toolId || inc.secondaryTool === toolId
  );
  const primaryCount = matchingAll.filter(
    (inc) => inc.primaryTool === toolId
  ).length;
  const secondaryCount = matchingAll.filter(
    (inc) => inc.secondaryTool === toolId
  ).length;
  const totalMatching = matchingAll.length;
  const denom = Math.max(1, totalMatching);

  const failureMap = new Map<SreFailureModeId, number>();
  for (const mode of SRE_FAILURE_MODES) {
    failureMap.set(mode.id, 0);
  }
  const sectorMap = new Map<DomainSectorId, number>();
  for (const sec of DOMAIN_SECTOR_SPECS) {
    sectorMap.set(sec.id, 0);
  }

  for (const inc of matchingAll) {
    failureMap.set(
      inc.sreFailureMode,
      (failureMap.get(inc.sreFailureMode) || 0) + 1
    );
    sectorMap.set(inc.domainSector, (sectorMap.get(inc.domainSector) || 0) + 1);
  }

  const coOccurringFailures = SRE_FAILURE_MODES.map((m) => {
    const count = failureMap.get(m.id) || 0;
    return {
      failureMode: m.id,
      count,
      percentage: Math.round((count / denom) * 100),
    };
  }).sort((a, b) => b.count - a.count);

  const sectorBreakdown = DOMAIN_SECTOR_SPECS.map((s) => {
    const count = sectorMap.get(s.id) || 0;
    return {
      sector: s.id,
      slug: s.slug,
      count,
      percentage: Math.round((count / denom) * 100),
    };
  }).sort((a, b) => b.count - a.count);

  const role = options?.role || options?.roleFilter || "all";
  const roleFiltered = matchingAll.filter((inc) => {
    if (role === "primary") return inc.primaryTool === toolId;
    if (role === "secondary") return inc.secondaryTool === toolId;
    return true;
  });

  const pageSize = Math.max(1, Math.min(50, Number(options?.pageSize || 12)));
  const totalItems = roleFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number(options?.page || 1)));
  const offset = (page - 1) * pageSize;

  return {
    toolId,
    primaryCount,
    secondaryCount,
    totalMatching,
    totalTagged: totalMatching,
    coOccurringFailures,
    coOccurringFailureModes: coOccurringFailures,
    sectorBreakdown,
    paginatedDispatches: {
      items: roleFiltered.slice(offset, offset + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
      role,
    },
  };
}

export function buildFailureModeHubTelemetryFromCorpus(
  failureSlugOrId: string,
  allIncidents: Array<IncidentArticle | PublicIncidentDto>,
  options?: {
    page?: number;
    pageSize?: number;
  }
): FailureModeHubTelemetry {
  const modeSpec =
    getFailureModeBySlug(failureSlugOrId) ||
    getSreFailureModeSpec(failureSlugOrId);
  const failureModeId = modeSpec.id;

  const projected: PublicIncidentDto[] = [];
  for (const raw of allIncidents) {
    const dto = projectPublicIncidentDto(raw);
    if (dto) projected.push(dto);
  }

  const matching = projected.filter(
    (inc) => inc.sreFailureMode === failureModeId
  );
  const totalCases = matching.length;
  const denom = Math.max(1, totalCases);

  const intersectingTools = WORKING_TOOLS.map((tool) => {
    const primaryCases = matching.filter(
      (inc) => inc.primaryTool === tool.id
    ).length;
    const secondaryCases = matching.filter(
      (inc) => inc.secondaryTool === tool.id
    ).length;
    const combined = primaryCases + secondaryCases;
    return {
      tool: tool.id,
      slug: tool.slug,
      numeral: tool.numeral,
      primaryCases,
      secondaryCases,
      totalCases: combined,
      primaryCount: primaryCases,
      secondaryCount: secondaryCases,
      totalCount: combined,
      percentage: Math.round((primaryCases / denom) * 100),
      isDefaultPaired: modeSpec.defaultPairedTool === tool.id,
    };
  }).sort(
    (a, b) =>
      b.primaryCases - a.primaryCases ||
      b.totalCases - a.totalCases ||
      Number(b.isDefaultPaired) - Number(a.isDefaultPaired)
  );

  const sectorMap = new Map<DomainSectorId, number>();
  for (const sec of DOMAIN_SECTOR_SPECS) {
    sectorMap.set(sec.id, 0);
  }
  for (const inc of matching) {
    sectorMap.set(inc.domainSector, (sectorMap.get(inc.domainSector) || 0) + 1);
  }

  const sectorBreakdown = DOMAIN_SECTOR_SPECS.map((s) => {
    const count = sectorMap.get(s.id) || 0;
    return {
      sector: s.id,
      slug: s.slug,
      count,
      percentage: Math.round((count / denom) * 100),
    };
  }).sort((a, b) => b.count - a.count);

  const pageSize = Math.max(1, Math.min(50, Number(options?.pageSize || 25)));
  const totalItems = matching.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number(options?.page || 1)));
  const offset = (page - 1) * pageSize;

  return {
    failureModeId,
    totalCases,
    totalTagged: totalCases,
    intersectingTools,
    sectorBreakdown,
    paginatedDispatches: {
      items: matching.slice(offset, offset + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}
