import React from "react";
import { WORKING_TOOLS, WorkingToolId } from "@/lib/taxonomy";
import { ToolProbabilityDistribution } from "@/lib/types";

export function SquareAndCompassesCrest({
  className = "w-10 h-10",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`cab-seal-emblem ${className}`}
      style={{ filter: "drop-shadow(0 0 10px rgba(212, 175, 55, 0.18))" }}
      aria-label="Square and Compasses Telemetry Seal"
    >
      <defs>
        <radialGradient id="cabSealBacking" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#111726" />
          <stop offset="68%" stopColor="#070A10" />
          <stop offset="100%" stopColor="#05070C" />
        </radialGradient>
      </defs>

      {/* Solid Interior Backing ("The Seal") preventing checkerboard bleed-through */}
      <circle cx="60" cy="60" r="56.5" fill="#070A10" />
      <circle cx="60" cy="60" r="55.5" fill="url(#cabSealBacking)" />

      {/* Outer copperplate double ring with degree ticks (rotates 15deg over 600ms on brand hover) */}
      <g
        className="cab-seal-degree-ring transition-transform duration-[600ms] ease-out group-hover:rotate-[15deg]"
        style={{ transformOrigin: "60px 60px" }}
      >
        <circle
          cx="60"
          cy="60"
          r="56"
          stroke="#C5A059"
          strokeWidth="1.2"
          strokeOpacity="0.8"
        />
        <circle
          cx="60"
          cy="60"
          r="51"
          stroke="#8A6D3B"
          strokeWidth="0.85"
          strokeDasharray="2 3"
        />
        {/* Cardinal & intercardinal degree crosshair ticks */}
        <line x1="60" y1="2" x2="60" y2="10" stroke="#C5A059" strokeWidth="1.3" />
        <line x1="60" y1="110" x2="60" y2="118" stroke="#C5A059" strokeWidth="1.3" />
        <line x1="2" y1="60" x2="10" y2="60" stroke="#C5A059" strokeWidth="1.3" />
        <line x1="110" y1="60" x2="118" y2="60" stroke="#C5A059" strokeWidth="1.3" />
        <line x1="19" y1="19" x2="24" y2="24" stroke="#8A6D3B" strokeWidth="0.9" />
        <line x1="101" y1="19" x2="96" y2="24" stroke="#8A6D3B" strokeWidth="0.9" />
        <line x1="19" y1="101" x2="24" y2="96" stroke="#8A6D3B" strokeWidth="0.9" />
        <line x1="101" y1="101" x2="96" y2="96" stroke="#8A6D3B" strokeWidth="0.9" />
      </g>

      {/* Engraved inner sanctuary ring & radiating sun-lines in background */}
      <circle
        cx="60"
        cy="60"
        r="45"
        stroke="#C5A059"
        strokeWidth="0.45"
        strokeOpacity="0.28"
      />
      <circle
        cx="60"
        cy="58"
        r="24"
        stroke="#C5A059"
        strokeWidth="0.55"
        strokeOpacity="0.35"
      />

      {/* The Square (Right-angled ashlar try-square) */}
      <path
        d="M24 54 L60 90 L96 54 L89 47 L60 76 L31 47 Z"
        stroke="#C5A059"
        strokeWidth="1.45"
        fill="#0B0E14"
      />
      {/* Fine copperplate hatching inside The Square */}
      <line x1="35" y1="58" x2="60" y2="83" stroke="#8A6D3B" strokeWidth="0.75" />
      <line x1="85" y1="58" x2="60" y2="83" stroke="#8A6D3B" strokeWidth="0.75" />

      {/* The Compasses (Elevated above the Square) */}
      <path
        d="M60 22 L33 88 L40 85 L60 35 L80 85 L87 88 Z"
        stroke="#F3EFE6"
        strokeWidth="1.35"
        fill="#111726"
      />
      {/* Compass Hinge & Boss */}
      <circle
        cx="60"
        cy="22"
        r="5.5"
        stroke="#C5A059"
        strokeWidth="1.4"
        fill="#0B0E14"
      />
      <circle cx="60" cy="22" r="2" fill="#C5A059" />

      {/* Center All-Seeing Telemetry Node / Plumb Axis */}
      <polygon
        points="60,48 67,58 60,68 53,58"
        stroke="#C5A059"
        strokeWidth="1.1"
        fill="#0B0E14"
      />
      <circle cx="60" cy="58" r="2.2" fill="#C5A059" />
    </svg>
  );
}

