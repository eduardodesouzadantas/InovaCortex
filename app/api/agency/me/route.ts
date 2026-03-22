import { NextRequest } from "next/server";

import { apiError, apiSuccess } from "@/lib/http/api-response";
import { withApiLogging } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getAuthContextFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

async function GETHandler(request: NextRequest) {
    const auth = await getAuthContextFromRequest(request);
    if (!auth.isAuthenticated || !auth.session) {
        return apiError(request, { code: "UNAUTHORIZED", message: "UNAUTHORIZED" }, { status: 401 });
    }

    if (auth.authScope !== "agency" || !auth.userId || !auth.organizationId) {
        return apiError(request, { code: "FORBIDDEN", message: "FORBIDDEN" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: {
            id: true,
            email: true,
            role: true,
            organizationId: true,
            active: true,
        },
    });

    if (!user || !user.active) {
        return apiError(request, { code: "NOT_FOUND", message: "USER_NOT_FOUND" }, { status: 404 });
    }

    return apiSuccess(request, {
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            agencyId: user.organizationId,
        },
    });
}

export const GET = withApiLogging("/api/agency/me", "GET", GETHandler);
