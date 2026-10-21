import React from "react";
import Link from "next/link";

/**
 * Top-level Hero / Masthead Corner Brackets (Issue #51).
 * Restricted strictly to top-level hero or masthead containers—never nested inside child cards.
 */
export function HeroCornerBrackets({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  const dim =
    size === "sm"
      ? "w-2.5 h-2.5 border-[#C5A059]/75"
      : "w-3.5 h-3.5 border-2 border-[#C5A059]";
  const topLeft =
    size === "sm" ? "border-t border-l top-1.5 left-1.5" : "border-t-2 border-l-2 top-1 left-1";
  const topRight =
    size === "sm" ? "border-t border-r top-1.5 right-1.5" : "border-t-2 border-r-2 top-1 right-1";
  const bottomLeft =
    size === "sm"
      ? "border-b border-l bottom-1.5 left-1.5"
      : "border-b-2 border-l-2 bottom-1 left-1";
  const bottomRight =
    size === "sm"
      ? "border-b border-r bottom-1.5 right-1.5"
      : "border-b-2 border-r-2 bottom-1 right-1";

  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${topLeft} ${dim} ${className}`.trim()}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${topRight} ${dim} ${className}`.trim()}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${bottomLeft} ${dim} ${className}`.trim()}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute ${bottomRight} ${dim} ${className}`.trim()}
      />
    </>
  );
}

export interface SectionHeaderProps {
  id?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  withTopRule?: boolean;
  withBottomRule?: boolean;
  className?: string;
}

/**
 * Standardized SectionHeader Primitive (Issue #51).
 * Enforces: 1 Eyebrow + 1 Heading (<h2>) + Optional 1-Sentence Subtitle maximum,
 * replacing triple-stacked <BrassSectionDivider /> + // dual-subtitle + <h2> combinations.
 */
