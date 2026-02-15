import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const protectedPaths = ["/dashboard", "/shop-floor", "/jobs", "/settings"];
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("bql_session")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/shop-floor/:path*", "/jobs/:path*", "/settings/:path*"]
};
