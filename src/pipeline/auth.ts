import {
  appendAuditEntry,
  AuditAuthMethod,
   AuditLedgerEntry,
  hashActorIp,
  sha256Hex,
} from "./audit";
import { D1DatabaseLike } from "./ingest";

export type AdminUserRole = "owner" | "admin" | "editor" | "auditor";
export type AdminAuthProviderPref = "google" | "magic_link" | "any";
export type AdminUserStatus = "active" | "invited" | "revoked";
export type AdminSessionAuthMethod = "google_oauth" | "magic_link";

export const DEFAULT_OWNER_EMAIL = "nicholas.king@columbiacloudworks.com";
export const ADMIN_SESSION_COOKIE_NAME = "cabcall_admin_session";
export const OAUTH_STATE_COOKIE_NAME = "cabcall_oauth_state";
export const LOGIN_MAGIC_LINK_TTL_MINUTES = 15;
export const INVITE_MAGIC_LINK_TTL_DAYS = 7;
export const SESSION_TTL_DAYS = 7;

export interface AdminUserRow {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: AdminUserRole;
  auth_provider_pref: AdminAuthProviderPref;
  status: AdminUserStatus;
  invited_by_email: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminUserRecord {
  id: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: AdminUserRole;
  authProviderPref: AdminAuthProviderPref;
  status: AdminUserStatus;
  invitedByEmail: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  activeSessionCount?: number;
}

export interface AdminMagicLinkRow {
  id: number;
  email: string;
  token_hash: string;
  purpose: "login" | "invite";
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface AdminSessionRow {
  id: number;
  session_token_hash: string;
  user_id: number;
  email: string;
  role: AdminUserRole;
  auth_method: AdminSessionAuthMethod;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface AuthenticatedAdminActor {
  userId: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: AdminUserRole;
  authMethod: AuditAuthMethod;
  sessionExpiresAt?: string;
}

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function generateSecureTokenHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashTokenSha256(rawToken: string): Promise<string> {
  return sha256Hex(rawToken.trim());
}

export function mapAdminUserRow(
  row: AdminUserRow,
  activeSessionCount?: number
): AdminUserRecord {
  return {
    id: Number(row.id),
    email: row.email,
    displayName: row.display_name || null,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    authProviderPref: row.auth_provider_pref || "any",
    status: row.status,
    invitedByEmail: row.invited_by_email || null,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || null,
    ...(activeSessionCount !== undefined ? { activeSessionCount } : {}),
  };
}

/**
 * Ensures `admin_users`, `admin_magic_links`, and `admin_sessions` tables exist
 * and guarantees that `OWNER_ADMIN_EMAIL` is present as `role = 'owner'` and `status = 'active'`.
 */
export async function ensureAdminAuthTablesAndOwner(
  db: D1DatabaseLike,
  ownerEmailInput?: string
): Promise<AdminUserRecord> {
  const ownerEmail = normalizeEmail(ownerEmailInput || DEFAULT_OWNER_EMAIL);

  try {
    await db
      .prepare("SELECT COUNT(*) as cnt FROM admin_users")
      .first<{ cnt: number }>();
  } catch {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT,
          avatar_url TEXT,
          role TEXT NOT NULL DEFAULT 'editor',
          auth_provider_pref TEXT NOT NULL DEFAULT 'any',
          status TEXT NOT NULL DEFAULT 'invited',
          invited_by_email TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_login_at TEXT
        )`
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)"
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status)"
      )
      .run();
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_magic_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          purpose TEXT NOT NULL DEFAULT 'login',
          expires_at TEXT NOT NULL,
          used_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_admin_magic_links_token_hash ON admin_magic_links(token_hash)"
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_admin_magic_links_email ON admin_magic_links(email)"
      )
      .run();
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS admin_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_token_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL,
          auth_method TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          revoked_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(session_token_hash)"
      )
      .run();
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id)"
      )
      .run();
  }

  let ownerRow = await db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
    .bind(ownerEmail)
    .first<AdminUserRow>();

  if (!ownerRow) {
    const nowIso = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO admin_users (
          email,
          display_name,
          role,
          auth_provider_pref,
          status,
          invited_by_email,
          created_at
        ) VALUES (?, ?, 'owner', 'google', 'active', 'system@thecabcall.com', ?)`
      )
      .bind(ownerEmail, "Nicholas King", nowIso)
      .run();

    ownerRow = await db
      .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
      .bind(ownerEmail)
      .first<AdminUserRow>();
  } else if (ownerRow.role !== "owner" || ownerRow.status !== "active") {
    await db
      .prepare(
        "UPDATE admin_users SET role = 'owner', status = 'active' WHERE id = ?"
      )
      .bind(ownerRow.id)
      .run();
    ownerRow = await db
      .prepare("SELECT * FROM admin_users WHERE id = ?")
      .bind(ownerRow.id)
      .first<AdminUserRow>();
  }

