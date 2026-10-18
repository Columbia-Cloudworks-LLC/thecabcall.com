"use client";

import React from "react";
import Link from "next/link";
import { X, Compass, Cpu, HelpCircle, ArrowRight } from "lucide-react";
import {
  getSreFailureModeSpec,
  getWorkingToolSpec,
} from "@/lib/taxonomy";
import { useTelemetry } from "./TelemetryContext";
import { WorkingToolEngraving } from "./MasonicEngravings";

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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs"
      onClick={closeRubricInspector}
    >
      <aside
        className="relative w-full max-w-lg bg-[#0B0E14] border-l border-[#C5A059]/60 h-full overflow-y-auto p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label="Rubric Diagnostic Inspection Drawer"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#8A6D3B]/40 pb-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#C5A059]">
              THE RUBRIC // DIAGNOSTIC CODEX
            </span>
            <h2 className="font-display text-2xl text-[#F3EFE6] mt-1">
              {toolSpec
                ? toolSpec.id
                : failureSpec?.craftTitle || failureSpec?.id}
            </h2>
          </div>
          <button
            onClick={closeRubricInspector}
            className="p-1.5 border border-[#8A6D3B]/50 text-[#94A3B8] hover:text-[#F3EFE6] hover:border-[#C5A059] cursor-pointer"
            aria-label="Close Rubric Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Working Tool Detail */}
        {toolSpec && (
          <div className="mt-6 space-y-5">
            <div className="p-4 bg-[#111726] border border-[#8A6D3B]/50 flex flex-col items-center">
              <WorkingToolEngraving
                tool={toolSpec.id}
                className="w-48 h-28"
              />
              <span className="font-mono text-[11px] text-[#94A3B8] mt-2">
                {toolSpec.engravingCaption}
              </span>
            </div>

            <div className="p-4 bg-[#111726]/80 border border-[#C5A059]/35">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#C5A059]">
                <Compass className="w-3.5 h-3.5" />
                <span>Moral &amp; Philosophical Lens</span>
              </div>
              <p className="text-sm font-semibold text-[#F3EFE6] mt-1.5">
                {toolSpec.moralLens}
              </p>
              <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
                {toolSpec.moralDefinition}
              </p>
            </div>

            <div className="p-4 bg-[#111726]/80 border border-[#8A6D3B]/40">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#10B981]">
                <Cpu className="w-3.5 h-3.5" />
                <span>Shop-Floor &amp; Operational Equivalent</span>
              </div>
              <p className="text-sm font-semibold text-[#F3EFE6] mt-1.5">
                {toolSpec.sreEquivalent}
              </p>
              <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
                {toolSpec.sreDefinition}
              </p>
            </div>

            <div className="p-4 bg-[#0B0E14] border-2 border-double border-[#C5A059]/60">
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#C5A059]">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Core Diagnostic Inquiry Pattern</span>
              </div>
              <p className="font-display text-base italic text-[#F3EFE6] mt-2">
                &ldquo;{toolSpec.diagnosticQuestionPattern}&rdquo;
              </p>
              <div className="mt-3 pt-3 border-t border-[#8A6D3B]/30">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] block">
                  Diagnostic Classification Criteria:
                </span>
                <p className="font-mono text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  {toolSpec.jevClassifierCriteria}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Link
                href={`/knowledge-graph?tool=${encodeURIComponent(toolSpec.id)}`}
                onClick={closeRubricInspector}
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-4 py-2.5 bg-[#C5A059] text-[#0B0E14] font-semibold hover:bg-[#d6b36a] transition-colors"
              >
                <span>Query All {toolSpec.id} Incidents</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/rubric"
                onClick={closeRubricInspector}
                className="font-mono text-xs text-[#C5A059] hover:underline"
              >
                Full Rubric Codex →
              </Link>
            </div>
          </div>
        )}

        {/* SRE Failure Mode Detail */}
        {failureSpec && (
          <div className="mt-6 pt-6 border-t border-[#8A6D3B]/40 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-[#F59E0B]">
                PAIRED STRUCTURAL FAILURE MODE
              </span>
              <span className="font-mono text-[11px] uppercase px-2 py-0.5 border border-[#F59E0B]/50 text-[#F59E0B]">
                Severity: {failureSpec.severity}
              </span>
            </div>
            <h3 className="font-display text-lg text-[#F3EFE6]">
              {failureSpec.craftTitle}
            </h3>
            <p className="text-sm text-[#F3EFE6]/90 leading-relaxed">
              {failureSpec.summary}
            </p>
            <div className="p-3.5 bg-[#111726] border border-[#8A6D3B]/40 space-y-2">
              <p className="text-xs text-[#94A3B8]">
                <strong className="text-[#F3EFE6] font-mono uppercase">
                  Shop-Floor Mechanics:{" "}
                </strong>
                {failureSpec.systemsDefinition}
              </p>
              <p className="text-xs text-[#94A3B8]">
                <strong className="text-[#F3EFE6] font-mono uppercase">
                  Civic / Institutional Pattern:{" "}
                </strong>
                {failureSpec.civicManifestation}
              </p>
            </div>
            <Link
              href={`/knowledge-graph?failure=${encodeURIComponent(
                failureSpec.id
              )}`}
              onClick={closeRubricInspector}
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-3.5 py-2 border border-[#C5A059]/60 text-[#C5A059] hover:bg-[#C5A059]/10 transition-colors"
            >
              <span>Filter Archive by {failureSpec.craftShortLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
