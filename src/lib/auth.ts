import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  createLocalSqliteD1Adapter,
  getEffectiveWorkerUrl,
  loadLocalEnvVars,
  shouldUseRemoteWorker,
} from "./d1-bridge";
import { hashActorIp } from "@/pipeline/audit";
import {
  ADMIN_SESSION_COOKIE_NAME,
  AdminAuthProviderPref,
  AdminUserRecord,
  AdminUserRole,
  AuthenticatedAdminActor,
  authenticateGoogleOAuthUser,
  inviteAdminUser,
  listAdminUsers,
  OAUTH_STATE_COOKIE_NAME,
  requestAdminMagicLink,
  revokeAdminSessionByToken,
  revokeAdminUser,
  SESSION_TTL_DAYS,
  updateAdminUserRole,
  verifyAdminMagicLinkToken,
  verifyAdminSession,
} from "@/pipeline/auth";

export * from "@/pipeline/auth";

/**
 * Extracts the raw session token from a NextRequest (cookie, x-session-token, or Bearer header).
 */
export function getSessionTokenFromNextRequest(req: NextRequest): string | null {
  const cookieVal = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (cookieVal && cookieVal.trim()) {
    return cookieVal.trim();
  }
  const headerToken = req.headers.get("x-session-token");
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return null;
}

/**
 * Reads the `cabcall_admin_session` cookie in Next.js Server Components / Route Handlers.
 */
export async function getSessionTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    return val?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Sets the `HttpOnly`, `Secure`, `SameSite=Lax` admin session cookie on a NextResponse.
 */
export function setAdminSessionCookie(
  res: NextResponse,
  rawSessionToken: string,
  expiresAt?: string
): void {
  const isProd = process.env.NODE_ENV === "production";
  const expiresDate = expiresAt
    ? new Date(expiresAt)
    : new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  res.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: rawSessionToken,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresDate,
  });
}

/**
 * Clears the admin session cookie on a NextResponse.
 */
export function clearAdminSessionCookie(res: NextResponse): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Verifies a session token against D1 (via remote Cloudflare Worker or local `.wrangler` SQLite).
 */