export function BrassSectionDivider({ label }: { label?: string }) {
  return (
    <div className="relative flex items-center justify-center my-8 select-none">
      <div className="flex-grow border-t border-[#8A6D3B]/50" />
      <div className="mx-4 flex items-center gap-2.5 text-[#C5A059]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          className="opacity-90"
        >
          <polygon
            points="10,1 19,10 10,19 1,10"
            stroke="#C5A059"
            strokeWidth="1.2"
          />
          <polygon
            points="10,4.5 15.5,10 10,15.5 4.5,10"
            stroke="#8A6D3B"
            strokeWidth="0.8"
          />
          <circle cx="10" cy="10" r="2" fill="#C5A059" />
        </svg>
        {label && (
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C5A059]/90">
            {label}
          </span>
        )}
        {label && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            className="opacity-90"
          >
            <polygon
              points="10,1 19,10 10,19 1,10"
              stroke="#C5A059"
              strokeWidth="1.2"
            />
            <circle cx="10" cy="10" r="2" fill="#C5A059" />
          </svg>
        )}
      </div>
      <div className="flex-grow border-t border-[#8A6D3B]/50" />
    </div>
  );
}

export function MasonSquareWatermark({
  className = "w-64 h-64",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer faint geometric construction circle & plumb axis */}
      <circle
        cx="110"
        cy="110"
        r="96"
        stroke="#C5A059"
        strokeWidth="0.8"
        strokeDasharray="4 4"
      />
      <circle
        cx="110"
        cy="110"
        r="88"
        stroke="#C5A059"
        strokeWidth="0.5"
      />
      {/* 18th-Century Copperplate Try-Square (L-Square) */}
      <path
        d="M44 36 L74 36 L74 146 L184 146 L184 176 L44 176 Z"
        stroke="#C5A059"
        strokeWidth="2"
        fill="none"
      />
      {/* Inner recessed brass molding */}
      <path
        d="M50 42 L68 42 L68 152 L178 152 L178 170 L50 170 Z"
        stroke="#C5A059"
        strokeWidth="0.9"
        fill="none"
      />
      {/* Miter joint line at 45 degrees in the heel */}
      <line
        x1="44"
        y1="176"
        x2="74"
        y2="146"
        stroke="#C5A059"
        strokeWidth="1.2"
      />
      {/* Copperplate cross-hatching lines along vertical blade */}
      {Array.from({ length: 14 }).map((_, i) => {
        const y = 48 + i * 7;
        return (
          <line
            key={`v-${i}`}
            x1="52"
            y1={y}
            x2="66"
            y2={y - 4}
            stroke="#C5A059"
            strokeWidth="0.65"
          />
        );
      })}
      {/* Copperplate cross-hatching lines along horizontal blade */}
      {Array.from({ length: 14 }).map((_, i) => {
        const x = 82 + i * 7;
        return (
          <line
            key={`h-${i}`}
            x1={x}
            y1="154"
            x2={x - 4}
            y2="168"
            stroke="#C5A059"
            strokeWidth="0.65"
          />
        );
      })}
      {/* Scale graduations along inner edge */}
      {Array.from({ length: 9 }).map((_, i) => {
        const offset = 86 + i * 10;
        return (
          <line
            key={`tick-h-${i}`}
            x1={offset}
            y1="146"
            x2={offset}
            y2={i % 2 === 0 ? "155" : "151"}
            stroke="#C5A059"
            strokeWidth="0.9"
          />
        );
      })}
      {Array.from({ length: 9 }).map((_, i) => {
        const offset = 50 + i * 10;
        return (
          <line
            key={`tick-v-${i}`}
            x1="74"
            y1={offset}
            x2={i % 2 === 0 ? "65" : "69"}
            y2={offset}
            stroke="#C5A059"
            strokeWidth="0.9"
          />
        );
      })}
      {/* Right-angle geometric proof square in inner corner */}
      <rect
        x="74"
        y="126"
        width="20"
        height="20"
        stroke="#C5A059"
        strokeWidth="1"
      />
      <circle cx="84" cy="136" r="2" fill="#C5A059" />
    </svg>
  );
}

