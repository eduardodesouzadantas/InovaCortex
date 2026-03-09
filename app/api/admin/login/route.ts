export const runtime = "nodejs";

import { type NextResponse } from "next/server";
import { loginWithPassword } from "@/lib/auth/login-service";

const SUCCESSOR_ENDPOINT = "/api/agency/auth/login";
const DEPRECATION_DATE = "Mon, 09 Mar 2026 00:00:00 GMT";
const SUNSET_DATE = "Tue, 30 Jun 2026 23:59:59 GMT";

function applyDeprecationHeaders(response: NextResponse): NextResponse {
    response.headers.set("Deprecation", DEPRECATION_DATE);
    response.headers.set("Sunset", SUNSET_DATE);
    response.headers.set("Link", `<${SUCCESSOR_ENDPOINT}>; rel="successor-version"`);
    response.headers.set("Warning", `299 - "Deprecated endpoint. Use ${SUCCESSOR_ENDPOINT}"`);
    response.headers.set("X-Deprecated-Endpoint", "/api/admin/login");
    return response;
}

/**
 * POST /api/admin/login (legacy adapter)
 * Temporary compatibility layer that forwards auth to the canonical agency login logic.
 */
export async function POST(request: Request) {
    const response = await loginWithPassword(request, {
        endpoint: "admin_adapter",
        requireScope: "agency",
    });
    return applyDeprecationHeaders(response);
}
