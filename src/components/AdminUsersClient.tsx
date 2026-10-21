"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AdminAuthProviderPref,
  AdminUserRecord,
  AdminUserRole,
  AuthenticatedAdminActor,
} from "@/pipeline/auth";
import type {
  AuditChainVerificationResult,
  AuditLedgerEntry,
} from "@/pipeline/audit";
import { HeroCornerBrackets } from "./ui/BroadsheetPrimitives";

interface AdminUsersClientProps {
  actor: AuthenticatedAdminActor;
  ownerEmail: string;
  initialUsers: AdminUserRecord[];
  initialAuditEntries: AuditLedgerEntry[];
  chainIntegrity?: AuditChainVerificationResult;
}

export function AdminUsersClient({
  actor,
  ownerEmail,
  initialUsers,
  initialAuditEntries,
  chainIntegrity,
}: AdminUsersClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserRecord[]>(initialUsers);
  const [auditEntries, setAuditEntries] =
    useState<AuditLedgerEntry[]>(initialAuditEntries);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<AdminUserRole>("editor");
  const [inviteAuthPref, setInviteAuthPref] =
    useState<AdminAuthProviderPref>("any");
  const [inviteReason, setInviteReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // Generated One-Time Link Drawer / Banner
  const [generatedLinkInfo, setGeneratedLinkInfo] = useState<{
    email: string;
    url: string;
    expiresAt: string;
    emailSent: boolean;
    emailError?: string;
    copied?: boolean;
  } | null>(null);

  // Action feedback
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRecord | null>(
    null
  );
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);

  // Role change modal state
  const [roleTarget, setRoleTarget] = useState<{
    user: AdminUserRecord;
    newRole: AdminUserRole;
  } | null>(null);
  const [roleReason, setRoleReason] = useState("");
  const [updatingRole, setUpdatingRole] = useState(false);

  const canManageUsers = actor.role === "owner" || actor.role === "admin";

  async function refreshUsersAndAudit() {
    try {
      const [usersRes, auditRes] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/audit?targetType=user&limit=25", {
          cache: "no-store",
        }),
      ]);
      if (usersRes.ok) {
        const uData = (await usersRes.json()) as { users?: AdminUserRecord[] };
        if (Array.isArray(uData.users)) {
          setUsers(uData.users);
        }
      }
      if (auditRes.ok) {
        const aData = (await auditRes.json()) as {
          entries?: AuditLedgerEntry[];
        };
        if (Array.isArray(aData.entries)) {
          setAuditEntries(aData.entries);
        }
      }
    } catch {
      // ignore refresh error
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSubmittingInvite(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          displayName: inviteDisplayName.trim() || undefined,
          role: inviteRole,
          authProviderPref: inviteAuthPref,
          reason:
            inviteReason.trim() ||
            `Invited ${inviteEmail.trim().toLowerCase()} as ${inviteRole}`,
          sendEmail,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        user?: AdminUserRecord;
        inviteUrl?: string;
        expiresAt?: string;
        emailSent?: boolean;
        emailError?: string;
      };

      if (!response.ok || !data.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to invite user.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: `Invited ${data.user?.email} (${data.user?.role.toUpperCase()}) and recorded user.invite in the immutable audit ledger.`,
        });
        if (data.inviteUrl) {
          setGeneratedLinkInfo({
            email: data.user?.email || inviteEmail.trim().toLowerCase(),
            url: data.inviteUrl,
            expiresAt: data.expiresAt || "",
            emailSent: Boolean(data.emailSent),
            emailError: data.emailError,
            copied: false,
          });
        }
        setInviteEmail("");
        setInviteDisplayName("");
        setInviteReason("");
        await refreshUsersAndAudit();
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to invite user.",
      });
    } finally {
      setSubmittingInvite(false);
    }
  }

  async function handleGenerateDirectMagicLink(user: AdminUserRecord) {
    setStatusMessage(null);
    try {
      const response = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          purpose: user.status === "invited" ? "invite" : "login",
          includeRawLink: true,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        magicLinkUrl?: string;
        expiresAt?: string;
        emailSent?: boolean;
        emailError?: string;
      };

      if (!response.ok || !data.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to generate Magic Link.",
        });
        return;
      }

      if (data.magicLinkUrl) {
        setGeneratedLinkInfo({
          email: user.email,
          url: data.magicLinkUrl,
          expiresAt: data.expiresAt || "",
          emailSent: Boolean(data.emailSent),
          emailError: data.emailError,
          copied: false,
        });
      }
      setStatusMessage({
        type: "success",
        text: `Generated single-use Magic Link for ${user.email}.`,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text:
          err instanceof Error ? err.message : "Failed to generate Magic Link.",
      });
    }
  }

  async function handleConfirmRevoke(e: React.FormEvent) {
    e.preventDefault();
    if (!revokeTarget) return;

    setRevoking(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/users/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: revokeTarget.id,
          email: revokeTarget.email,
          reason:
            revokeReason.trim() ||
            `Revoked access for ${revokeTarget.email} via Admin Users Console.`,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to revoke user.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: `Revoked ${revokeTarget.email}, invalidated all active sessions, and appended user.revoke to audit_ledger.`,
        });
        setRevokeTarget(null);
        setRevokeReason("");
        await refreshUsersAndAudit();
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to revoke user.",
      });
    } finally {
      setRevoking(false);
    }
  }

  async function handleConfirmRoleChange(e: React.FormEvent) {
    e.preventDefault();
    if (!roleTarget) return;

    setUpdatingRole(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: roleTarget.user.id,
          email: roleTarget.user.email,
          role: roleTarget.newRole,
          reason:
            roleReason.trim() ||
            `Updated role for ${roleTarget.user.email} from ${roleTarget.user.role} to ${roleTarget.newRole}.`,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || "Failed to update role.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: `Updated role for ${roleTarget.user.email} to ${roleTarget.newRole.toUpperCase()} and logged user.role_change to audit_ledger.`,
        });
        setRoleTarget(null);
        setRoleReason("");
        await refreshUsersAndAudit();
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update role.",
      });
    } finally {
      setUpdatingRole(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  function copyLinkToClipboard() {
    if (!generatedLinkInfo) return;
    navigator.clipboard.writeText(generatedLinkInfo.url);
    setGeneratedLinkInfo({ ...generatedLinkInfo, copied: true });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Section Header */}
      <div className="relative bg-[#111726] border border-[#8A6D3B]/45 rounded-md p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-lg">
        <HeroCornerBrackets size="sm" />
        <div className="space-y-1.5">
          <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059] font-semibold">
            Settings &amp; Audit • Team &amp; Access
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F3EFE6] tracking-wide">
            Team &amp; Access Governance
          </h1>
          <p className="font-serif text-sm text-[#E5E0D8]/85 max-w-3xl">
            Manage authorized Change Advisory Board accounts, single-use Magic
            Links, and role assignments. Every invite, role change, or
            revocation is recorded in the immutable audit ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/audit?targetType=user"
            className="px-3.5 py-2 rounded-sm bg-[#0B0E14] border border-[#8A6D3B]/45 hover:border-[#C5A059] text-xs font-mono text-[#E5E0D8] hover:text-[#C5A059] transition-colors"
          >
            View Access Audit History →
          </Link>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-sm border text-xs font-mono flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/40 border-red-500/40 text-red-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* One-Time Invite / Magic Link Copy Box */}
      {generatedLinkInfo && (
        <div className="bg-[#111726] border-2 border-[#C5A059] rounded-md p-5 space-y-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-[#C5A059] font-bold">
                Single-Use Cryptographic Magic Link Generated
              </span>
              <span
                className={`px-2 py-0.5 rounded-sm font-mono text-[10px] ${
                  generatedLinkInfo.emailSent
                    ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
                    : "bg-amber-950/60 border border-amber-500/40 text-amber-300"
                }`}
              >
                {generatedLinkInfo.emailSent
                  ? "RESEND EMAIL DISPATCHED"
                  : "DIRECT COPY FALLBACK"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setGeneratedLinkInfo(null)}
              className="text-xs font-mono text-[#9CA3AF] hover:text-[#F3EFE6] cursor-pointer"
            >
              Close ✕
            </button>
          </div>

          <p className="font-serif text-xs text-[#E5E0D8]">
            One-time login link for{" "}
            <strong className="font-mono text-[#F3EFE6]">
              {generatedLinkInfo.email}
            </strong>{" "}
            (expires{" "}
            <span className="font-mono">{generatedLinkInfo.expiresAt}</span>).
            Only the SHA-256 hash is stored in D1; copy this URL now if you wish
            to share it directly:
          </p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={generatedLinkInfo.url}
              className="flex-1 bg-[#0B0E14] border border-[#8A6D3B]/45 rounded-sm px-3 py-2 text-xs font-mono text-[#C5A059] select-all"
            />
            <button
              type="button"
              onClick={copyLinkToClipboard}
              className="bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-semibold uppercase px-4 py-2 rounded-sm transition-colors cursor-pointer shrink-0"
            >
              {generatedLinkInfo.copied ? "✓ Copied!" : "Copy One-Time Link"}
            </button>
          </div>
        </div>
      )}

      {/* Invite User Form */}
      {canManageUsers && (
        <div className="bg-[#111726] border border-[#8A6D3B]/45 rounded-md p-6 space-y-5 shadow-md">
          <div>
            <div className="font-display text-[11px] uppercase tracking-[0.18em] text-[#C5A059]">
              Invite Team Member
            </div>
            <h2 className="font-display text-xl font-bold text-[#F3EFE6] mt-1">
              Authorize New Change Advisory Board Account
            </h2>
            <p className="font-serif text-xs text-[#9CA3AF] mt-1">
              Invited users with Google accounts can click &ldquo;Continue with
              Google&rdquo;, while non-Google users can sign in via the
              single-use cryptographic Magic Link sent to their email.
            </p>
          </div>

          <form
            onSubmit={handleInviteSubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-4"
          >
            <div className="md:col-span-4 space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="reviewer@example.org"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] rounded-sm px-3 py-2 text-sm text-[#F3EFE6] font-mono outline-none"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Display Name
              </label>
              <input
                type="text"
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
                placeholder="Jane Doe (CAB Reviewer)"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] rounded-sm px-3 py-2 text-sm text-[#F3EFE6] outline-none"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Assigned Role *
              </label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as AdminUserRole)
                }
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] rounded-sm px-3 py-2 text-sm text-[#F3EFE6] font-mono outline-none"
              >
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
                <option value="auditor">Auditor (Read-Only)</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Auth Method Preference
              </label>
              <select
                value={inviteAuthPref}
                onChange={(e) =>
                  setInviteAuthPref(e.target.value as AdminAuthProviderPref)
                }
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] rounded-sm px-3 py-2 text-sm text-[#F3EFE6] font-mono outline-none"
              >
                <option value="any">Google OAuth or Magic Link</option>
                <option value="google">Google OAuth Preferred</option>
                <option value="magic_link">Magic Link Only (Non-Google)</option>
              </select>
            </div>

            <div className="md:col-span-8 space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Audit Disclosure Reason (Recorded in Immutable Ledger) *
              </label>
              <input
                type="text"
                required
                value={inviteReason}
                onChange={(e) => setInviteReason(e.target.value)}
                placeholder="Authorized by CAB Owner for editorial review and post-mortem verification"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 focus:border-[#C5A059] rounded-sm px-3 py-2 text-sm text-[#F3EFE6] outline-none"
              />
            </div>

            <div className="md:col-span-4 flex flex-col justify-end gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-[#E5E0D8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="accent-[#C5A059]"
                />
                <span>Send automated invite email via Resend</span>
              </label>
              <button
                type="submit"
                disabled={submittingInvite}
                className="w-full bg-[#C5A059] hover:bg-[#d4b26a] text-[#0B0E14] font-mono text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submittingInvite
                  ? "Authorizing & Auditing..."
                  : "Invite User & Generate Link"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[#111726] border border-[#8A6D3B]/45 rounded-md overflow-hidden shadow-md">
        <div className="px-6 py-4 border-b border-[#8A6D3B]/35 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#F3EFE6]">
              Authorized &amp; Invited Change Advisory Board Accounts (
              {users.length})
            </h2>
            <p className="font-serif text-xs text-[#9CA3AF]">
              Any email address not listed below with{" "}
              <code className="text-emerald-300 font-mono">active</code> or{" "}
              <code className="text-amber-300 font-mono">invited</code> status is strictly
              rejected with HTTP 403.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0B0E14] border-b border-[#8A6D3B]/35 font-mono text-[11px] uppercase text-[#9CA3AF]">
                <th className="py-3 px-4">User / Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Auth Pref</th>
                <th className="py-3 px-4">Active Sessions</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Governance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8A6D3B]/25">
              {users.map((u) => {
                const isOwnerRow =
                  u.role === "owner" ||
                  u.email.toLowerCase() === ownerEmail.toLowerCase();

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-[#0B0E14]/50 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-semibold text-[#F3EFE6]">
                        {u.email}
                      </div>
                      <div className="text-[11px] text-[#9CA3AF]">
                        {u.displayName || "—"}
                        {u.invitedByEmail
                          ? ` • Invited by ${u.invitedByEmail}`
                          : ""}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span
                        className={`inline-block uppercase text-[10px] font-semibold ${
                          u.role === "owner"
                            ? "text-[#C5A059]"
                            : u.role === "admin"
                            ? "text-sky-300"
                            : u.role === "editor"
                            ? "text-emerald-300"
                            : "text-purple-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span
                        className={`inline-block uppercase text-[10px] font-semibold ${
                          u.status === "active"
                            ? "text-emerald-300"
                            : u.status === "invited"
                            ? "text-amber-300"
                            : "text-red-300"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#E5E0D8]">
                      {u.authProviderPref}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#E5E0D8]">
                      {u.activeSessionCount ?? 0}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#9CA3AF]">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString()
                        : "Never"}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isOwnerRow ? (
                        <span className="font-mono text-[11px] text-[#C5A059]">
                          Primary Owner
                        </span>
                      ) : (
                        canManageUsers && (
                          <div className="inline-flex flex-wrap items-center justify-end gap-3">
                            {u.status !== "revoked" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleGenerateDirectMagicLink(u)
                                  }
                                  className="px-2.5 py-1 rounded-sm bg-[#0B0E14] hover:border-[#C5A059] border border-[#8A6D3B]/45 text-[#C5A059] font-mono text-[11px] cursor-pointer"
                                >
                                  Send / Copy Magic Link
                                </button>

                                <select
                                  aria-label={`Change role for ${u.email}`}
                                  value={u.role}
                                  onChange={(e) =>
                                    setRoleTarget({
                                      user: u,
                                      newRole: e.target.value as AdminUserRole,
                                    })
                                  }
                                  className="bg-[#0B0E14] border border-[#8A6D3B]/45 rounded-sm px-2 py-1 font-mono text-[11px] text-[#E5E0D8]"
                                >
                                  <option value="editor">Role: Editor</option>
                                  <option value="admin">Role: Admin</option>
                                  <option value="auditor">Role: Auditor</option>
                                </select>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRevokeTarget(u);
                                    setRevokeReason("");
                                  }}
                                  className="text-[#9CA3AF] hover:text-red-300 font-mono text-[11px] cursor-pointer transition-colors"
                                >
                                  Revoke
                                </button>
                              </>
                            )}

                            {u.status === "revoked" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInviteEmail(u.email);
                                  setInviteDisplayName(u.displayName || "");
                                  setInviteRole(u.role);
                                  setInviteReason(
                                    `Re-inviting previously revoked user ${u.email}`
                                  );
                                }}
                                className="text-amber-300 hover:text-amber-200 font-mono text-[11px] cursor-pointer transition-colors"
                              >
                                Re-Invite
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRevoke}
            className="bg-[#111726] border border-red-500/50 rounded-md max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="font-mono text-xs uppercase text-red-400 font-semibold">
              Confirm Access Revocation
            </div>
            <h3 className="font-display text-lg font-bold text-[#F3EFE6]">
              Revoke {revokeTarget.email}?
            </h3>
            <p className="font-serif text-xs text-[#E5E0D8] leading-relaxed">
              This will immediately set the user status to{" "}
              <code className="text-red-300 font-mono">revoked</code>, invalidate all
              active sessions and unused Magic Links, and append a permanent{" "}
              <code className="text-[#C5A059] font-mono">user.revoke</code> entry to{" "}
              <code className="font-mono">audit_ledger</code>.
            </p>
            <div className="space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Mandatory Audit Reason *
              </label>
              <input
                type="text"
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Completed review rotation / access no longer required"
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 rounded-sm px-3 py-2 text-xs text-[#F3EFE6] outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="px-3 py-1.5 rounded-sm border border-[#8A6D3B]/45 text-xs font-mono text-[#9CA3AF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={revoking}
                className="px-4 py-1.5 rounded-sm bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                {revoking ? "Revoking..." : "Confirm Revoke & Audit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Update Confirmation Modal */}
      {roleTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRoleChange}
            className="bg-[#111726] border border-[#C5A059]/60 rounded-md max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="font-mono text-xs uppercase text-[#C5A059] font-semibold">
              Confirm Role Update
            </div>
            <h3 className="font-display text-lg font-bold text-[#F3EFE6]">
              Change role for {roleTarget.user.email} to{" "}
              {roleTarget.newRole.toUpperCase()}?
            </h3>
            <div className="space-y-1">
              <label className="block font-mono text-[11px] uppercase text-[#9CA3AF]">
                Mandatory Audit Reason *
              </label>
              <input
                type="text"
                required
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder={`Updated role from ${roleTarget.user.role} to ${roleTarget.newRole}`}
                className="w-full bg-[#0B0E14] border border-[#8A6D3B]/45 rounded-sm px-3 py-2 text-xs text-[#F3EFE6] outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRoleTarget(null)}
                className="px-3 py-1.5 rounded-sm border border-[#8A6D3B]/45 text-xs font-mono text-[#9CA3AF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingRole}
                className="px-4 py-1.5 rounded-sm bg-[#C5A059] text-[#0B0E14] text-xs font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                {updatingRole ? "Saving..." : "Update Role & Audit"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtle Footer Link to Audit Ledger */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs font-mono text-[#9CA3AF]">
        <span>
          {auditEntries.length} recent access governance events recorded in the
          immutable ledger.
        </span>
        <div className="flex items-center gap-4">
          <a
            href="/api/admin/audit/export?targetType=user&format=md"
            className="text-[#C5A059] hover:underline"
          >
            Export Access Disclosure (.md)
          </a>
          <Link
            href="/admin/audit?targetType=user"
            className="text-[#C5A059] hover:underline"
          >
            Inspect in Audit Ledger →
          </Link>
        </div>
      </div>
    </div>
  );
}