export function WorkingToolEngraving({
  tool,
  className = "w-24 h-24",
}: {
  tool: WorkingToolId;
  className?: string;
}) {
  switch (tool) {
    case "24-Inch Gauge":
      return (
        <svg
          viewBox="0 0 160 100"
          fill="none"
          className={className}
          aria-label="24-Inch Gauge Copperplate Engraving"
        >
          {/* Decorative Copperplate Frame */}
          <rect
            x="6"
            y="6"
            width="148"
            height="88"
            stroke="#8A6D3B"
            strokeWidth="0.75"
            strokeDasharray="3 2"
          />
          {/* The 24-Inch Rule Bar */}
          <rect
            x="16"
            y="40"
            width="128"
            height="20"
            stroke="#C5A059"
            strokeWidth="1.5"
            fill="#0B0E14"
          />
          <line
            x1="16"
            y1="54"
            x2="144"
            y2="54"
            stroke="#8A6D3B"
            strokeWidth="0.75"
          />
          {/* 3-Part Eight-Hour Divisions + 24 Sub-Ticks */}
          <line x1="58.6" y1="40" x2="58.6" y2="60" stroke="#F3EFE6" strokeWidth="1.2" />
          <line x1="101.3" y1="40" x2="101.3" y2="60" stroke="#F3EFE6" strokeWidth="1.2" />
          {Array.from({ length: 23 }).map((_, idx) => {
            const x = 16 + ((idx + 1) * 128) / 24;
            const isMajor = (idx + 1) % 4 === 0;
            return (
              <line
                key={idx}
                x1={x}
                y1="40"
                x2={x}
                y2={isMajor ? "51" : "46"}
                stroke="#C5A059"
                strokeWidth={isMajor ? "1.1" : "0.65"}
              />
            );
          })}
          <text x="34" y="33" fill="#C5A059" fontSize="8" fontFamily="monospace">
            VIII HRS
          </text>
          <text x="74" y="33" fill="#C5A059" fontSize="8" fontFamily="monospace">
            VIII HRS
          </text>
          <text x="116" y="33" fill="#C5A059" fontSize="8" fontFamily="monospace">
            VIII HRS
          </text>
          <text x="52" y="78" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
            FIG. I — XXIV INCH RULE
          </text>
        </svg>
      );

    case "Common Gavel":
      return (
        <svg
          viewBox="0 0 160 100"
          fill="none"
          className={className}
          aria-label="Common Gavel Copperplate Engraving"
        >
          <rect
            x="6"
            y="6"
            width="148"
            height="88"
            stroke="#8A6D3B"
            strokeWidth="0.75"
            strokeDasharray="3 2"
          />
          {/* Gavel Head (Chiseled Stone Maul with Peen) */}
          <path
            d="M48 22 L92 22 L108 32 L92 42 L48 42 L48 22 Z"
            stroke="#C5A059"
            strokeWidth="1.5"
            fill="#0B0E14"
          />
          {/* Copperplate Shading Lines */}
          <line x1="54" y1="26" x2="88" y2="26" stroke="#8A6D3B" strokeWidth="0.75" />
          <line x1="54" y1="38" x2="88" y2="38" stroke="#8A6D3B" strokeWidth="0.75" />
          {/* Handle */}
          <rect
            x="67"
            y="42"
            width="8"
            height="42"
            stroke="#F3EFE6"
            strokeWidth="1.2"
            fill="#111726"
          />
          <circle cx="71" cy="82" r="3" stroke="#C5A059" strokeWidth="1" />
          {/* Rough Ashlar Fragment Lines */}
          <path
            d="M114 28 L124 23 M116 32 L128 32 M114 36 L124 41"
            stroke="#C5A059"
            strokeWidth="1"
          />
          <text x="42" y="91" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
            FIG. II — SETTING MAUL
          </text>
        </svg>
      );

    case "The Plumb":
      return (
        <svg
          viewBox="0 0 160 100"
          fill="none"
          className={className}
          aria-label="The Plumb Copperplate Engraving"
        >
          <rect
            x="6"
            y="6"
            width="148"
            height="88"
            stroke="#8A6D3B"
            strokeWidth="0.75"
            strokeDasharray="3 2"
          />
          {/* Arch Frame */}
          <path
            d="M64 84 L64 24 C64 14 96 14 96 24 L96 84"
            stroke="#C5A059"
            strokeWidth="1.5"
          />
          <line x1="56" y1="84" x2="104" y2="84" stroke="#C5A059" strokeWidth="1.5" />
          {/* Plumb Cord & Bob */}
          <line
            x1="80"
            y1="17"
            x2="80"
            y2="60"
            stroke="#F3EFE6"
            strokeWidth="1.2"
            strokeDasharray="2 1"
          />
          <polygon
            points="80,60 87,70 80,80 73,70"
            stroke="#C5A059"
            strokeWidth="1.5"
            fill="#0B0E14"
          />
          <circle cx="80" cy="70" r="2" fill="#C5A059" />
          <text x="108" y="52" fill="#C5A059" fontSize="8" fontFamily="monospace">
            90.0°
          </text>
          <text x="44" y="92" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
            FIG. III — THE PLUMB RULE
          </text>
        </svg>
      );

    case "The Square":
      return (
        <svg
          viewBox="0 0 160 100"
          fill="none"
          className={className}
          aria-label="The Square Copperplate Engraving"
        >
          <rect
            x="6"
            y="6"
            width="148"
            height="88"
            stroke="#8A6D3B"
            strokeWidth="0.75"
            strokeDasharray="3 2"
          />
          {/* Right-Angled Try Square */}
          <path
            d="M42 18 L56 18 L56 64 L118 64 L118 78 L42 78 Z"
            stroke="#C5A059"
            strokeWidth="1.6"
            fill="#0B0E14"
          />
          {/* Right Angle Proof Box */}
          <rect
            x="56"
            y="52"
            width="12"
            height="12"
            stroke="#F3EFE6"
            strokeWidth="1"
          />
          {/* Measurement Ticks along Inner Edge */}
          {[68, 78, 88, 98, 108].map((x) => (
            <line
              key={x}
              x1={x}
              y1="64"
              x2={x}
              y2="70"
              stroke="#C5A059"
              strokeWidth="0.9"
            />
          ))}
          {[28, 38, 48, 58].map((y) => (
            <line
              key={y}
              x1="50"
              y1={y}
              x2="56"
              y2={y}
              stroke="#C5A059"
              strokeWidth="0.9"
            />
          ))}
          <text x="76" y="46" fill="#C5A059" fontSize="8" fontFamily="monospace">
            ⊥ 90° TRUE
          </text>
          <text x="42" y="91" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
            FIG. IV — MASTER SQUARE
          </text>
        </svg>
      );

    case "The Level":
      return (
        <svg
          viewBox="0 0 160 100"
          fill="none"
          className={className}
          aria-label="The Level Copperplate Engraving"
        >
          <rect
            x="6"
            y="6"
            width="148"
            height="88"
            stroke="#8A6D3B"
            strokeWidth="0.75"
            strokeDasharray="3 2"
          />
          {/* A-Frame Masonic Level */}
          <path
            d="M80 18 L30 74 L130 74 Z"
            stroke="#C5A059"
            strokeWidth="1.6"
            fill="#0B0E14"
          />
          <path
            d="M80 30 L46 68 L114 68 Z"
            stroke="#8A6D3B"
            strokeWidth="1"
            fill="#111726"
          />
          {/* Vertical Plumb Line inside Level */}
          <line
            x1="80"
            y1="30"
            x2="80"
            y2="64"
            stroke="#F3EFE6"
            strokeWidth="1.2"
          />
          <circle cx="80" cy="60" r="4" fill="#C5A059" />
          <text x="40" y="90" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
            FIG. V — HORIZONTAL LEVEL
          </text>
        </svg>
      );

    case "The Trowel":
      return (
        <svg
          viewBox="0 0 160 100"
          fill="none"
          className={className}
          aria-label="The Trowel Copperplate Engraving"
        >
          <rect
            x="6"
            y="6"
            width="148"
            height="88"
            stroke="#8A6D3B"
            strokeWidth="0.75"
            strokeDasharray="3 2"
          />
          {/* Diamond Trowel Blade */}
          <polygon
            points="28,50 86,24 102,50 86,76"
            stroke="#C5A059"
            strokeWidth="1.6"
            fill="#0B0E14"
          />
          <line
            x1="32"
            y1="50"
            x2="102"
            y2="50"
            stroke="#8A6D3B"
            strokeWidth="1"
          />
          {/* Shank & Wooden Handle */}
          <path
            d="M102 50 L114 50 L114 42 L138 42 L138 58 L114 58 L114 50"
            stroke="#F3EFE6"
            strokeWidth="1.3"
            fill="#111726"
          />
          <text x="38" y="90" fill="#94A3B8" fontSize="7.5" fontFamily="monospace">
            FIG. VI — CEMENT TROWEL
          </text>
        </svg>
      );
  }
}

