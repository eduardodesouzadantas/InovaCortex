import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { syncMetaTemplatesForOrg } from "@/lib/whatsapp/meta-client";

function authErrorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);

        const templates = await prisma.whatsAppTemplate.findMany({
            where: { organizationId: orgId },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ templates }, { status: 200 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role } = await requireOrgContext((await params).slug);
        assertRole(role, "admin");

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

        let upserted = 0;
        for (const template of syncResult.templates) {
            await prisma.whatsAppTemplate.upsert({
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
            });
            upserted += 1;
        }

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
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
