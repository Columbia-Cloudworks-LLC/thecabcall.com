"use client";

import React from "react";
import Link from "next/link";
import { X, Compass, Cpu, HelpCircle, ArrowRight } from "lucide-react";
import {
  getFailureModeHref,
  getSreFailureModeSpec,
  getWorkingToolHref,
  getWorkingToolSpec,
} from "@/lib/taxonomy";
import { useTelemetry } from "./TelemetryContext";
import { FailureModeEngraving, WorkingToolEngraving } from "./MasonicEngravings";
import { HairlineSection } from "./ui/BroadsheetPrimitives";

export function RubricInspectorDrawer() {
  const {
    inspectedTool,
    inspectedFailureMode,
    closeRubricInspector,
  } = useTelemetry();

  if (!inspectedTool && !inspectedFailureMode) return null;

  const toolSpec = inspectedTool ? getWorkingToolSpec(inspectedTool) : null;
  const failureSpec = inspectedFailureMode
    ? getSreFailureModeSpec(inspectedFailureMode)
    : toolSpec
    ? getSreFailureModeSpec(toolSpec.pairedFailureMode)
    : null;

  const primaryHubHref = toolSpec
    ? getWorkingToolHref(toolSpec.id)
    : failureSpec
    ? getFailureModeHref(failureSpec.id)
    : "/rubric";

  const primaryHubLabel = toolSpec
    ? `Explore ${toolSpec.id} Hub`
    : failureSpec
    ? `Explore ${failureSpec.craftShortLabel} Hub`
    : "Explore Rubric Codex";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs"
      onClick={closeRubricInspector}
    >
      <aside
        className="relative w-full max-w-lg bg-[#0B0E14] border-l border-[#C5A059]/60 h-full overflow-y-auto p-6 sm:p-8 shadow-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
        aria-label="Rubric Diagnostic Inspection Drawer"
      >
        <div className="space-y-6">
          {/* Header (1 Eyebrow + 1 Heading) */}
          <div className="flex items-start justify-between border-b border-[#8A6D3B]/40 pb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059] block">
                The Rubric · Diagnostic Codex
              </span>
              <h2 className="font-display text-2xl text-[#F3EFE6] mt-1">
                {toolSpec
                  ? toolSpec.id
                  : failureSpec?.craftTitle || failureSpec?.id}
              </h2>
            </div>
            <button
              onClick={closeRubricInspector}
              className="p-1.5 text-[#94A3B8] hover:text-[#F3EFE6] cursor-pointer"
              aria-label="Close Rubric Drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Working Tool Detail (Flattened with Hairline Dividers) */}
          {toolSpec && (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-2">
                <WorkingToolEngraving
                  tool={toolSpec.id}
                  className="w-48 h-28"
                />
              </div>

              <HairlineSection
                eyebrow={
                  <span className="inline-flex items-center gap-1.5 text-[#C5A059]">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Moral &amp; Philosophical Lens</span>
                  </span>
                }
                title={toolSpec.moralLens}
              >
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  {toolSpec.moralDefinition}
                </p>
              </HairlineSection>

              <HairlineSection
                eyebrow={
                  <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Shop-Floor &amp; Operational Equivalent</span>
                  </span>
                }
                title={toolSpec.sreEquivalent}
              >
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  {toolSpec.sreDefinition}
                </p>
              </HairlineSection>

              <HairlineSection
                eyebrow={
                  <span className="inline-flex items-center gap-1.5 text-[#C5A059]">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Core Diagnostic Inquiry Pattern</span>
                  </span>
                }
              >
                <p className="font-serif text-base italic text-[#F3EFE6] leading-relaxed">
                  &ldquo;{toolSpec.diagnosticQuestionPattern}&rdquo;
                </p>
              </HairlineSection>
            </div>
          )}

          {/* SRE Failure Mode Detail (Flattened with Hairline Dividers) */}
          {failureSpec && (
            <HairlineSection
              eyebrow="PRIMARY PAIRED STRUCTURAL FAILURE MODE"
              rightMeta={`Severity: ${failureSpec.severity.toUpperCase()}`}
              title={
                <Link
                  href={getFailureModeHref(failureSpec.id)}
                  onClick={closeRubricInspector}
                  className="hover:text-[#C5A059] transition-colors"
                >
                  {failureSpec.craftTitle}
                </Link>
              }
            >
              {!toolSpec && (
                <div className="flex flex-col items-center py-2">
                  <FailureModeEngraving
                    failureMode={failureSpec.id}
                    size={128}
                  />
                </div>
              )}

              <p className="text-sm text-[#F3EFE6]/90 leading-relaxed">
                {failureSpec.summary}
              </p>

              <div className="pt-3 border-t border-[#8A6D3B]/25 space-y-2">
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  <strong className="text-[#F3EFE6] font-mono uppercase">
                    Shop-Floor Mechanics:{" "}
                  </strong>
                  {failureSpec.systemsDefinition}
                </p>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  <strong className="text-[#F3EFE6] font-mono uppercase">
                    Civic / Institutional Pattern:{" "}
                  </strong>
                  {failureSpec.civicManifestation}
                </p>
              </div>
            </HairlineSection>
          )}
        </div>

        {/* Single Primary Footer CTA */}
        <div className="pt-5 mt-6 border-t border-[#8A6D3B]/40">
          <Link
            href={primaryHubHref}
            onClick={closeRubricInspector}
            className="w-full inline-flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider px-4 py-3 bg-[#C5A059] text-[#0B0E14] font-semibold hover:bg-[#d6b36a] transition-colors"
          >
            <span>{primaryHubLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </aside>
    </div>
  );
}