  if (!ownerRow) {
    throw new Error(`Failed to bootstrap owner account for ${ownerEmail}`);
  }

  return mapAdminUserRow(ownerRow);
}

/**
 * Lists all users in `admin_users` along with active session counts.
 */
export async function listAdminUsers(
  db: D1DatabaseLike,
  ownerEmail?: string
): Promise<AdminUserRecord[]> {
  await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const nowIso = new Date().toISOString();
  const [usersRes, sessionsRes] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM admin_users
         ORDER BY
           CASE role
             WHEN 'owner' THEN 0
             WHEN 'admin' THEN 1
             WHEN 'editor' THEN 2
             ELSE 3
           END ASC,
           id ASC`
      )
      .all<AdminUserRow>(),
    db
      .prepare(
        `SELECT user_id, COUNT(*) as cnt
         FROM admin_sessions
         WHERE revoked_at IS NULL AND expires_at > ?
         GROUP BY user_id`
      )
      .bind(nowIso)
      .all<{ user_id: number; cnt: number }>(),
  ]);

  const sessionCountMap = new Map<number, number>();
  for (const s of sessionsRes.results || []) {
    sessionCountMap.set(Number(s.user_id), Number(s.cnt));
  }

  return (usersRes.results || []).map((row) =>
    mapAdminUserRow(row, sessionCountMap.get(Number(row.id)) ?? 0)
  );
}

/**
 * Creates a signed/hashed session row in `admin_sessions` and returns the raw token
 * (to be stored in an HttpOnly cookie) alongside session metadata.
 */
export async function createAdminSession(
  db: D1DatabaseLike,
  user: AdminUserRow,
  authMethod: AdminSessionAuthMethod
): Promise<{
  rawSessionToken: string;
  sessionTokenHash: string;
  expiresAt: string;
}> {
  const rawSessionToken = generateSecureTokenHex(32);
  const sessionTokenHash = await hashTokenSha256(rawSessionToken);
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .prepare(
      `INSERT INTO admin_sessions (
        session_token_hash,
        user_id,
        email,
        role,
        auth_method,
        expires_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      sessionTokenHash,
      user.id,
      user.email,
      user.role,
      authMethod,
      expiresAt,
      now.toISOString()
    )
    .run();

  return {
    rawSessionToken,
    sessionTokenHash,
    expiresAt,
  };
}

/**
 * Verifies a raw session token against `admin_sessions` and `admin_users`.
 * Returns null if the token is missing, expired, revoked, or the user is no longer active.
 */
export async function verifyAdminSession(
  db: D1DatabaseLike,
  rawSessionToken: string | null | undefined,
  ownerEmail?: string
): Promise<AuthenticatedAdminActor | null> {
  if (!rawSessionToken || !rawSessionToken.trim()) {
    return null;
  }

  await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const tokenHash = await hashTokenSha256(rawSessionToken);
  const nowIso = new Date().toISOString();

  const row = await db
    .prepare(
      `SELECT
        s.id as session_id,
        s.user_id,
        s.auth_method,
        s.expires_at,
        s.revoked_at,
        u.email,
        u.display_name,
        u.avatar_url,
        u.role,
        u.status
       FROM admin_sessions s
       INNER JOIN admin_users u ON u.id = s.user_id
       WHERE s.session_token_hash = ?
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<{
      session_id: number;
      user_id: number;
      auth_method: AdminSessionAuthMethod;
      expires_at: string;
      revoked_at: string | null;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      role: AdminUserRole;
      status: AdminUserStatus;
    }>();

  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at <= nowIso) return null;
  if (row.status !== "active") return null;

  return {
    userId: Number(row.user_id),
    email: row.email,
    displayName: row.display_name || null,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    authMethod: row.auth_method,
    sessionExpiresAt: row.expires_at,
  };
}

/**
 * Revokes a single session token (used on sign-out).
 */
export async function revokeAdminSessionByToken(
  db: D1DatabaseLike,
  rawSessionToken: string | null | undefined
): Promise<boolean> {
  if (!rawSessionToken || !rawSessionToken.trim()) return false;
  const tokenHash = await hashTokenSha256(rawSessionToken);
  const nowIso = new Date().toISOString();
  await db
    .prepare(
      "UPDATE admin_sessions SET revoked_at = ? WHERE session_token_hash = ? AND revoked_at IS NULL"
    )
    .bind(nowIso, tokenHash)
    .run();
  return true;
}

/**
 * Verifies a Google OAuth user against `admin_users`, rejecting any uninvited or revoked
 * email address (and logging `auth.unauthorized_attempt` to `audit_ledger`).
 * Promotes `'invited'` users to `'active'` and creates an `admin_sessions` record.
 */
export async function authenticateGoogleOAuthUser(options: {
  db: D1DatabaseLike;
  ownerEmail?: string;
  email: string;
  emailVerified: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
  clientIp?: string | null;
}): Promise<{
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  user?: AdminUserRecord;
  rawSessionToken?: string;
  expiresAt?: string;
}> {
  const { db, ownerEmail, emailVerified, displayName, avatarUrl, clientIp } =
    options;
  await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const normalizedEmail = normalizeEmail(options.email);
  const ipHash = await hashActorIp(clientIp);

  if (!normalizedEmail || !emailVerified) {
    await appendAuditEntry(db, {
      actorEmail: normalizedEmail || "unverified@google.oauth",
      actorRole: "unauthorized",
      authMethod: "google_oauth",
      actorIpHash: ipHash,
      actionType: "auth.unauthorized_attempt",
      targetType: "user",
      targetId: normalizedEmail || "unknown",
      reason: "Rejected Google OAuth login with unverified email address.",
      beforeState: null,
      afterState: {
        email: normalizedEmail,
        emailVerified,
        provider: "google_oauth",
        decision: "deny",
      },
    });
    return {
      ok: false,
      status: 403,
      code: "EMAIL_NOT_VERIFIED",
      error: "Google account email address is not verified.",
    };
  }

  const existingUser = await db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
    .bind(normalizedEmail)
    .first<AdminUserRow>();

  if (!existingUser || existingUser.status === "revoked") {
    const denialReason = existingUser
      ? `Rejected Google OAuth login from revoked account (${normalizedEmail}).`
      : `Rejected Google OAuth login from uninvited account (${normalizedEmail}). Access is restricted to the Owner and invited emails.`;

    await appendAuditEntry(db, {
      actorEmail: normalizedEmail,
      actorRole: existingUser?.role || "unauthorized",
      authMethod: "google_oauth",
      actorIpHash: ipHash,
      actionType: "auth.unauthorized_attempt",
      targetType: "user",
      targetId: normalizedEmail,
      reason: denialReason,
      beforeState: existingUser || null,
      afterState: {
        email: normalizedEmail,
        status: existingUser?.status || "uninvited",
        provider: "google_oauth",
        decision: "deny_403",
      },
    });

    return {
      ok: false,
      status: 403,
      code: "UNAUTHORIZED_ACCOUNT",
      error: existingUser
        ? `Access for ${normalizedEmail} has been revoked by the Change Advisory Board.`
        : `Account ${normalizedEmail} is not authorized. Only the Owner and explicitly invited email addresses may sign in.`,
    };
  }

  const nowIso = new Date().toISOString();
  await db
    .prepare(
      `UPDATE admin_users
       SET status = 'active',
           display_name = COALESCE(?, display_name),
           avatar_url = COALESCE(?, avatar_url),
           last_login_at = ?
       WHERE id = ?`
    )
    .bind(displayName || null, avatarUrl || null, nowIso, existingUser.id)
    .run();

  const updatedRow = await db
    .prepare("SELECT * FROM admin_users WHERE id = ?")
    .bind(existingUser.id)
    .first<AdminUserRow>();

  const targetRow = updatedRow || existingUser;
  const session = await createAdminSession(db, targetRow, "google_oauth");

  return {
    ok: true,
    status: 200,
    user: mapAdminUserRow(targetRow),
    rawSessionToken: session.rawSessionToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * Dispatches a transactional Magic Link / Invitation email via Resend (`https://api.resend.com/emails`).
 * Automatically falls back to `The CAB Call <onboarding@resend.dev>` if the primary sender domain is not yet verified in Resend.
 */
export async function sendMagicLinkEmailViaResend(options: {
  resendApiKey?: string;
  emailFrom?: string;
  toEmail: string;
  displayName?: string | null;
  role?: AdminUserRole;
  purpose: "login" | "invite";
  magicLinkUrl: string;
  googleLoginUrl: string;
  expiresAt: string;
  invitedByEmail?: string | null;
  reason?: string;
}): Promise<{ sent: boolean; providerId?: string; error?: string }> {
  const apiKey = (options.resendApiKey || "").trim();
  if (!apiKey) {
    return {
      sent: false,
      error: "RESEND_API_KEY is not configured; use the copyable Magic Link URL.",
    };
  }

  const isInvite = options.purpose === "invite";
  const subject = isInvite
    ? `[The CAB Call] You've been invited to the Change Advisory Board Console (${(
        options.role || "editor"
      ).toUpperCase()})`
    : `[The CAB Call] Single-Use Magic Sign-In Link`;

  const html = `
    <div style="background-color:#0B0E14;color:#F3EFE6;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;border:1px solid #263147;max-width:600px;margin:0 auto;">
      <div style="border-bottom:1px solid #263147;padding-bottom:16px;margin-bottom:24px;">
        <div style="color:#C5A059;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">
          THE CAB CALL // CHANGE ADVISORY BOARD CONSOLE
        </div>
        <h1 style="margin:8px 0 0 0;font-size:20px;color:#F3EFE6;">
          ${
            isInvite
              ? "Administrative Console Invitation"
              : "Single-Use Cryptographic Sign-In Link"
          }
        </h1>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#D6D1C7;">
        ${
          isInvite
            ? `You have been invited by <strong>${
                options.invitedByEmail || "the Owner"
              }</strong> to access the <strong>thecabcall.com</strong> Admin Console with role <strong>${(
                options.role || "editor"
              ).toUpperCase()}</strong>.`
            : `A single-use passwordless Magic Link was requested for <strong>${options.toEmail}</strong>.`
        }
      </p>
      ${
        options.reason
          ? `<p style="font-size:12px;color:#9CA3AF;background:#121722;padding:10px 12px;border-left:3px solid #C5A059;"><strong>Audit Authorization Note:</strong> ${options.reason}</p>`
          : ""
      }
      <div style="margin:28px 0;">
        <a href="${
          options.magicLinkUrl
        }" style="display:inline-block;background-color:#C5A059;color:#0B0E14;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:4px;font-size:14px;">
          ${
            isInvite
              ? "Accept Invite & Sign In via Magic Link"
              : "Sign In with Single-Use Magic Link"
          }
        </a>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#9CA3AF;">
        <strong>Using a Google account?</strong> You can also sign in directly via Google OAuth at
        <a href="${options.googleLoginUrl}" style="color:#C5A059;">${
    options.googleLoginUrl
  }</a>.
      </p>
      <p style="font-size:12px;color:#6B7280;word-break:break-all;margin-top:20px;">
        Direct one-time link (expires ${options.expiresAt}):<br/>
        <a href="${options.magicLinkUrl}" style="color:#9CA3AF;">${
    options.magicLinkUrl
  }</a>
      </p>
      <div style="border-top:1px solid #263147;margin-top:28px;padding-top:14px;font-size:11px;color:#6B7280;font-family:monospace;">
        Restricted Change Advisory Board Console — All authentication events and editorial mutations are recorded in the SHA-256 immutable audit ledger.
      </div>
    </div>
  `.trim();

  const candidateSenders = [
    options.emailFrom?.trim(),
    "The CAB Call <noreply@thecabcall.com>",
    "The CAB Call <onboarding@resend.dev>",
  ].filter((v): v is string => Boolean(v));

  let lastError = "Failed to send email via Resend";

  for (const fromAddress of candidateSenders) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [options.toEmail],
          subject,
          html,
        }),
      });

      const data = (await response.json()) as {
        id?: string;
        message?: string;
        error?: string;
      };

      if (response.ok && data.id) {
        return { sent: true, providerId: data.id };
      }

      lastError =
        data.message ||
        data.error ||
        `Resend HTTP ${response.status} (${fromAddress})`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return { sent: false, error: lastError };
}

