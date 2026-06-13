import { NextResponse } from "next/server";

import { requireOrgContext } from "@/lib/auth/org-context";
import { invalidTenantInputResponse, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { withApiLogging } from "@/lib/logger";
import { createMobileActivity, MobileActionError, updateMobileDeal } from "@/lib/mobile/mobile-actions";

type MobileActionBody =
    | {
        kind: "deal_update";
        dealId?: string;
        status?: string | null;
        value?: number | null;
        note?: string | null;
    }
    | {
        kind: "activity_create";
        dealId?: string | null;
        threadId?: string | null;
        type?: string | null;
        note?: string | null;
    };

async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);
        const body = await request.json().catch(() => null) as MobileActionBody | null;

        if (!body || typeof body !== "object" || !("kind" in body)) {
            return invalidTenantInputResponse("Invalid JSON");
        }

        if (body.kind === "deal_update") {
            if (!body.dealId) {
                return invalidTenantInputResponse("dealId required");
            }

            const result = await updateMobileDeal({
                organizationId: orgId,
                userId,
                role,
                dealId: body.dealId,
                status: body.status ?? null,
                value: body.value ?? null,
                note: body.note ?? null,
            });

            return NextResponse.json({
                success: true,
                kind: "deal_update",
                deal: result.deal,
                noteSaved: result.noteSaved,
            });
        }

        if (body.kind === "activity_create") {
            const result = await createMobileActivity({
                organizationId: orgId,
                userId,
                role,
                dealId: body.dealId ?? null,
                threadId: body.threadId ?? null,
                type: body.type ?? "mobile_note",
                note: body.note ?? null,
            });

            return NextResponse.json({
                success: true,
                kind: "activity_create",
                activity: result.activity,
            });
        }

        return invalidTenantInputResponse("Unsupported action");
    } catch (error) {
        if (error instanceof MobileActionError) {
            return NextResponse.json({
                success: false,
                error: error.code,
                message: error.message,
            }, { status: error.status });
        }

        return resolveTenantRouteError(error, "Failed to execute mobile action");
    }
}

export const POST = withApiLogging("/api/org/[slug]/mobile/actions", "POST", POSTHandler);