export async function getCurrentAdminSession(
  explicitToken?: string | null
): Promise<AuthenticatedAdminActor | null> {
  const token =
    explicitToken !== undefined
      ? explicitToken
      : await getSessionTokenFromCookies();
  if (!token || !token.trim()) {
    return null;
  }

  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    try {
      const workerUrl = getEffectiveWorkerUrl();
      const response = await fetch(`${workerUrl}/api/auth/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": token.trim(),
        },
        body: JSON.stringify({ token: token.trim() }),
        cache: "no-store",
      });

      if (response.ok) {
        const data = (await response.json()) as {
          authenticated?: boolean;
          actor?: AuthenticatedAdminActor | null;
        };
        if (data.authenticated && data.actor) {
          return data.actor;
        }
        return null;
      }
    } catch {
      // Fallback to local SQLite if offline
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) return null;
  return verifyAdminSession(db, token, envVars.OWNER_ADMIN_EMAIL);
}

/**
 * Authorizes an incoming NextRequest for admin routes using either a valid session cookie/token
 * or the `x-admin-secret` header.
 */
export async function requireAdminRequestActor(
  req: NextRequest,
  allowedRoles?: AdminUserRole[]
): Promise<{
  authorized: boolean;
  status: number;
  error?: string;
  actor?: AuthenticatedAdminActor;
}> {
  const envVars = loadLocalEnvVars();
  const sessionToken = getSessionTokenFromNextRequest(req);

  if (sessionToken) {
    const actor = await getCurrentAdminSession(sessionToken);
    if (actor) {
      if (allowedRoles && !allowedRoles.includes(actor.role)) {
        return {
          authorized: false,
          status: 403,
          error: `Forbidden: Your role (${actor.role}) does not have permission for this operation.`,
        };
      }
      return {
        authorized: true,
        status: 200,
        actor,
      };
    }
  }

  const providedSecret = req.headers.get("x-admin-secret");
  if (providedSecret && providedSecret === envVars.ADMIN_SECRET) {
    const actorEmail = (
      req.headers.get("x-actor-email") || envVars.OWNER_ADMIN_EMAIL
    )
      .trim()
      .toLowerCase();
    const actorRole = (req.headers.get("x-actor-role") ||
      "owner") as AdminUserRole;
    return {
      authorized: true,
      status: 200,
      actor: {
        userId: 1,
        email: actorEmail,
        displayName: "System Admin",
        avatarUrl: null,
        role: actorRole,
        authMethod: "admin_secret",
      },
    };
  }

  return {
    authorized: false,
    status: 401,
    error: "Unauthorized: Valid admin session or x-admin-secret required.",
  };
}

/**
 * Verifies a Google user profile against D1 `admin_users` (rejecting uninvited accounts with 403
 * and recording `auth.unauthorized_attempt` in `audit_ledger`).
 */
export async function verifyGoogleLoginAgainstD1(options: {
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
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/auth/google/verify-login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
      },
      body: JSON.stringify(options),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok: boolean;
      status?: number;
      code?: string;
      error?: string;
      user?: AdminUserRecord;
      rawSessionToken?: string;
      expiresAt?: string;
    };

    return {
      ...data,
      status: data.status || response.status,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available for Google login");
  }

  return authenticateGoogleOAuthUser({
    db,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
    ...options,
  });
}

/**
 * Exchanges a Google OAuth 2.0 authorization code for tokens, verifies the ID token
 * against Google's tokeninfo endpoint, and authenticates the user against D1 `admin_users`.
 */
export async function exchangeGoogleCodeAndAuthenticate(options: {
  code: string;
  redirectUri: string;
  clientIp?: string | null;
}): Promise<{
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  email?: string;
  user?: AdminUserRecord;
  rawSessionToken?: string;
  expiresAt?: string;
}> {
  const envVars = loadLocalEnvVars();
  const clientId = envVars.GOOGLE_CLIENT_ID;
  const clientSecret = envVars.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      status: 500,
      code: "MISSING_GOOGLE_CONFIG",
      error: "Google OAuth credentials are not configured on the server.",
    };
  }

  // Step 1: Exchange authorization code for id_token + access_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code: options.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: options.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });

  const tokenData = (await tokenRes.json()) as {
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenData.id_token) {
    return {
      ok: false,
      status: 400,
      code: "OAUTH_TOKEN_EXCHANGE_FAILED",
      error:
        tokenData.error_description ||
        tokenData.error ||
        "Failed to exchange Google OAuth authorization code.",
    };
  }

  // Step 2: Verify ID token via Google's oauth2 tokeninfo endpoint
  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
      tokenData.id_token
    )}`,
    { cache: "no-store" }
  );

  const infoData = (await infoRes.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    error_description?: string;
  };

  if (!infoRes.ok || !infoData.email) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_ID_TOKEN",
      error:
        infoData.error_description || "Failed to verify Google OAuth ID token.",
    };
  }

  if (infoData.aud !== clientId) {
    return {
      ok: false,
      status: 401,
      code: "AUDIENCE_MISMATCH",
      error: "Google ID token audience does not match client ID.",
    };
  }

  const emailVerified =
    infoData.email_verified === true || infoData.email_verified === "true";

  // Step 3: Verify email against D1 `admin_users`
  const authResult = await verifyGoogleLoginAgainstD1({
    email: infoData.email,
    emailVerified,
    displayName: infoData.name || null,
    avatarUrl: infoData.picture || null,
    clientIp: options.clientIp,
  });

  return {
    ...authResult,
    email: infoData.email,
  };
}

/**
 * Requests a single-use Magic Link for an invited/active user.
 */
