export const runtime = "nodejs";

import { loginWithPassword } from "@/lib/auth/login-service";

/**
 * POST /api/auth/login
 * Canonical password login for tenant/general access.
 */
export async function POST(request: Request) {
    return loginWithPassword(request, { endpoint: "auth" });
}
