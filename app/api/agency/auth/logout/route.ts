export const runtime = "nodejs";

import { logoutWithSessionClear } from "@/lib/auth/logout-service";

export async function POST() {
    return logoutWithSessionClear();
}
