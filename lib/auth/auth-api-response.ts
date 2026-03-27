import { tenantContextErrorResponse, tenantErrorResponse } from "@/lib/auth/tenant-route";
import { NextResponse } from "next/server";

export function authErrorResponse(error: unknown): NextResponse {
    return tenantContextErrorResponse(error)
        ?? tenantErrorResponse("UNAUTHORIZED", { message: "Authentication required" });
}
