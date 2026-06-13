import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    legacyAdminJson,
    guardLegacyAdminRequest,
} from "@/lib/api/legacy-admin-adapter";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { generateExecutivePack } from "@/lib/agency/executive-pack/handlers";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/executive-pack/generate",
        requiredRole: "admin",
        writeOperation: true,
    });
    if (!guarded.ok) return guarded.response;

    let body: { orgId?: string; anonymized?: boolean };
    try {
        body = await request.json();
    } catch {
        return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/generate", { error: "Invalid JSON" }, { status: 400 });
    }

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: guarded.organizationId,
            bodyOrgId: body.orgId,
        });
    } catch {
        return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/generate", { error: "Organization not found" }, { status: 404 });
    }

    try {
        const result = await generateExecutivePack({ orgId, anonymized: Boolean(body.anonymized) });
        return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/generate", result, { status: 201 });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/generate", { error: "Generation failed", detail }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/admin/executive-pack/generate", "POST", POSTHandler);