/**
 * Generates a single-use cryptographic Magic Link token for an existing invited/active user,
 * stores only its SHA-256 hash in `admin_magic_links`, and dispatches the email via Resend.
 */
export async function requestAdminMagicLink(options: {
  db: D1DatabaseLike;
  ownerEmail?: string;
  email: string;
  purpose?: "login" | "invite";
  clientIp?: string | null;
  baseUrl?: string;
  resendApiKey?: string;
  emailFrom?: string;
}): Promise<{
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  email?: string;
  purpose?: "login" | "invite";
  expiresAt?: string;
  magicLinkUrl?: string;
  emailSent?: boolean;
  emailError?: string;
}> {
  const { db, ownerEmail, clientIp, resendApiKey, emailFrom } = options;
  await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const normalizedEmail = normalizeEmail(options.email);
  const purpose = options.purpose || "login";
  const baseUrl = (options.baseUrl || "https://thecabcall.com").replace(
    /\/+$/,
    ""
  );
  const ipHash = await hashActorIp(clientIp);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_EMAIL",
      error: "Please provide a valid email address.",
    };
  }

  const user = await db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
    .bind(normalizedEmail)
    .first<AdminUserRow>();

  if (!user || user.status === "revoked") {
    await appendAuditEntry(db, {
      actorEmail: normalizedEmail,
      actorRole: user?.role || "unauthorized",
      authMethod: "magic_link",
      actorIpHash: ipHash,
      actionType: "auth.unauthorized_attempt",
      targetType: "user",
      targetId: normalizedEmail,
      reason: user
        ? `Blocked Magic Link request from revoked user (${normalizedEmail}).`
        : `Blocked Magic Link request from uninvited email (${normalizedEmail}).`,
      beforeState: user || null,
      afterState: {
        email: normalizedEmail,
        status: user?.status || "uninvited",
        provider: "magic_link",
        decision: "deny_403",
      },
    });

    return {
      ok: false,
      status: 403,
      code: "UNAUTHORIZED_ACCOUNT",
      error:
        "Access denied: Only the Owner and explicitly invited Change Advisory Board email addresses may request a Magic Link.",
    };
  }

  const rawToken = generateSecureTokenHex(32);
  const tokenHash = await hashTokenSha256(rawToken);
  const now = new Date();
  const ttlMs =
    purpose === "invite"
      ? INVITE_MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000
      : LOGIN_MAGIC_LINK_TTL_MINUTES * 60 * 1000;
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  await db
    .prepare(
      `INSERT INTO admin_magic_links (
        email,
        token_hash,
        purpose,
        expires_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind(normalizedEmail, tokenHash, purpose, expiresAt, now.toISOString())
    .run();

  const magicLinkUrl = `${baseUrl}/api/auth/magic-link/verify?token=${rawToken}`;
  const googleLoginUrl = `${baseUrl}/admin/login`;

  const emailResult = await sendMagicLinkEmailViaResend({
    resendApiKey,
    emailFrom,
    toEmail: normalizedEmail,
    displayName: user.display_name,
    role: user.role,
    purpose,
    magicLinkUrl,
    googleLoginUrl,
    expiresAt,
    invitedByEmail: user.invited_by_email,
  });

  return {
    ok: true,
    status: 200,
    email: normalizedEmail,
    purpose,
    expiresAt,
    magicLinkUrl,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  };
}

/**
 * Verifies and consumes a single-use Magic Link token, promotes `'invited'` -> `'active'`,
 * and creates a new session in `admin_sessions`.
 */
export async function verifyAdminMagicLinkToken(options: {
  db: D1DatabaseLike;
  ownerEmail?: string;
  rawToken: string;
  clientIp?: string | null;
}): Promise<{
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  user?: AdminUserRecord;
  rawSessionToken?: string;
  expiresAt?: string;
}> {
  const { db, ownerEmail, rawToken, clientIp } = options;
  await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const cleanedToken = (rawToken || "").trim();
  if (!cleanedToken) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_TOKEN",
      error: "Missing Magic Link token.",
    };
  }

  const tokenHash = await hashTokenSha256(cleanedToken);
  const linkRow = await db
    .prepare("SELECT * FROM admin_magic_links WHERE token_hash = ?")
    .bind(tokenHash)
    .first<AdminMagicLinkRow>();

  if (!linkRow) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_TOKEN",
      error: "Invalid or unrecognized Magic Link token.",
    };
  }

  if (linkRow.used_at) {
    return {
      ok: false,
      status: 401,
      code: "TOKEN_ALREADY_USED",
      error:
        "This single-use Magic Link has already been used. Please request a new link on /admin/login.",
    };
  }

  const nowIso = new Date().toISOString();
  if (linkRow.expires_at <= nowIso) {
    return {
      ok: false,
      status: 401,
      code: "TOKEN_EXPIRED",
      error:
        "This Magic Link has expired. Please request a fresh link on /admin/login.",
    };
  }

  const user = await db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
    .bind(normalizeEmail(linkRow.email))
    .first<AdminUserRow>();

  if (!user || user.status === "revoked") {
    const ipHash = await hashActorIp(clientIp);
    await appendAuditEntry(db, {
      actorEmail: normalizeEmail(linkRow.email),
      actorRole: user?.role || "unauthorized",
      authMethod: "magic_link",
      actorIpHash: ipHash,
      actionType: "auth.unauthorized_attempt",
      targetType: "user",
      targetId: normalizeEmail(linkRow.email),
      reason: "Attempted to use Magic Link for a revoked or removed user.",
      beforeState: user || null,
      afterState: {
        email: linkRow.email,
        status: user?.status || "missing",
        decision: "deny_403",
      },
    });

    return {
      ok: false,
      status: 403,
      code: "UNAUTHORIZED_ACCOUNT",
      error: "Account access has been revoked by the Change Advisory Board.",
    };
  }

  // Consume single-use token and activate user
  await db
    .prepare("UPDATE admin_magic_links SET used_at = ? WHERE id = ?")
    .bind(nowIso, linkRow.id)
    .run();

  await db
    .prepare(
      "UPDATE admin_users SET status = 'active', last_login_at = ? WHERE id = ?"
    )
    .bind(nowIso, user.id)
    .run();

  const updatedUser =
    (await db
      .prepare("SELECT * FROM admin_users WHERE id = ?")
      .bind(user.id)
      .first<AdminUserRow>()) || user;

  const session = await createAdminSession(db, updatedUser, "magic_link");

  return {
    ok: true,
    status: 200,
    user: mapAdminUserRow(updatedUser),
    rawSessionToken: session.rawSessionToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * Invites a user by email (or re-invites a previously invited/revoked user),
 * generates a 7-day single-use Magic Link, sends an invitation email via Resend,
 * and records `user.invite` in the immutable `audit_ledger`.
 */
export async function inviteAdminUser(options: {
  db: D1DatabaseLike;
  ownerEmail?: string;
  actor: {
    actorEmail: string;
    actorRole: string;
    authMethod: AuditAuthMethod;
    actorIpHash?: string | null;
  };
  email: string;
  displayName?: string | null;
  role?: AdminUserRole;
  authProviderPref?: AdminAuthProviderPref;
  reason?: string;
  baseUrl?: string;
  resendApiKey?: string;
  emailFrom?: string;
  sendEmail?: boolean;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  user?: AdminUserRecord;
  inviteUrl?: string;
  expiresAt?: string;
  emailSent?: boolean;
  emailError?: string;
  auditEntry?: AuditLedgerEntry;
}> {
  const { db, ownerEmail, actor } = options;
  const ownerRecord = await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const normalizedEmail = normalizeEmail(options.email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return {
      ok: false,
      status: 400,
      error: "A valid email address is required to invite a user.",
    };
  }

  const validRoles: AdminUserRole[] = ["admin", "editor", "auditor"];
  const requestedRole: AdminUserRole =
    options.role && validRoles.includes(options.role) ? options.role : "editor";

  const validPrefs: AdminAuthProviderPref[] = ["any", "google", "magic_link"];
  const requestedPref: AdminAuthProviderPref =
    options.authProviderPref && validPrefs.includes(options.authProviderPref)
      ? options.authProviderPref
      : "any";

  const beforeRow = await db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
    .bind(normalizedEmail)
    .first<AdminUserRow>();

  if (beforeRow && beforeRow.role === "owner") {
    return {
      ok: false,
      status: 400,
      error: `${normalizedEmail} is already the primary Owner account.`,
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (!beforeRow) {
    await db
      .prepare(
        `INSERT INTO admin_users (
          email,
          display_name,
          role,
          auth_provider_pref,
          status,
          invited_by_email,
          created_at
        ) VALUES (?, ?, ?, ?, 'invited', ?, ?)`
      )
      .bind(
        normalizedEmail,
        options.displayName?.trim() || null,
        requestedRole,
        requestedPref,
        actor.actorEmail || ownerRecord.email,
        nowIso
      )
      .run();
  } else {
    const nextStatus: AdminUserStatus =
      beforeRow.status === "active" ? "active" : "invited";
    await db
      .prepare(
        `UPDATE admin_users
         SET display_name = COALESCE(?, display_name),
             role = ?,
             auth_provider_pref = ?,
             status = ?,
             invited_by_email = ?
         WHERE id = ?`
      )
      .bind(
        options.displayName?.trim() || null,
        requestedRole,
        requestedPref,
        nextStatus,
        actor.actorEmail || ownerRecord.email,
        beforeRow.id
      )
      .run();
  }

  const afterRow = await db
    .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
    .bind(normalizedEmail)
    .first<AdminUserRow>();

  if (!afterRow) {
    throw new Error(`Failed to persist invited user ${normalizedEmail}`);
  }

  // Generate 7-day single-use invite magic link token
  const rawToken = generateSecureTokenHex(32);
  const tokenHash = await hashTokenSha256(rawToken);
  const expiresAt = new Date(
    now.getTime() + INVITE_MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await db
    .prepare(
      `INSERT INTO admin_magic_links (
        email,
        token_hash,
        purpose,
        expires_at,
        created_at
      ) VALUES (?, ?, 'invite', ?, ?)`
    )
    .bind(normalizedEmail, tokenHash, expiresAt, nowIso)
    .run();

  const baseUrl = (options.baseUrl || "https://thecabcall.com").replace(
    /\/+$/,
    ""
  );
  const inviteUrl = `${baseUrl}/api/auth/magic-link/verify?token=${rawToken}`;
  const googleLoginUrl = `${baseUrl}/admin/login`;

  const reason =
    options.reason?.trim() ||
    `Invited ${normalizedEmail} with role '${requestedRole}' (${requestedPref} auth preference).`;

  let emailSent = false;
  let emailError: string | undefined;

  if (options.sendEmail !== false) {
    const emailRes = await sendMagicLinkEmailViaResend({
      resendApiKey: options.resendApiKey,
      emailFrom: options.emailFrom,
      toEmail: normalizedEmail,
      displayName: afterRow.display_name,
      role: afterRow.role,
      purpose: "invite",
      magicLinkUrl: inviteUrl,
      googleLoginUrl,
      expiresAt,
      invitedByEmail: actor.actorEmail || ownerRecord.email,
      reason,
    });
    emailSent = emailRes.sent;
    emailError = emailRes.error;
  }

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail || ownerRecord.email,
    actorRole: actor.actorRole || "owner",
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "user.invite",
    targetType: "user",
    targetId: String(afterRow.id),
    reason,
    beforeState: beforeRow || null,
    afterState: afterRow,
    replayCommand: {
      op: beforeRow ? "update" : "create",
      action_type: "user.invite",
      target_type: "user",
      target_id: String(afterRow.id),
      email: normalizedEmail,
      invertible: true,
    },
  });

  return {
    ok: true,
    status: 201,
    user: mapAdminUserRow(afterRow),
    inviteUrl,
    expiresAt,
    emailSent,
    emailError,
    auditEntry,
  };
}

/**
 * Revokes a user's access (cannot revoke `owner`), immediately invalidates all active
 * `admin_sessions` and unused `admin_magic_links`, and appends `user.revoke` to `audit_ledger`.
 */
export async function revokeAdminUser(options: {
  db: D1DatabaseLike;
  ownerEmail?: string;
  actor: {
    actorEmail: string;
    actorRole: string;
    authMethod: AuditAuthMethod;
    actorIpHash?: string | null;
  };
  targetEmailOrId: string | number;
  reason?: string;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  user?: AdminUserRecord;
  auditEntry?: AuditLedgerEntry;
}> {
  const { db, ownerEmail, actor, targetEmailOrId } = options;
  const ownerRecord = await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const isNumericId =
    typeof targetEmailOrId === "number" ||
    /^\d+$/.test(String(targetEmailOrId).trim());

  const beforeRow = isNumericId
    ? await db
        .prepare("SELECT * FROM admin_users WHERE id = ?")
        .bind(Number(targetEmailOrId))
        .first<AdminUserRow>()
    : await db
        .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
        .bind(normalizeEmail(String(targetEmailOrId)))
        .first<AdminUserRow>();

  if (!beforeRow) {
    return {
      ok: false,
      status: 404,
      error: `User not found: ${targetEmailOrId}`,
    };
  }

  if (
    beforeRow.role === "owner" ||
    normalizeEmail(beforeRow.email) === normalizeEmail(ownerRecord.email)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Cannot revoke the primary Owner account.",
    };
  }

  const nowIso = new Date().toISOString();

  await db
    .prepare("UPDATE admin_users SET status = 'revoked' WHERE id = ?")
    .bind(beforeRow.id)
    .run();

  // Immediately invalidate all active sessions and unused magic links for this user
  await db
    .prepare(
      "UPDATE admin_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL"
    )
    .bind(nowIso, beforeRow.id)
    .run();

  await db
    .prepare(
      "UPDATE admin_magic_links SET used_at = ? WHERE LOWER(email) = ? AND used_at IS NULL"
    )
    .bind(nowIso, normalizeEmail(beforeRow.email))
    .run();

  const afterRow = await db
    .prepare("SELECT * FROM admin_users WHERE id = ?")
    .bind(beforeRow.id)
    .first<AdminUserRow>();

  if (!afterRow) {
    throw new Error(`Failed to read back revoked user ${beforeRow.email}`);
  }

  const reason =
    options.reason?.trim() ||
    `Revoked administrative access for ${beforeRow.email} and invalidated all active sessions.`;

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail || ownerRecord.email,
    actorRole: actor.actorRole || "owner",
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "user.revoke",
    targetType: "user",
    targetId: String(beforeRow.id),
    reason,
    beforeState: beforeRow,
    afterState: afterRow,
    replayCommand: {
      op: "update",
      action_type: "user.revoke",
      target_type: "user",
      target_id: String(beforeRow.id),
      email: beforeRow.email,
      invertible: true,
    },
  });

  return {
    ok: true,
    status: 200,
    user: mapAdminUserRow(afterRow, 0),
    auditEntry,
  };
}

/**
 * Updates a user's role or auth provider preference and records `user.role_change` in `audit_ledger`.
 */
export async function updateAdminUserRole(options: {
  db: D1DatabaseLike;
  ownerEmail?: string;
  actor: {
    actorEmail: string;
    actorRole: string;
    authMethod: AuditAuthMethod;
    actorIpHash?: string | null;
  };
  targetEmailOrId: string | number;
  role: AdminUserRole;
  authProviderPref?: AdminAuthProviderPref;
  displayName?: string | null;
  reason?: string;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  user?: AdminUserRecord;
  auditEntry?: AuditLedgerEntry;
}> {
  const { db, ownerEmail, actor, targetEmailOrId } = options;
  const ownerRecord = await ensureAdminAuthTablesAndOwner(db, ownerEmail);

  const isNumericId =
    typeof targetEmailOrId === "number" ||
    /^\d+$/.test(String(targetEmailOrId).trim());

  const beforeRow = isNumericId
    ? await db
        .prepare("SELECT * FROM admin_users WHERE id = ?")
        .bind(Number(targetEmailOrId))
        .first<AdminUserRow>()
    : await db
        .prepare("SELECT * FROM admin_users WHERE LOWER(email) = ?")
        .bind(normalizeEmail(String(targetEmailOrId)))
        .first<AdminUserRow>();

  if (!beforeRow) {
    return {
      ok: false,
      status: 404,
      error: `User not found: ${targetEmailOrId}`,
    };
  }

  if (
    beforeRow.role === "owner" ||
    normalizeEmail(beforeRow.email) === normalizeEmail(ownerRecord.email)
  ) {
    return {
      ok: false,
      status: 400,
      error: "Cannot change the role of the primary Owner account.",
    };
  }

  const validRoles: AdminUserRole[] = ["admin", "editor", "auditor"];
  if (!validRoles.includes(options.role)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid role: ${options.role}. Allowed roles: admin, editor, auditor.`,
    };
  }

  const nextPref = options.authProviderPref || beforeRow.auth_provider_pref;

  await db
    .prepare(
      `UPDATE admin_users
       SET role = ?,
           auth_provider_pref = ?,
           display_name = COALESCE(?, display_name)
       WHERE id = ?`
    )
    .bind(
      options.role,
      nextPref,
      options.displayName !== undefined ? options.displayName : null,
      beforeRow.id
    )
    .run();

  // Also keep active sessions' role synchronized
  await db
    .prepare(
      "UPDATE admin_sessions SET role = ? WHERE user_id = ? AND revoked_at IS NULL"
    )
    .bind(options.role, beforeRow.id)
    .run();

  const afterRow = await db
    .prepare("SELECT * FROM admin_users WHERE id = ?")
    .bind(beforeRow.id)
    .first<AdminUserRow>();

  if (!afterRow) {
    throw new Error(`Failed to read back updated user ${beforeRow.email}`);
  }

  const reason =
    options.reason?.trim() ||
    `Changed role for ${beforeRow.email} from '${beforeRow.role}' to '${options.role}'.`;

  const auditEntry = await appendAuditEntry(db, {
    actorEmail: actor.actorEmail || ownerRecord.email,
    actorRole: actor.actorRole || "owner",
    authMethod: actor.authMethod,
    actorIpHash: actor.actorIpHash ?? null,
    actionType: "user.role_change",
    targetType: "user",
    targetId: String(beforeRow.id),
    reason,
    beforeState: beforeRow,
    afterState: afterRow,
    replayCommand: {
      op: "update",
      action_type: "user.role_change",
      target_type: "user",
      target_id: String(beforeRow.id),
      email: beforeRow.email,
      invertible: true,
    },
  });

  return {
    ok: true,
    status: 200,
    user: mapAdminUserRow(afterRow),
    auditEntry,
  };
}
