import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { writeAuditEvent } from "@/lib/audit";
import { syncMetaTemplatesForOrg } from "@/lib/whatsapp/meta-client";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";

async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const pagination = parsePagination(new URL(request.url).searchParams, { defaultLimit: 50, maxLimit: 100 });

        const [total, templates] = await prisma.$transaction([
            prisma.whatsAppTemplate.count({
                where: { organizationId: orgId },
            }),
            prisma.whatsAppTemplate.findMany({
                where: { organizationId: orgId },
                select: {
                    id: true,
                    name: true,
                    category: true,
                    language: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { name: "asc" },
                skip: pagination.skip,
                take: pagination.limit,
            }),
        ]);

        return NextResponse.json({
            templates,
            pagination: buildPaginationMeta({ ...pagination, total }),
        }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to load WhatsApp templates");
    }
}

async function POSTHandler(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role } = await requireOrgContext((await params).slug);
        assertTenantRole(role, "admin");

        const syncResult = await syncMetaTemplatesForOrg(orgId);
        if (syncResult.source === "unconfigured") {
            return NextResponse.json({
                error: "Meta credentials are not configured for template sync",
                code: syncResult.error ?? "META_NOT_CONFIGURED",
            }, { status: 503 });
        }
        if (syncResult.error) {
            return NextResponse.json({
                error: "Meta template sync failed",
                details: syncResult.error,
            }, { status: 502 });
        }

        const upserts = syncResult.templates.map((template) =>
            prisma.whatsAppTemplate.upsert({
                where: {
                    organizationId_name_language: {
                        organizationId: orgId,
                        name: template.name,
                        language: template.language,
                    },
                },
                create: {
                    organizationId: orgId,
                    name: template.name,
                    category: template.category,
                    language: template.language,
                    status: template.status,
                    bodyJson: template.bodyJson,
                },
                update: {
                    category: template.category,
                    status: template.status,
                    bodyJson: template.bodyJson,
                },
            }),
        );
        await prisma.$transaction(upserts);
        const upserted = upserts.length;

        await writeAuditEvent({
            organizationId: orgId,
            action: "whatsappTemplatesSynced",
            details: {
                pulled: syncResult.templates.length,
                upserted,
            },
            strict: true,
            context: { pulled: syncResult.templates.length },
        });

        return NextResponse.json({
            ok: true,
            pulled: syncResult.templates.length,
            upserted,
        }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to sync WhatsApp templates");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/templates", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/whatsapp/templates", "POST", POSTHandler);
