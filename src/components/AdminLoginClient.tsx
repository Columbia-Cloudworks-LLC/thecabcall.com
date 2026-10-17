"use client";

import React, { useState } from "react";
import Link from "next/link";

interface AdminLoginClientProps {
  ownerEmailHint?: string;
  initialErrorCode?: string;
  initialErrorMessage?: string;
  initialEmail?: string;
  nextPath?: string;
}

export function AdminLoginClient({
  initialErrorCode,
  initialErrorMessage,
  initialEmail = "",
  nextPath = "/admin/users",
}: AdminLoginClientProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [magicResult, setMagicResult] = useState<{
    ok: boolean;
    message: string;
    expiresAt?: string;
  } | null>(null);

  const googleLoginHref = `/api/auth/google?next=${encodeURIComponent(
    nextPath
  )}`;

  async function handleRequestMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoadingMagic(true);
    setMagicResult(null);

    try {
      const response = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          purpose: "login",
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        emailSent?: boolean;
        emailError?: string;
        expiresAt?: string;
      };

      if (!response.ok || !data.ok) {
        setMagicResult({
          ok: false,
          message:
            data.error ||
            "403 Unauthorized Account: Only invited Change Advisory Board email addresses may request a Magic Link.",
        });
      } else {
        setMagicResult({
          ok: true,
          message: data.emailSent
            ? `Single-use cryptographic Magic Link dispatched to ${email
                .trim()
                .toLowerCase()}. Check your inbox (valid for 15 minutes).`
            : `Single-use Magic Link token generated for ${email
                .trim()
                .toLowerCase()}. (${
                data.emailError ||
                "Contact the Owner if automated mail is blocked by your domain."
              })`,
          expiresAt: data.expiresAt,
        });
      }
    } catch (err) {
      setMagicResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Failed to request Magic Link. Please try again.",
      });
    } finally {
      setLoadingMagic(false);
    }
  }

  return (
    <div className="min-h-[82vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-[#111622] border border-[#263147] rounded-lg shadow-2xl overflow-hidden">
        {/* Top Security Banner */}
        <div className="bg-[#161D2B] border-b border-[#263147] px-6 py-4 flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#C5A059] font-mono text-xs shrink-0 mt-0.5">
            🔒
          </span>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-[#C5A059] font-semibold">
              Security Gate // Immutable Audit Enforcement
            </div>
            <p className="text-xs text-[#D6D1C7] mt-1 leading-relaxed">
              Restricted Change Advisory Board Console — Access limited to the
              Owner and explicitly invited email addresses. All actions are
              recorded in the immutable audit ledger.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-7">
          {/* Header */}
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#8E9BAE]">
              THE CAB CALL // ADMIN AUTHENTICATION
            </div>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[#F3EFE6] mt-1">
              Change Advisory Board Console
            </h1>
            <p className="text-sm text-[#9CA3AF] mt-2">
              Authenticate with the Owner Google account or an explicitly
              invited Change Advisory Board email address.
            </p>
          </div>

          {/* Error Banner from OAuth / Magic Link Callback */}
          {(initialErrorCode || initialErrorMessage) && (
            <div
              role="alert"
              className="bg-red-950/50 border border-red-500/50 rounded-md p-4 text-xs text-red-200 space-y-1"
            >
              <div className="font-mono font-semibold uppercase tracking-wider text-red-300 flex items-center justify-between">
                <span>
                  403 Unauthorized Account{" "}
                  {initialErrorCode ? `(${initialErrorCode})` : ""}
                </span>
                <span className="text-[10px] bg-red-900/60 px-2 py-0.5 rounded">
                  LOGGED TO AUDIT LEDGER
                </span>
              </div>
              <p className="leading-relaxed">
                {initialErrorMessage ||
                  "Access denied: Your account is not on the Change Advisory Board allowlist."}
              </p>
            </div>
          )}

          {/* Primary Login: Google OAuth 2.0 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-[#C5A059]">
                1. Primary Owner &amp; Google Account Sign-In
              </span>
              <span className="font-mono text-[11px] text-[#8E9BAE]">
                OIDC / OAuth 2.0
              </span>
            </div>

            <a
              href={googleLoginHref}
              className="w-full flex items-center justify-center gap-3 bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-semibold py-3 px-5 rounded-md transition-colors shadow-md text-sm"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 1.81-1.5 3.34-3.2 4.37v3.62h5.18c3.03-2.79 4.78-6.9 4.78-11.78 0-.8-.08-1.57-.22-2.31z" />
                <path d="M12.18 22c4.32 0 7.95-1.43 10.6-3.88l-5.18-3.62c-1.43.96-3.27 1.53-5.42 1.53-4.17 0-7.7-2.81-8.96-6.6H-2.1v3.73C.54 18.41 5.94 22 12.18 22z" />
                <path d="M3.22 13.43a9.58 9.58 0 0 1 0-6.06V3.64H-2.1a16.02 16.02 0 0 0 0 13.52l5.32-3.73z" />
                <path d="M12.18 4.77c2.35 0 4.46.81 6.12 2.4l4.59-4.59C20.12.98 16.5 0 12.18 0 5.94 0 .54 3.59-2.1 8.84l5.32 3.73c1.26-3.79 4.79-6.6 8.96-6.6z" />
              </svg>
              <span>Continue with Google</span>
            </a>
            <p className="text-[11px] text-[#8E9BAE] leading-relaxed">
              Locked initially to the Owner Google account and invited users
              with verified Google Workspace / Gmail accounts.
            </p>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#263147]" />
            <span className="flex-shrink mx-4 font-mono text-[11px] uppercase tracking-widest text-[#6B7280]">
              OR SINGLE-USE MAGIC LINK
            </span>
            <div className="flex-grow border-t border-[#263147]" />
          </div>

          {/* Secondary Login: Passwordless Single-Use Magic Link */}
          <form onSubmit={handleRequestMagicLink} className="space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="magic-link-email"
                className="font-mono text-xs uppercase tracking-wider text-[#F3EFE6]"
              >
                2. Invited without Google? Sign in with Magic Link
              </label>
              <span className="font-mono text-[11px] text-[#8E9BAE]">
                SHA-256 Single-Use
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="magic-link-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="invited.user@organization.org"
                className="flex-1 bg-[#0B0E14] border border-[#263147] focus:border-[#C5A059] rounded-md px-3.5 py-2.5 text-sm text-[#F3EFE6] placeholder-[#6B7280] outline-none font-mono"
              />
              <button
                type="submit"
                disabled={loadingMagic}
                className="bg-[#1C2536] hover:bg-[#263147] border border-[#C5A059]/50 text-[#F3EFE6] font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                {loadingMagic ? "Dispatching..." : "Send Magic Link"}
              </button>
            </div>

            <p className="text-[11px] text-[#8E9BAE] leading-relaxed">
              Dispatches a 15-minute, single-use cryptographic login link to
              invited non-Google email addresses. Raw tokens are never stored in
              D1.
            </p>

            {magicResult && (
              <div
                className={`p-3.5 rounded-md border text-xs leading-relaxed ${
                  magicResult.ok
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
                    : "bg-red-950/40 border-red-500/40 text-red-200"
                }`}
              >
                <div className="font-mono font-semibold uppercase mb-1">
                  {magicResult.ok
                    ? "Magic Link Dispatched"
                    : "Magic Link Request Denied (403)"}
                </div>
                <p>{magicResult.message}</p>
              </div>
            )}
          </form>

          {/* Footer Links */}
          <div className="pt-4 border-t border-[#263147] flex flex-wrap items-center justify-between gap-2 text-xs text-[#8E9BAE] font-mono">
            <a
              href="https://thecabcall.com"
              className="hover:text-[#C5A059] transition-colors"
            >
              ← Return to Public Trestleboard (thecabcall.com)
            </a>
            <Link
              href="/api/admin/audit/verify"
              className="hover:text-[#C5A059] transition-colors"
            >
              Verify Audit Chain Integrity →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
