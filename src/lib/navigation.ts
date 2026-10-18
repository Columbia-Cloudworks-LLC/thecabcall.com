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
 * and architectural dropdown ledger bar (Epic #27 / Issue #30).
 */
export const NAVIGATION_SCHEMA: NavItemConfig[] = [
  {
    id: "trestleboard",
    label: "The Trestleboard",
    href: "/",
    layout: "single",
    items: [
      {
        label: "Current Weekly Brief",
        href: "/#weekly-brief",
        description: "This week's pattern retrospective & Friday 5-minute audio roll-up",
      },
      {
        label: "Active Dispatches",
        href: "/#active-dispatches",
        description: "Filter verified Craftsman's Briefs by Working Tool & Failure Mode",
      },
      {
        label: "Incident Ledger",
        href: "/incidents",
        description: "Browse the live operational case ledger on the Trestleboard",
      },
      {
        label: "Systemic Trends",
        href: "/#systemic-trends",
        description: "Lead post-mortems and recurring structural fault lines",
      },
    ],
  },
  {
    id: "archive",
    label: "The Archive",
    href: "/knowledge-graph",
    layout: "single",
    items: [
      {
        label: "Browse by Week",
        href: "/knowledge-graph?view=week",
        description: "Chronological ledger of verified civic and systems inspections",
      },
      {
        label: "Browse by Source",
        href: "/knowledge-graph?view=source",
        description: "Cross-reference dispatches across monitored publications",
      },
      {
        label: "Search Dispatches",
        href: "/knowledge-graph?view=search",
        description: "Full-text search across case titles, codes, and plain facts",
      },
      {
        label: "Historical Post-Mortems",
        href: "/knowledge-graph?view=post-mortems",
        description: "6×6 Working Tool × Failure Mode diagnostic matrix",
      },
    ],
  },
  {
    id: "podcast",
    label: "The CAB Call Podcast",
    href: "/archive",
    layout: "single",
    items: [
      {
        label: "Latest Episodes",
        href: "/archive#latest",
        description: "5-minute Friday Weekly Briefs and Legacy Deep-Dive Archive",
      },
      {
        label: "Transcripts Archive",
        href: "/archive#transcripts",
        description: "Complete time-stamped three-part verified transcripts",
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
        items: [
          {
            label: "The 24-Inch Gauge",
            href: "/rubric#24-inch-gauge",
            description: "Budgeting crew hours, cutting busywork & guarding reserves",
          },
          {
            label: "The Common Gavel",
            href: "/rubric#common-gavel",
            description: "Honest shop-floor reviews & stripping away partisan spin",
          },
          {
            label: "The Square",
            href: "/rubric#the-square",
            description: "Squaring field work with the written blueprint & promises",
          },
          {
            label: "The Level",
            href: "/rubric#the-level",
            description: "Shared accountability & equal footing across ranks",
          },
          {
            label: "The Plumb",
            href: "/rubric#the-plumb",
            description: "Holding the line on safety standards under pressure",
          },
          {
            label: "The Trowel",
            href: "/rubric#the-trowel",
            description: "Spreading the mortar of clear handoffs & civic trust",
          },
        ],
      },
      {
        heading: "System Failure Modes",
        subtitle: "Axis II · Site Reliability Fault Lines",
        items: [
          {
            label: "Single Point of Failure (SPOF)",
            href: "/rubric#spof",
            description: "Betting the whole structure on a single load-bearing pin",
          },
          {
            label: "Cascading Failure",
            href: "/rubric#cascading-failure",
            description: "Chain-reaction breakdowns across unbuffered supports",
          },
          {
            label: "Configuration Drift",
            href: "/rubric#configuration-drift",
            description: "When daily field habits quietly wander off the blueprint",
          },
          {
            label: "Silent Data Corruption",
            href: "/rubric#silent-data-corruption",
            description: "Drowning in false alarms & unverified telemetry signals",
          },
          {
            label: "Untested Failover",
            href: "/rubric#untested-failover",
            description: "Emergency backups that only ever existed on paper",
          },
        ],
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
 * Individual case briefs (`/incidents/[slug]`) and `/incidents` belong to The Trestleboard (`/`).
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
  if (itemHref === "/status") {
    return (
      normalizedPath === "/status" ||
      normalizedPath.startsWith("/status/") ||
      normalizedPath === "/feeds" ||
      normalizedPath.startsWith("/feeds/")
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