export function ToolRadarChart({
  probabilities,
}: {
  probabilities: ToolProbabilityDistribution;
}) {
  const cx = 130;
  const cy = 120;
  const maxR = 78;

  const tools = WORKING_TOOLS.map((t, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const prob = probabilities[t.id] || 0;
    const normalizedR = Math.max(10, Math.min(maxR, prob * 1.45 * maxR));
    return {
      id: t.id,
      shortName: t.shortName,
      numeral: t.numeral,
      prob,
      angle,
      axisX: cx + Math.cos(angle) * maxR,
      axisY: cy + Math.sin(angle) * maxR,
      labelX: cx + Math.cos(angle) * (maxR + 24),
      labelY: cy + Math.sin(angle) * (maxR + 18),
      valX: cx + Math.cos(angle) * normalizedR,
      valY: cy + Math.sin(angle) * normalizedR,
    };
  });

  const polygonPoints = tools.map((p) => `${p.valX},${p.valY}`).join(" ");

  return (
    <svg
      viewBox="0 0 260 240"
      className="w-full max-w-[260px] mx-auto"
      aria-label="Working Tool Probability Radar Chart"
    >
      {/* Hexagonal Concentric Webs */}
      {[0.33, 0.66, 1].map((scale) => {
        const pts = tools
          .map(
            (t) =>
              `${cx + Math.cos(t.angle) * maxR * scale},${
                cy + Math.sin(t.angle) * maxR * scale
              }`
          )
          .join(" ");
        return (
          <polygon
            key={scale}
            points={pts}
            fill="none"
            stroke="#8A6D3B"
            strokeOpacity="0.35"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Axis Spokes */}
      {tools.map((t) => (
        <line
          key={t.id}
          x1={cx}
          y1={cy}
          x2={t.axisX}
          y2={t.axisY}
          stroke="#8A6D3B"
          strokeOpacity="0.4"
          strokeWidth="0.8"
        />
      ))}

      {/* Active Jev Probability Polygon */}
      <polygon
        points={polygonPoints}
        fill="#C5A059"
        fillOpacity="0.22"
        stroke="#C5A059"
        strokeWidth="1.75"
      />

      {/* Vertex Nodes & Roman Numeral Labels */}
      {tools.map((t) => (
        <g key={t.id}>
          <circle
            cx={t.valX}
            cy={t.valY}
            r="3.2"
            fill="#F3EFE6"
            stroke="#C5A059"
            strokeWidth="1.2"
          />
          <text
            x={t.labelX}
            y={t.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#F3EFE6"
            fontSize="9"
            fontFamily="monospace"
          >
            {t.numeral} ({Math.round(t.prob * 100)}%)
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Canonical Episode Artwork Emblem tile for weekly rollup episodes and image load fallback (Issue #37).
 * Renders a square lodge-room obsidian tile with burnished brass double-rule border, corner ticks,
 * centered Working Tool copperplate engraving, and subtle `EP. #XX` brass monospace badge.
 */
export function EpisodeArtworkEmblem({
  episodeNumber,
  tool,
  series = "weekly_rollup",
  className = "w-full h-full",
}: {
  episodeNumber: number;
  tool?: WorkingToolId;
  series?: "weekly_rollup" | "legacy_archive";
  className?: string;
}) {
  const paddedEp = String(episodeNumber).padStart(2, "0");

  return (
    <div
      className={`relative flex flex-col items-center justify-between bg-[#0B0E14] p-2 select-none overflow-hidden ${className}`}
      aria-label={`Episode #${episodeNumber} Copperplate Emblem`}
    >
      {/* Inner double-rule brass frame */}
      <div className="pointer-events-none absolute inset-1.5 border border-[#8A6D3B]/45" />
      {/* Corner brass ticks */}
      <span className="pointer-events-none absolute top-1 left-1 w-2 h-2 border-t border-l border-[#C5A059]" />
      <span className="pointer-events-none absolute top-1 right-1 w-2 h-2 border-t border-r border-[#C5A059]" />
      <span className="pointer-events-none absolute bottom-1 left-1 w-2 h-2 border-b border-l border-[#C5A059]" />
      <span className="pointer-events-none absolute bottom-1 right-1 w-2 h-2 border-b border-r border-[#C5A059]" />

      {/* Top micro header */}
      <span className="relative z-10 font-mono text-[8px] uppercase tracking-[0.18em] text-[#8A6D3B] pt-0.5">
        {series === "weekly_rollup" ? "CAB LEDGER" : "THE CAB CALL"}
      </span>

      {/* Centered Copperplate Engraving */}
      <div className="relative z-10 flex items-center justify-center my-auto w-16 h-12 sm:w-20 sm:h-14">
        {tool ? (
          <WorkingToolEngraving
            tool={tool}
            className="w-full h-full opacity-95"
          />
        ) : (
          <SquareAndCompassesCrest className="w-11 h-11 opacity-95" />
        )}
      </div>

      {/* Bottom EP. #XX brass monospace badge */}
      <span className="relative z-10 font-mono text-[9px] font-semibold uppercase tracking-widest text-[#C5A059] bg-[#131822]/90 border border-[#8A6D3B]/50 px-1.5 py-0.5 leading-none">
        EP. #{paddedEp}
      </span>
    </div>
  );
}

