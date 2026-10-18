"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SquareAndCompassesCrest } from "./MasonicEngravings";

export const NAV_ITEMS = [
  { href: "/", label: "The Trestleboard" },
  { href: "/knowledge-graph", label: "The Archive" },
  { href: "/archive", label: "The CAB Call Podcast" },
  { href: "/rubric", label: "The Working Tools & Rubric" },
  { href: "/status", label: "About & Feeds" },
];

/**
 * Determines whether a top-level navigation item is the active "You Are Here"
 * street sign for the given pathname (Krug "Trunk Test" compliance).
 * Individual case briefs (`/incidents/[slug]`) belong to The Trestleboard (`/`).
 */
export function isNavItemActive(itemHref: string, pathname: string): boolean {
  const normalizedPath = (pathname || "/").trim() || "/";
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

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="relative border-b border-[#8A6D3B]/55 bg-[#0B0E14] checkered-pavement">
      {/* Subtle top hairline brass trim */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#0B0E14] via-[#C5A059]/60 to-[#0B0E14]" />

      {/* Main Masthead & Single-Row Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
        {/* Left: Emblem, Title, and Broadsheet Subtitle */}
        <Link href="/" className="flex items-center gap-3.5 group min-w-0">
          <SquareAndCompassesCrest className="w-13 h-13 shrink-0 transition-transform duration-300 group-hover:scale-105" />
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl tracking-[0.06em] text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors">
              CHANGE ADVISORY BOARD
            </h1>
            <p className="text-xs sm:text-[13px] text-[#94A3B8] font-serif italic leading-snug mt-0.5">
              The CAB Call — Examining Current Events Through Site Reliability Engineering &amp; the Working Tools of Freemasonry
            </p>
          </div>
        </Link>

        {/* Right: Single Horizontal Row Navigation (No Wrapping) */}
        <nav
          aria-label="Primary Broadsheet Navigation"
          className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto xl:overflow-visible shrink-0 pb-1 xl:pb-0"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = isNavItemActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`px-3 py-2 border whitespace-nowrap font-display text-[11px] sm:text-xs tracking-wider transition-all ${
                  isActive
                    ? "bg-[#111726] border-[#C5A059] border-b-2 border-b-[#C5A059] text-[#F3EFE6] font-bold shadow-[inset_0_0_0_1px_rgba(197,160,89,0.35)]"
                    : "bg-[#0B0E14]/85 border-[#8A6D3B]/40 text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059]/65"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