export function SectionHeader({
  id,
  eyebrow,
  title,
  subtitle,
  action,
  as: HeadingTag = "h2",
  withTopRule = false,
  withBottomRule = true,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      id={id}
      className={`${
        withTopRule ? "pt-8 border-t border-[#8A6D3B]/35 " : ""
      }${
        withBottomRule ? "pb-4 border-b border-[#8A6D3B]/35 " : ""
      }flex flex-col sm:flex-row sm:items-end justify-between gap-3 ${className}`.trim()}
    >
      <div className="space-y-1">
        {eyebrow && (
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059]">
            {eyebrow}
          </div>
        )}
        <HeadingTag className="font-display text-lg sm:text-2xl text-[#F3EFE6] tracking-[0.06em]">
          {title}
        </HeadingTag>
        {subtitle && (
          <p className="font-serif text-sm text-[#94A3B8] max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export interface BroadsheetCardProps extends React.HTMLAttributes<HTMLElement> {
  as?: "div" | "article" | "section" | "aside";
  heroCornerBrackets?: boolean;
  children: React.ReactNode;
}

/**
 * Standardized BroadsheetCard Primitive (Issue #51).
 * Enforces Max 1 Border Depth (single hairline border, zero inner double-borders,
 * and corner brackets restricted strictly to top-level hero containers).
 */
export function BroadsheetCard({
  as: Component = "div",
  heroCornerBrackets = false,
  className = "",
  children,
  ...rest
}: BroadsheetCardProps) {
  return (
    <Component
      className={`tracing-board-frame p-6 ${className}`.trim()}
      {...rest}
    >
      {heroCornerBrackets && <HeroCornerBrackets size="md" />}
      {children}
    </Component>
  );
}

export interface InteractiveCardLinkProps {
  id?: string;
  href?: string;
  onClick?: () => void;
  eyebrow?: React.ReactNode;
  badge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  ctaLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * InteractiveCardLink Primitive (Issue #51).
 * Enforces Max 1 Border Depth and One Primary Action Per Card (whole-card link or button
 * with a clean hover state and zero competing nested button bars).
 */
export function InteractiveCardLink({
  id,
  href,
  onClick,
  eyebrow,
  badge,
  title,
  subtitle,
  ctaLabel,
  className = "",
  children,
}: InteractiveCardLinkProps) {
  const baseClassName = `group tracing-board-frame p-5 sm:p-6 flex flex-col justify-between gap-4 text-left transition-all duration-200 ease-out hover:border-[#C5A059] cursor-pointer ${className}`.trim();

  const innerContent = (
    <>
      <div className="space-y-3">
        {(eyebrow || badge) && (
          <div className="flex items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-wider">
            <span className="text-[#C5A059] font-semibold">{eyebrow}</span>
            {badge && <span className="text-[#94A3B8]">{badge}</span>}
          </div>
        )}
        <h3 className="font-display text-lg sm:text-xl text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors leading-snug">
          {title}
        </h3>
        {subtitle && (
          <p className="font-serif text-sm text-[#94A3B8] leading-relaxed">
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {ctaLabel && (
        <div className="pt-3 border-t border-[#8A6D3B]/30 flex items-center justify-between font-mono text-xs uppercase tracking-wider text-[#C5A059] group-hover:text-[#F3EFE6] transition-colors">
          <span>{ctaLabel}</span>
          <span aria-hidden="true">→</span>
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link id={id} href={href} className={baseClassName}>
        {innerContent}
      </Link>
    );
  }

  return (
    <button id={id} type="button" onClick={onClick} className={baseClassName}>
      {innerContent}
    </button>
  );
}

export interface HairlineSectionProps {
  id?: string;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  rightMeta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * HairlineSection Primitive (Issue #51).
 * Standardized child section separator (border-t border-[#8A6D3B]/30 pt-5) for use
 * inside drawers, sidebars, and admin inspectors instead of inner bordered boxes.
 */
export function HairlineSection({
  id,
  eyebrow,
  title,
  rightMeta,
  className = "",
  children,
}: HairlineSectionProps) {
  return (
    <section
      id={id}
      className={`border-t border-[#8A6D3B]/30 pt-5 space-y-3 ${className}`.trim()}
    >
      {(eyebrow || title || rightMeta) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            {eyebrow && (
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
                {eyebrow}
              </div>
            )}
            {title && (
              <h3 className="font-display text-base sm:text-lg text-[#F3EFE6] mt-0.5">
                {title}
              </h3>
            )}
          </div>
          {rightMeta && (
            <div className="font-mono text-xs text-[#94A3B8]">{rightMeta}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export interface DirectoryListItem {
  id?: string;
  name: React.ReactNode;
  category?: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

export interface DirectoryListProps {
  items: DirectoryListItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

/**
 * DirectoryList Primitive (Issue #51).
 * Borderless multi-column typographic list primitive for high-density directories
 * (such as the 51-publication ledger on /status) eliminating card walls and repeated footers.
 */
export function DirectoryList({
  items,
  columns = 3,
  className = "",
}: DirectoryListProps) {
  const gridCols =
    columns === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : columns === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <ul
      className={`grid ${gridCols} gap-x-8 gap-y-1 ${className}`.trim()}
      role="list"
    >
      {items.map((item, idx) => {
        const key = item.id || `dir-item-${idx}`;
        const rowBody = (
          <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-[#8A6D3B]/25">
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm text-[#F3EFE6] group-hover:text-[#C5A059] transition-colors truncate">
                {item.name}
              </div>
              {item.category && (
                <div className="font-serif text-xs text-[#94A3B8] truncate">
                  {item.category}
                </div>
              )}
            </div>
            {item.meta && (
              <span className="font-mono text-[11px] text-[#C5A059] shrink-0">
                {item.meta}
              </span>
            )}
          </div>
        );

        if (item.href) {
          return (
            <li key={key}>
              <Link href={item.href} className="group block">
                {rowBody}
              </Link>
            </li>
          );
        }

        if (item.onClick) {
          return (
            <li key={key}>
              <button
                type="button"
                onClick={item.onClick}
                className="group block w-full text-left cursor-pointer"
              >
                {rowBody}
              </button>
            </li>
          );
        }

        return <li key={key}>{rowBody}</li>;
      })}
    </ul>
  );
}
