import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE_NAME = "cabcall_admin_session";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

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
  matcher: ["/admin", "/admin/:path*"],
};
