"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { SquareAndCompassesCrest } from "./MasonicEngravings";
import {
  ADMIN_SUBDOMAIN_PATHS,
  isAdminDashboardPath,
  NAV_ITEMS,
  NAVIGATION_SCHEMA,
  NavItemConfig,
  NavSubItem,
  PUBLIC_SITE_ORIGIN,
  resolvePublicNavHref,
} from "@/lib/navigation";

export {
  PUBLIC_SITE_ORIGIN,
  NAV_ITEMS,
  NAVIGATION_SCHEMA,
  ADMIN_SUBDOMAIN_PATHS,
  isAdminDashboardPath,
};

/**
 * Determines whether a top-level navigation item is the active "You Are Here"
 * street sign for the given pathname (Krug "Trunk Test" compliance).
 * Individual case briefs (`/incidents/[slug]`) belong to The Trestleboard (`/`).
 * `/tools/[slug]` and `/failures/[slug]` belong to The Working Tools & Rubric (`/rubric`).
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
      normalizedPath.startsWith("/feeds/")
    );
  }
  return (
    normalizedPath === itemHref || normalizedPath.startsWith(`${itemHref}/`)
  );
}

const HOVER_CLOSE_DELAY_MS = 150;

export function SiteHeader() {
  const pathname = usePathname() || "/";
  const [hostInfo, setHostInfo] = useState<{
    isAdminSubdomain: boolean;
    isLocalhost: boolean;
  }>({
    isAdminSubdomain: false,
    isLocalhost: false,
  });

  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedIds, setMobileExpandedIds] = useState<
    Record<string, boolean>
  >({ trestleboard: true });

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastPointerTypeRef = useRef<string>("mouse");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      setHostInfo({
        isAdminSubdomain:
          host === "admin.thecabcall.com" || host.startsWith("admin."),
        isLocalhost:
          host === "localhost" ||
          host === "127.0.0.1" ||
          host.endsWith(".localhost"),
      });
    }
  }, []);

  // Close open dropdowns and mobile drawer on pathname change
  useEffect(() => {
    setOpenDropdownId(null);
    setMobileMenuOpen(false);
  }, [pathname]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleCloseDropdown = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenDropdownId(null);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handleOpenDropdown = useCallback(
    (itemId: string) => {
      clearCloseTimer();
      setOpenDropdownId(itemId);
    },
    [clearCloseTimer]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleDocumentPointerDown(event: MouseEvent | TouchEvent) {
      if (
        navContainerRef.current &&
        event.target instanceof Node &&
        !navContainerRef.current.contains(event.target)
      ) {
        setOpenDropdownId(null);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (openDropdownId) {
          const activeTrigger = triggerRefs.current[openDropdownId];
          setOpenDropdownId(null);
          activeTrigger?.focus();
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
        }
      }
    }

    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("touchstart", handleDocumentPointerDown, {
      passive: true,
    });
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentPointerDown);
      document.removeEventListener("touchstart", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [openDropdownId, mobileMenuOpen]);

  const isAdminContext =
    hostInfo.isAdminSubdomain || isAdminDashboardPath(pathname);

  const isLoginRoute =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/");

  if (isAdminContext && !isLoginRoute) {
    return null;
  }

  const homeHref =
    hostInfo.isLocalhost && !hostInfo.isAdminSubdomain
      ? "/"
      : PUBLIC_SITE_ORIGIN;

  const resolveHref = (itemHref: string): string =>
    resolvePublicNavHref(itemHref, {
      isAdminContext,
      isLocalhost: hostInfo.isLocalhost,
      isAdminSubdomain: hostInfo.isAdminSubdomain,
    });

  const focusFirstSubItem = (itemId: string) => {
    requestAnimationFrame(() => {
      const panel = panelRefs.current[itemId];
      if (!panel) return;
      const firstLink = panel.querySelector<HTMLElement>("a[href]");
      firstLink?.focus();
    });
  };

  const toggleMobileSection = (itemId: string) => {
    setMobileExpandedIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const activeTopItem =
    NAVIGATION_SCHEMA.find((item) =>
      isNavItemActive(item.href, pathname, isAdminContext)
    ) || NAVIGATION_SCHEMA[0];

  const renderSubItemLink = (subItem: NavSubItem, parentId: string) => {
    const resolvedSubHref = resolveHref(subItem.href);
    return (
      <Link
        key={`${parentId}-${subItem.href}-${subItem.label}`}
        href={resolvedSubHref}
        target={subItem.external ? "_blank" : undefined}
        rel={subItem.external ? "noopener noreferrer" : undefined}
        onClick={() => setOpenDropdownId(null)}
        className="group/sub block px-3.5 py-2.5 border-l-2 border-transparent hover:border-[#C5A059] focus-visible:border-[#C5A059] hover:bg-[#111726]/95 focus-visible:bg-[#111726]/95 transition-all focus:outline-none"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-xs tracking-wider text-[#F3EFE6] group-hover/sub:text-[#C5A059] group-focus-visible/sub:text-[#C5A059] transition-colors">
            {subItem.label}
          </span>
          {subItem.badge && (
            <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 bg-[#0B0E14] border border-[#C5A059]/50 text-[#C5A059]">
              {subItem.badge}
            </span>
          )}
        </div>
        {subItem.description && (
          <p className="font-serif text-xs text-[#94A3B8] group-hover/sub:text-[#F3EFE6]/85 mt-0.5 leading-snug">
            {subItem.description}
          </p>
        )}
      </Link>
    );
  };

  const renderDropdownPanel = (item: NavItemConfig, index: number) => {
    const hasSingleItems = Array.isArray(item.items) && item.items.length > 0;
    const hasColumns = Array.isArray(item.columns) && item.columns.length > 0;
    if (!hasSingleItems && !hasColumns) return null;

    const isOpen = openDropdownId === item.id;
    const isTwoColumn = item.layout === "two-column" && hasColumns;
    // Align rightmost menus to the right edge so they never clip off-screen
    const alignRight = index >= NAVIGATION_SCHEMA.length - 2;

    return (
      <div
        id={`nav-dropdown-${item.id}`}
        ref={(el) => {
          panelRefs.current[item.id] = el;
        }}
        role="region"
        aria-label={`${item.label} Submenu`}
        onMouseEnter={() => handleOpenDropdown(item.id)}
        onMouseLeave={scheduleCloseDropdown}
        className={`nav-dropdown-panel absolute top-full mt-1.5 z-50 bg-[#0B101B] border border-[#C5A059]/60 shadow-[0_18px_48px_rgba(0,0,0,0.82)] before:content-[''] before:absolute before:-top-2.5 before:inset-x-0 before:h-2.5 transition-all duration-150 origin-top ${
          alignRight ? "right-0" : "left-0"
        } ${
          isTwoColumn
            ? "w-[560px] lg:w-[640px] max-w-[calc(100vw-2rem)]"
            : "w-[300px] sm:w-[320px] max-w-[calc(100vw-2rem)]"
        } ${
          isOpen
            ? "opacity-100 translate-y-0 visible pointer-events-auto"
            : "opacity-0 -translate-y-1 invisible pointer-events-none"
        }`}
      >
        {/* Double-line brass hairline inner border matching CAB Weekly Brief card */}
        <div className="pointer-events-none absolute inset-1 border border-[#8A6D3B]/40" />

        {/* Four Burnished Brass Corner-Tick Brackets */}
        <span className="pointer-events-none absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#C5A059]" />
        <span className="pointer-events-none absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#C5A059]" />
        <span className="pointer-events-none absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#C5A059]" />
        <span className="pointer-events-none absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#C5A059]" />

        <div className="relative z-10 p-3.5 sm:p-4">
          <div className="px-3.5 pb-2.5 mb-2.5 border-b border-[#8A6D3B]/40 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
              {item.label}
            </span>
            <Link
              href={resolveHref(item.href)}
              onClick={() => setOpenDropdownId(null)}
              className="font-mono text-[10px] text-[#94A3B8] hover:text-[#C5A059] transition-colors"
            >
              Overview →
            </Link>
          </div>
          {isTwoColumn && item.columns ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x sm:divide-[#8A6D3B]/35">
              {item.columns.map((col, colIdx) => (
                <div
                  key={col.heading}
                  className={colIdx > 0 ? "sm:pl-4" : "sm:pr-1"}
                >
                  <div className="px-3.5 pb-2 mb-2 border-b border-[#8A6D3B]/40">
                    <div className="font-display text-[11px] uppercase tracking-[0.16em] text-[#C5A059] font-semibold">
                      {col.heading}
                    </div>
                    {col.subtitle && (
                      <div className="font-mono text-[10px] text-[#94A3B8] mt-0.5">
                        {col.subtitle}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {col.items.map((subItem) =>
                      renderSubItemLink(subItem, item.id)
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              {item.items?.map((subItem) =>
                renderSubItemLink(subItem, item.id)
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* TIER 1: THE EDITORIAL MASTHEAD (Scrolls naturally out of view) */}
      <header className="relative bg-[#0B0E14] checkered-pavement">
        {/* Subtle top hairline brass trim */}
        <div className="h-[2px] w-full bg-gradient-to-r from-[#0B0E14] via-[#C5A059]/65 to-[#0B0E14]" />

        {/* Constrained Inner Masthead Container aligned with CAB Weekly Brief card */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-4 sm:gap-5 group min-w-0 max-w-full"
          >
            {/* Scaled-up Authoritative Seal with solid #070A10 backing & rotating degree ring */}
            <SquareAndCompassesCrest className="w-14 h-14 sm:w-16 sm:h-16 lg:w-[68px] lg:h-[68px] shrink-0 transition-transform duration-300 group-hover:scale-105" />

            {/* 1px Vertical Gold Plumb-Line Divider */}
            <div
              aria-hidden="true"
              className="w-[1px] self-stretch min-h-[48px] sm:min-h-[60px] bg-gradient-to-b from-transparent via-[#C5A059]/65 to-transparent shrink-0"
            />

            {/* Single-Line Title & Balanced Italic Broadsheet Subtitle */}
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-2xl md:text-[28px] lg:text-[32px] tracking-[0.06em] sm:tracking-[0.08em] text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors sm:whitespace-nowrap leading-tight">
                CHANGE ADVISORY BOARD
              </h1>
              <p className="text-xs sm:text-[13.5px] lg:text-sm text-[#94A3B8] font-serif italic leading-snug mt-1">
                The CAB Call — Examining Current Events Through Site Reliability Engineering &amp; the Working Tools of Freemasonry
              </p>
            </div>
          </Link>
        </div>
      </header>

      {/* TIER 2: THE NAVIGATION LEDGER BAR (Sticky top: 0 with backdrop blur) */}
      <div
        ref={navContainerRef}
        className="nav-ledger-bar sticky top-0 z-50 border-y border-[#8A6D3B]/55 bg-[#0B0E14]/90 backdrop-blur-md checkered-pavement shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Desktop & Tablet Horizontal Ledger Navigation (>= 768px) */}
          <nav
            aria-label="Primary Broadsheet Navigation"
            className="hidden md:flex items-center justify-between gap-2 lg:gap-6"
          >
            {NAVIGATION_SCHEMA.map((item, index) => {
              const isActive = isNavItemActive(
                item.href,
                pathname,
                isAdminContext
              );
              const isOpen = openDropdownId === item.id;
              const hasDropdown =
                (Array.isArray(item.items) && item.items.length > 0) ||
                (Array.isArray(item.columns) && item.columns.length > 0);
              const targetHref = resolveHref(item.href);

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => {
                    if (hasDropdown) {
                      handleOpenDropdown(item.id);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasDropdown) {
                      scheduleCloseDropdown();
                    }
                  }}
                  onBlur={(e) => {
                    if (
                      isOpen &&
                      !e.currentTarget.contains(e.relatedTarget as Node | null)
                    ) {
                      setOpenDropdownId(null);
                    }
                  }}
                >
                  <div className="flex items-center">
                    <Link
                      ref={(el) => {
                        triggerRefs.current[item.id] = el;
                      }}
                      href={targetHref}
                      aria-current={isActive ? "page" : undefined}
                      aria-expanded={hasDropdown ? isOpen : undefined}
                      aria-haspopup={hasDropdown ? "true" : undefined}
                      aria-controls={
                        hasDropdown ? `nav-dropdown-${item.id}` : undefined
                      }
                      onPointerDown={(e) => {
                        lastPointerTypeRef.current = e.pointerType;
                      }}
                      onClick={(e) => {
                        // Touch devices: first tap opens the dropdown; second tap navigates
                        if (
                          hasDropdown &&
                          lastPointerTypeRef.current === "touch" &&
                          !isOpen
                        ) {
                          e.preventDefault();
                          handleOpenDropdown(item.id);
                        } else {
                          setOpenDropdownId(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (!hasDropdown) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          handleOpenDropdown(item.id);
                          focusFirstSubItem(item.id);
                        } else if (e.key === "Escape" && isOpen) {
                          e.preventDefault();
                          setOpenDropdownId(null);
                        }
                      }}
                      className={`group/nav inline-flex items-center gap-1.5 py-3 px-2 whitespace-nowrap font-display text-xs lg:text-[13px] tracking-[0.08em] transition-all ${
                        isActive
                          ? "border-b-2 border-b-[#C5A059] text-[#F3EFE6] font-bold"
                          : isOpen
                          ? "border-b-2 border-b-[#C5A059]/85 text-[#F3EFE6]"
                          : "border-b-2 border-b-transparent text-[#94A3B8] hover:text-[#F3EFE6] hover:border-b-[#C5A059]/70"
                      }`}
                    >
                      <span>{item.label}</span>
                      {hasDropdown && (
                        <ChevronDown
                          aria-hidden="true"
                          className={`w-3.5 h-3.5 text-[#C5A059]/85 transition-transform duration-200 ${
                            isOpen
                              ? "rotate-180 text-[#C5A059]"
                              : "group-hover/nav:text-[#C5A059]"
                          }`}
                        />
                      )}
                    </Link>

                    {/* Dedicated keyboard-accessible submenu toggle button for screen readers & keyboard users */}
                    {hasDropdown && (
                      <button
                        type="button"
                        aria-label={`Toggle ${item.label} submenu`}
                        aria-expanded={isOpen}
                        aria-controls={`nav-dropdown-${item.id}`}
                        onClick={() => {
                          if (isOpen) {
                            setOpenDropdownId(null);
                          } else {
                            handleOpenDropdown(item.id);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "ArrowDown" ||
                            e.key === "Enter" ||
                            e.key === " "
                          ) {
                            e.preventDefault();
                            handleOpenDropdown(item.id);
                            focusFirstSubItem(item.id);
                          }
                        }}
                        className="sr-only focus:not-sr-only focus:px-1.5 focus:py-1 focus:ml-0.5 focus:bg-[#111726] focus:border focus:border-[#C5A059] focus:text-[#C5A059] font-mono text-[10px]"
                      >
                        ▾
                      </button>
                    )}
                  </div>

                  {renderDropdownPanel(item, index)}
                </div>
              );
            })}
          </nav>

          {/* Mobile Ledger Bar & Accordion Drawer Trigger (< 768px) */}
          <div className="flex md:hidden items-center justify-between py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C5A059]">
                Section:
              </span>
              <span className="font-display text-xs text-[#F3EFE6] font-bold truncate border-b border-[#C5A059] pb-0.5">
                {activeTopItem.label}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-ledger"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#111726] border border-[#C5A059]/60 text-[#F3EFE6] font-display text-xs tracking-wider uppercase cursor-pointer"
            >
              {mobileMenuOpen ? (
                <>
                  <X className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Close</span>
                </>
              ) : (
                <>
                  <Menu className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Ledger Menu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Expandable Accordion Drawer (< 768px) */}
        {mobileMenuOpen && (
          <nav
            id="mobile-navigation-ledger"
            aria-label="Mobile Broadsheet Navigation"
            className="md:hidden border-t border-[#8A6D3B]/45 bg-[#0B101B] px-4 py-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="space-y-2">
              {NAVIGATION_SCHEMA.map((item) => {
                const isActive = isNavItemActive(
                  item.href,
                  pathname,
                  isAdminContext
                );
                const isExpanded = !!mobileExpandedIds[item.id];
                const targetHref = resolveHref(item.href);
                const subItems: NavSubItem[] = item.items
                  ? item.items
                  : item.columns
                  ? item.columns.flatMap((col) => col.items)
                  : [];

                return (
                  <div
                    key={`mobile-${item.id}`}
                    className="border border-[#8A6D3B]/40 bg-[#0B0E14]/90"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={targetHref}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex-1 px-3.5 py-2.5 font-display text-xs tracking-wider ${
                          isActive
                            ? "text-[#F3EFE6] font-bold border-l-2 border-l-[#C5A059]"
                            : "text-[#F3EFE6]/90"
                        }`}
                      >
                        {item.label}
                      </Link>
                      {subItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleMobileSection(item.id)}
                          aria-expanded={isExpanded}
                          aria-label={`Expand ${item.label} links`}
                          className="px-3.5 py-2.5 text-[#C5A059] border-l border-[#8A6D3B]/30 cursor-pointer"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {isExpanded && subItems.length > 0 && (
                      <div className="border-t border-[#8A6D3B]/30 bg-[#111726]/70 py-1.5 px-2 space-y-1">
                        {item.columns ? (
                          <div className="space-y-3 py-1">
                            {item.columns.map((col) => (
                              <div key={col.heading} className="space-y-1">
                                <div className="px-2 font-mono text-[10px] uppercase tracking-widest text-[#C5A059]">
                                  {col.heading}
                                </div>
                                {col.items.map((sub) => (
                                  <Link
                                    key={`mob-${item.id}-${sub.href}`}
                                    href={resolveHref(sub.href)}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="block px-3 py-1.5 text-xs font-serif text-[#F3EFE6]/90 hover:text-[#C5A059] border-l border-[#8A6D3B]/40 hover:border-[#C5A059]"
                                  >
                                    {sub.label}
                                  </Link>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          subItems.map((sub) => (
                            <Link
                              key={`mob-${item.id}-${sub.href}`}
                              href={resolveHref(sub.href)}
                              onClick={() => setMobileMenuOpen(false)}
                              className="block px-3 py-1.5 text-xs font-serif text-[#F3EFE6]/90 hover:text-[#C5A059] border-l border-[#8A6D3B]/40 hover:border-[#C5A059]"
                            >
                              {sub.label}
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}
