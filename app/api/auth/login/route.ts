import { withApiLogging } from "@/lib/logger";
export const runtime = "nodejs";

import { loginWithPassword } from "@/lib/auth/login-service";

/**
 * POST /api/auth/login
 * Canonical password login for tenant/general access.
 */
async function POSTHandler(request: Request) {
    return loginWithPassword(request, { endpoint: "auth" });
}

export const POST = withApiLogging("/api/auth/login", "POST", POSTHandler);
