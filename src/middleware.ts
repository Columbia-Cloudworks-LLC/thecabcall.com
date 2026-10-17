import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE_NAME = "cabcall_admin_session";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .toLowerCase()
    .split(":")[0];

  const isGithubSubdomain =
    host === "github.thecabcall.com" || host.startsWith("github.");
  const isAdminSubdomain =
    host === "admin.thecabcall.com" || host.startsWith("admin.");
  const isPublicProdDomain =
    host === "thecabcall.com" || host === "www.thecabcall.com";

  // 0. On github.thecabcall.com, redirect to the GitHub repository (preserving optional path/query)
  if (isGithubSubdomain) {
    const suffix = pathname && pathname !== "/" ? pathname : "";
    return NextResponse.redirect(
      `https://github.com/Columbia-Cloudworks-LLC/thecabcall.com${suffix}${
        search || ""
      }`,
      308
    );
  }

  // 1. On the public production domain (thecabcall.com), redirect any /admin/* path to admin.thecabcall.com
  if (isPublicProdDomain && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const strippedPath = pathname.replace(/^\/admin/, "") || "/";
    const targetUrl = new URL(
      `${strippedPath}${search || ""}`,
      "https://admin.thecabcall.com"
    );
    return NextResponse.redirect(targetUrl);
  }

  // 2. On admin.thecabcall.com, serve the Admin Console at root (/, /login, /users, /audit, etc.)
  if (isAdminSubdomain) {
    if (
      pathname === "/login" ||
      pathname === "/admin/login" ||
      pathname.startsWith("/admin/login/")
    ) {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = "/admin/login";
      return NextResponse.rewrite(rewriteUrl);
    }

    const sessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie || !sessionCookie.trim()) {
      const loginUrl = new URL("/login", req.url);
      const nextTarget = `${pathname}${search || ""}`;
      if (nextTarget && nextTarget !== "/" && nextTarget !== "/login") {
        loginUrl.searchParams.set("next", nextTarget);
      }
      return NextResponse.redirect(loginUrl);
    }

    const internalPath =
      pathname === "/"
        ? "/admin"
        : pathname.startsWith("/admin")
        ? pathname
        : `/admin${pathname}`;

    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = internalPath;
    return NextResponse.rewrite(rewriteUrl);
  }

  // 3. On localhost or preview URLs, protect /admin and /admin/* directly
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const sessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie || !sessionCookie.trim()) {
      const loginUrl = new URL("/admin/login", req.url);
      const nextTarget = `${pathname}${search || ""}`;
      if (nextTarget && nextTarget !== "/admin/login") {
        loginUrl.searchParams.set("next", nextTarget);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|audio|feed.xml).*)",
  ],
};
