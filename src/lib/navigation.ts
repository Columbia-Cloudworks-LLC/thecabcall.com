import {
  DOMAIN_SECTOR_SPECS,
  SRE_FAILURE_MODES,
  WORKING_TOOLS,
} from "./taxonomy";

export const PUBLIC_SITE_ORIGIN = "https://thecabcall.com";

export interface NavSubItem {
  label: string;
  href: string;
  description?: string;
  badge?: string;
  external?: boolean;
}

export interface NavDropdownColumn {
  heading: string;
  subtitle?: string;
  items: NavSubItem[];
}

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  layout?: "single" | "two-column";
  items?: NavSubItem[];
  columns?: NavDropdownColumn[];
}

/**
 * Central, extensible navigation schema for The CAB Call two-tier masthead
 * and architectural dropdown ledger bar (Epic #27 & Epic #44 / Issue #39).
 * Derived directly from the canonical taxonomy in `src/lib/taxonomy.ts`.
 */
export const NAVIGATION_SCHEMA: NavItemConfig[] = [
  {
    id: "trestleboard",
    label: "The Trestleboard",
    href: "/",
  },
  {
    id: "archive",
    label: "The Archive",
    href: "/archive",
    layout: "two-column",
    columns: [
      {
        heading: "Archive Views",
        subtitle: "Ledger & Diagnostic Views",
        items: [
          {
            label: "The Master Ledger",
            href: "/archive",
            description:
              "Chronological & high-density case ledger of verified dispatches",
          },
          {
            label: "6×6 Diagnostic Matrix",
            href: "/archive#matrix",
            description:
              "Interactive Working Tool × Failure Mode heatmap",
          },
          {
            label: "Monitored Publications",
            href: "/archive?view=sources",
            description:
              "Cross-reference dispatches by upstream wire and publication",
          },
        ],
      },
      {
        heading: "Browse by Sector (Axis III)",
        subtitle: "Civic & Institutional Domains",
        items: DOMAIN_SECTOR_SPECS.map((sector) => ({
          label: sector.shortLabel,
          href: `/archive?sector=${sector.slug}`,
          description: sector.description,
        })),
      },
    ],
  },
  {
    id: "podcast",
    label: "The CAB Call Podcast",
    href: "/podcast",
    layout: "single",
    items: [
      {
        label: "Latest Episodes",
        href: "/podcast#latest",
        description: "Weekly Ledger Roundups and Foundational Craft & SRE Essays",
      },
      {
        label: "Episode Guides & Transcripts",
        href: "/podcast#transcripts",
        description: "Extended overviews, source dossiers, and full verified transcripts",
      },
      {
        label: "Subscribe & RSS Feeds",
        href: "/feed.xml",
        description: "Direct RSS 2.0 audio feed for Apple Podcasts, Spotify & Overcast",
        badge: "RSS 2.0",
        external: true,
      },
    ],
  },
  {
    id: "rubric",
    label: "The Working Tools & Rubric",
    href: "/rubric",
    layout: "two-column",
    columns: [
      {
        heading: "The Working Tools",
        subtitle: "Axis I · Operative & Moral Craft Lenses",
        items: WORKING_TOOLS.map((tool) => ({
          label: tool.navLabel,
          href: `/tools/${tool.slug}`,
          description: tool.navDescription,
          badge: `TOOL ${tool.numeral}`,
        })),
      },
      {
        heading: "System Failure Modes",
        subtitle: "Axis II · Site Reliability Fault Lines",
        items: SRE_FAILURE_MODES.map((mode) => ({
          label: mode.navLabel,
          href: `/failures/${mode.slug}`,
          description: mode.navDescription,
        })),
      },
    ],
  },
  {
    id: "about",
    label: "About & Feeds",
    href: "/status",
    layout: "single",
    items: [
      {
        label: "Mission & Methodology",
        href: "/status#mission",
        description: "Why operative stonecraft meets Site Reliability Engineering",
      },
      {
        label: "Editorial Standards",
        href: "/status#editorial-standards",
        description: "Four-stage structural inspection & epistemic humility rules",
      },
      {
        label: "RSS / JSON Feeds",
        href: "/status#feeds",
        description: "Open syndication directory for podcasts and case briefs",
      },
    ],
  },
];