export async function requestMagicLinkBridge(options: {
  email: string;
  purpose?: "login" | "invite";
  baseUrl?: string;
  includeRawLink?: boolean;
  clientIp?: string | null;
}) {
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.includeRawLink) {
      headers["x-admin-secret"] = envVars.ADMIN_SECRET;
    }

    const response = await fetch(`${workerUrl}/api/auth/magic-link/request`, {
      method: "POST",
      headers,
      body: JSON.stringify(options),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok: boolean;
      status?: number;
      code?: string;
      error?: string;
      email?: string;
      purpose?: "login" | "invite";
      expiresAt?: string;
      magicLinkUrl?: string;
      emailSent?: boolean;
      emailError?: string;
    };

    return {
      ...data,
      status: data.status || response.status,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }

  const result = await requestAdminMagicLink({
    db,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
    email: options.email,
    purpose: options.purpose,
    clientIp: options.clientIp,
    baseUrl: options.baseUrl,
    resendApiKey: envVars.RESEND_API_KEY,
    emailFrom: envVars.EMAIL_FROM,
  });

  if (!options.includeRawLink) {
    const { magicLinkUrl: _omitted, ...safeResult } = result;
    void _omitted;
    return safeResult;
  }

  return result;
}

/**
 * Verifies a single-use Magic Link token against D1 and returns the created session.
 */
export async function verifyMagicLinkBridge(options: {
  token: string;
  clientIp?: string | null;
}) {
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/auth/magic-link/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
      cache: "no-store",
    });

    const data = (await response.json()) as {
      ok: boolean;
      status?: number;
      code?: string;
      error?: string;
      user?: AdminUserRecord;
      rawSessionToken?: string;
      expiresAt?: string;
    };

    return {
      ...data,
      status: data.status || response.status,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }

  return verifyAdminMagicLinkToken({
    db,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
    rawToken: options.token,
    clientIp: options.clientIp,
  });
}

/**
 * Revokes an active session token on sign-out.
 */
export async function logoutSessionBridge(
  rawSessionToken?: string | null
): Promise<void> {
  if (!rawSessionToken) return;

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    await fetch(`${workerUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": rawSessionToken,
      },
      body: JSON.stringify({ token: rawSessionToken }),
      cache: "no-store",
    });
    return;
  }

  const db = createLocalSqliteD1Adapter();
  if (db) {
    await revokeAdminSessionByToken(db, rawSessionToken);
  }
}

/**
 * Lists all users in `admin_users` across remote Worker or local D1.
 */
export async function getAdminUsersBridge(): Promise<{
  users: AdminUserRecord[];
  ownerEmail: string;
}> {
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/users`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = (await response.json()) as {
        users?: AdminUserRecord[];
        ownerEmail?: string;
      };
      return {
        users: Array.isArray(data.users) ? data.users : [],
        ownerEmail: data.ownerEmail || envVars.OWNER_ADMIN_EMAIL,
      };
    }
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    return { users: [], ownerEmail: envVars.OWNER_ADMIN_EMAIL };
  }

  const users = await listAdminUsers(db, envVars.OWNER_ADMIN_EMAIL);
  return {
    users,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
  };
}

/**
 * Invites a user via remote Worker or local D1.
 */
