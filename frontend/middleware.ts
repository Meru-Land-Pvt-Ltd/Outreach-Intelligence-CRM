import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = [
  "/brand-map",
  "/contacts",
  "/control-panel",
  "/email-discovery",
  "/enoylity-instantly",
  "/excluded-brands",
  "/instantly-campaigns",
  "/mhd-instantly",
  "/niche-analysis",
  "/pipeline-tracker",
  "/raw-data",
  "/raw-youtube",
  "/reviews",
  "/run-log",
];

function isProtectedPath(pathname: string) {
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("crm_token")?.value || "";

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = token ? "/control-panel" : "/login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/login") && token) {
    const url = request.nextUrl.clone();
    url.pathname = "/control-panel";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isProtectedPath(pathname) && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/brand-map/:path*",
    "/contacts/:path*",
    "/control-panel/:path*",
    "/email-discovery/:path*",
    "/enoylity-instantly/:path*",
    "/excluded-brands/:path*",
    "/instantly-campaigns/:path*",
    "/mhd-instantly/:path*",
    "/niche-analysis/:path*",
    "/pipeline-tracker/:path*",
    "/raw-data/:path*",
    "/raw-youtube/:path*",
    "/reviews/:path*",
    "/run-log/:path*",
  ],
};
