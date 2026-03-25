import { withApiLogging } from "@/lib/logger";
export const runtime = "nodejs";

import { logoutWithSessionClear } from "@/lib/auth/logout-service";

async function POSTHandler() {
    return logoutWithSessionClear();
}

export const POST = withApiLogging("/api/auth/logout", "POST", POSTHandler);
