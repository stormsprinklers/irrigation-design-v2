import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname.startsWith("/projects") ||
    pathname.startsWith("/settings") ||
    pathname.includes("/design");

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
    return NextResponse.redirect(new URL("/projects", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/projects/:path*", "/settings/:path*", "/login", "/register"],
};
