import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js Middleware
 * Adds security headers to specific routes.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    // Public Dossier: prevent search engine indexing
    if (pathname.startsWith("/diagnostico/")) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
        response.headers.set("Cache-Control", "private, no-store");
    }

    // All API routes except PDF (middleware breaks binary streams in Next.js)
    if (pathname.startsWith("/api/") && !pathname.startsWith("/api/pdf/")) {
        response.headers.set("X-Content-Type-Options", "nosniff");
        response.headers.set("X-Frame-Options", "DENY");
    }

    return response;
}

export const config = {
    matcher: ["/diagnostico/:path*", "/api/:path*"],
};
