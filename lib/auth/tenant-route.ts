import { type Role, assertRole } from "@/lib/auth/rbac";
import { NextResponse } from "next/server";

export type TenantRouteErrorCode =
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_INPUT"
    | "TENANT_MISMATCH"
    | "INTERNAL_ERROR";

type TenantRouteErrorOptions = {
    details?: unknown;
    message?: string;
};

const TENANT_ROUTE_STATUS: Record<TenantRouteErrorCode, number> = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INVALID_INPUT: 400,
    TENANT_MISMATCH: 403,
    INTERNAL_ERROR: 500,
};

export function tenantErrorResponse(
    error: TenantRouteErrorCode,
    options: TenantRouteErrorOptions = {},
): NextResponse {
    const payload: Record<string, unknown> = {
        success: false,
        error: options.message ?? error,
        code: error,
    };

    if (typeof options.details !== "undefined") {
        payload.details = options.details;
    }

    return NextResponse.json(payload, { status: TENANT_ROUTE_STATUS[error] });
}

export function tenantContextErrorResponse(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "UNAUTHENTICATED") {
        return tenantErrorResponse("UNAUTHORIZED", { message: "Authentication required" });
    }

    if (message === "ORG_NOT_FOUND") {
        return tenantErrorResponse("NOT_FOUND", { message: "Organization not found" });
    }

    if (message === "TENANT_MISMATCH") {
        return tenantErrorResponse("TENANT_MISMATCH", { message: "Tenant context mismatch" });
    }

    if (message.startsWith("FORBIDDEN")) {
        return tenantErrorResponse("FORBIDDEN", { message: "Access denied" });
    }

    return null;
}

export function invalidTenantInputResponse(
    message: string,
    details?: unknown,
): NextResponse {
    return tenantErrorResponse("INVALID_INPUT", { message, details });
}

export function tenantNotFoundResponse(
    message = "Resource not found",
    details?: unknown,
): NextResponse {
    return tenantErrorResponse("NOT_FOUND", { message, details });
}

export function tenantInternalErrorResponse(
    message = "Internal error",
    details?: unknown,
): NextResponse {
    return tenantErrorResponse("INTERNAL_ERROR", { message, details });
}

export function resolveTenantRouteError(
    error: unknown,
    internalMessage = "Internal error",
): NextResponse {
    return tenantContextErrorResponse(error) ?? tenantInternalErrorResponse(internalMessage);
}

export function assertTenantRole(userRole: Role | string, requiredRole: Role): void {
    assertRole(userRole, requiredRole);
}

export function assertTenantOwnership(
    resourceOrganizationId: string,
    organizationId: string,
): void {
    if (resourceOrganizationId !== organizationId) {
        throw new Error("TENANT_MISMATCH");
    }
}