/**
 * Flat top-level navigation list preserved for backward compatibility
 * with existing consumers and test harnesses.
 */
export const NAV_ITEMS: Array<{ href: string; label: string }> =
  NAVIGATION_SCHEMA.map((item) => ({
    href: item.href,
    label: item.label,
  }));

export const ADMIN_SUBDOMAIN_PATHS = [
  "/admin",
  "/login",
  "/users",
  "/episodes",
  "/filters",
  "/audit",
  "/transforms",
  "/publishing",
];

export function isAdminDashboardPath(pathname: string): boolean {
  const normalizedPath = (pathname || "/").trim() || "/";
  return ADMIN_SUBDOMAIN_PATHS.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}

/**
 * Determines whether a top-level navigation item is the active "You Are Here"
 * street sign for the given pathname (Krug "Trunk Test" compliance).
 * - Individual case briefs (`/incidents/[slug]`) and `/incidents` belong to The Trestleboard (`/`).
 * - `/archive` and `/knowledge-graph` belong to The Archive (`/archive`).
 * - `/podcast` belongs to The CAB Call Podcast (`/podcast`).
 * - `/rubric`, `/tools/[slug]`, and `/failures/[slug]` belong to The Working Tools & Rubric (`/rubric`).
 */
export function isNavItemActive(
  itemHref: string,
  pathname: string,
  isAdminContext = false
): boolean {
  if (isAdminContext) {
    return false;
  }
  const normalizedPath = (pathname || "/").trim() || "/";
  if (isAdminDashboardPath(normalizedPath)) {
    return false;
  }
  if (itemHref === "/") {
    return (
      normalizedPath === "/" ||
      normalizedPath === "/incidents" ||
      normalizedPath.startsWith("/incidents/")
    );
  }
  if (itemHref === "/archive" || itemHref === "/knowledge-graph") {
    return (
      normalizedPath === "/archive" ||
      normalizedPath.startsWith("/archive/") ||
      normalizedPath === "/knowledge-graph" ||
      normalizedPath.startsWith("/knowledge-graph/")
    );
  }
  if (itemHref === "/podcast") {
    return (
      normalizedPath === "/podcast" ||
      normalizedPath.startsWith("/podcast/")
    );
  }
  if (itemHref === "/rubric") {
    return (
      normalizedPath === "/rubric" ||
      normalizedPath.startsWith("/rubric/") ||
      normalizedPath === "/tools" ||
      normalizedPath.startsWith("/tools/") ||
      normalizedPath === "/failures" ||
      normalizedPath.startsWith("/failures/")
    );
  }
  if (itemHref === "/status") {
    return (
      normalizedPath === "/status" ||
      normalizedPath.startsWith("/status/") ||
      normalizedPath === "/feeds" ||
      normalizedPath.startsWith("/feeds/") ||
      normalizedPath === "/about" ||
      normalizedPath.startsWith("/about/")
    );
  }
  return (
    normalizedPath === itemHref || normalizedPath.startsWith(`${itemHref}/`)
  );
}

/**
 * Resolves a navigation href so that links clicked from `admin.thecabcall.com`
 * point back to the canonical public site origin.
 */
export function resolvePublicNavHref(
  itemHref: string,
  options: { isAdminContext: boolean; isLocalhost: boolean; isAdminSubdomain: boolean }
): string {
  const homeHref =
    options.isLocalhost && !options.isAdminSubdomain
      ? "/"
      : PUBLIC_SITE_ORIGIN;

  if (itemHref === "/") {
    return homeHref;
  }
  if (itemHref.startsWith("/#")) {
    return options.isLocalhost && !options.isAdminSubdomain
      ? itemHref
      : `${PUBLIC_SITE_ORIGIN}${itemHref}`;
  }
  if (options.isAdminContext && !options.isLocalhost) {
    return `${PUBLIC_SITE_ORIGIN}${itemHref}`;
  }
  return itemHref;
}