export async function inviteAdminUserBridge(options: {
  actor: AuthenticatedAdminActor;
  email: string;
  displayName?: string | null;
  role?: AdminUserRole;
  authProviderPref?: AdminAuthProviderPref;
  reason?: string;
  baseUrl?: string;
  sendEmail?: boolean;
  clientIp?: string | null;
}) {
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/users/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
        "x-actor-email": options.actor.email,
        "x-actor-role": options.actor.role,
        "x-actor-auth-method": options.actor.authMethod,
      },
      body: JSON.stringify({
        email: options.email,
        displayName: options.displayName,
        role: options.role,
        authProviderPref: options.authProviderPref,
        reason: options.reason,
        baseUrl: options.baseUrl,
        sendEmail: options.sendEmail,
        actorEmail: options.actor.email,
        actorRole: options.actor.role,
        authMethod: options.actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = await response.json();
    return {
      ...data,
      status: data.status || response.status,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }

  return inviteAdminUser({
    db,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
    actor: {
      actorEmail: options.actor.email,
      actorRole: options.actor.role,
      authMethod: options.actor.authMethod,
      actorIpHash: await hashActorIp(options.clientIp),
    },
    email: options.email,
    displayName: options.displayName,
    role: options.role,
    authProviderPref: options.authProviderPref,
    reason: options.reason,
    baseUrl: options.baseUrl,
    resendApiKey: envVars.RESEND_API_KEY,
    emailFrom: envVars.EMAIL_FROM,
    sendEmail: options.sendEmail,
  });
}

/**
 * Revokes a user via remote Worker or local D1.
 */
export async function revokeAdminUserBridge(options: {
  actor: AuthenticatedAdminActor;
  targetEmailOrId: string | number;
  reason?: string;
  clientIp?: string | null;
}) {
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/users/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
        "x-actor-email": options.actor.email,
        "x-actor-role": options.actor.role,
        "x-actor-auth-method": options.actor.authMethod,
      },
      body: JSON.stringify({
        email:
          typeof options.targetEmailOrId === "string"
            ? options.targetEmailOrId
            : undefined,
        id:
          typeof options.targetEmailOrId === "number"
            ? options.targetEmailOrId
            : undefined,
        reason: options.reason,
        actorEmail: options.actor.email,
        actorRole: options.actor.role,
        authMethod: options.actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = await response.json();
    return {
      ...data,
      status: data.status || response.status,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }

  return revokeAdminUser({
    db,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
    actor: {
      actorEmail: options.actor.email,
      actorRole: options.actor.role,
      authMethod: options.actor.authMethod,
      actorIpHash: await hashActorIp(options.clientIp),
    },
    targetEmailOrId: options.targetEmailOrId,
    reason: options.reason,
  });
}

/**
 * Updates a user's role or auth provider preference via remote Worker or local D1.
 */
export async function updateAdminUserRoleBridge(options: {
  actor: AuthenticatedAdminActor;
  targetEmailOrId: string | number;
  role: AdminUserRole;
  authProviderPref?: AdminAuthProviderPref;
  displayName?: string | null;
  reason?: string;
  clientIp?: string | null;
}) {
  const envVars = loadLocalEnvVars();

  if (shouldUseRemoteWorker()) {
    const workerUrl = getEffectiveWorkerUrl();
    const response = await fetch(`${workerUrl}/api/admin/users/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": envVars.ADMIN_SECRET,
        "x-actor-email": options.actor.email,
        "x-actor-role": options.actor.role,
        "x-actor-auth-method": options.actor.authMethod,
      },
      body: JSON.stringify({
        email:
          typeof options.targetEmailOrId === "string"
            ? options.targetEmailOrId
            : undefined,
        id:
          typeof options.targetEmailOrId === "number"
            ? options.targetEmailOrId
            : undefined,
        role: options.role,
        authProviderPref: options.authProviderPref,
        displayName: options.displayName,
        reason: options.reason,
        actorEmail: options.actor.email,
        actorRole: options.actor.role,
        authMethod: options.actor.authMethod,
      }),
      cache: "no-store",
    });

    const data = await response.json();
    return {
      ...data,
      status: data.status || response.status,
    };
  }

  const db = createLocalSqliteD1Adapter();
  if (!db) {
    throw new Error("Local Wrangler D1 database not available");
  }

  return updateAdminUserRole({
    db,
    ownerEmail: envVars.OWNER_ADMIN_EMAIL,
    actor: {
      actorEmail: options.actor.email,
      actorRole: options.actor.role,
      authMethod: options.actor.authMethod,
      actorIpHash: await hashActorIp(options.clientIp),
    },
    targetEmailOrId: options.targetEmailOrId,
    role: options.role,
    authProviderPref: options.authProviderPref,
    displayName: options.displayName,
    reason: options.reason,
  });
}
