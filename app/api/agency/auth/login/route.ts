export const runtime = "nodejs";

import { loginWithPassword } from "@/lib/auth/login-service";

/**
 * POST /api/agency/auth/login
 * Official agency login endpoint.
 */
export async function POST(request: Request) {
    return loginWithPassword(request, {
        endpoint: "agency",
        requireScope: "agency",
    });
}
