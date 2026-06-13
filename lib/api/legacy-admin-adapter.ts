import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
    type AdminApiAuthMode,
} from "@/lib/auth/admin-api-guard";
import type { Role } from "@/lib/auth/rbac";

type GuardOptions = {
    successorPath: string;
    requiredRole?: Role;
    writeOperation?: boolean;
};

type LegacyAdminGuardFailure = {
    ok: false;
    response: NextResponse;
};

type LegacyAdminGuardSuccess = {
    ok: true;
    mode: AdminApiAuthMode;
    organizationId: string;
    userId: string;
};

export type LegacyAdminGuardResult = LegacyAdminGuardFailure | LegacyAdminGuardSuccess;

export function legacyAdminJson(
    mode: AdminApiAuthMode,
    successorPath: string,
    body: unknown,
    init?: ResponseInit,
): NextResponse {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath,
        mode,
    });
}

export function legacyAdminResponse(
    mode: AdminApiAuthMode,
    successorPath: string,
    response: NextResponse,
): NextResponse {
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath,
        mode,
    });
}

export async function guardLegacyAdminRequest(
    request: NextRequest,
    options: GuardOptions,
): Promise<LegacyAdminGuardResult> {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: options.successorPath,
    });
    if (redirectResponse) {
        return { ok: false, response: redirectResponse };
    }

    const access = await requireAdminApiAccess(request, {
        requiredRole: options.requiredRole ?? "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return {
            ok: false,
            response: NextResponse.json({ error: access.error }, { status: access.status }),
        };
    }
    if (!access.auth?.organizationId || !access.auth.userId) {
        return {
            ok: false,
            response: legacyAdminJson(access.mode, options.successorPath, { error: "Forbidden" }, { status: 403 }),
        };
    }

    if (options.writeOperation) {
        const frozen = createLegacyAdminWriteFrozenResponse({
            successorPath: options.successorPath,
            mode: access.mode,
        });
        if (frozen) {
            return { ok: false, response: frozen };
        }
    }

    return {
        ok: true,
        mode: access.mode,
        organizationId: access.auth.organizationId,
        userId: access.auth.userId,
    };
}

