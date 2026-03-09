import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { getCampaignSummaryFromStats } from "@/lib/whatsapp/engines/campaign-engine";

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

        const campaigns = await prisma.whatsAppCampaign.findMany({
            where: { organizationId: orgId },
            include: {
                template: { select: { id: true, name: true, language: true, status: true } },
                _count: { select: { sends: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const mapped = campaigns.map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            createdAt: campaign.createdAt,
            template: campaign.template,
            _count: campaign._count,
            summary: getCampaignSummaryFromStats(campaign.stats),
        }));

        return NextResponse.json({ campaigns: mapped }, { status: 200 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role } = await requireOrgContext((await params).slug);
        assertRole(role, "admin");

        const body = await request.json().catch(() => ({}));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const templateId = typeof body.templateId === "string" ? body.templateId : "";

        if (!name) {
            return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
        }
        if (!templateId) {
            return NextResponse.json({ error: "templateId is required" }, { status: 400 });
        }

        const template = await prisma.whatsAppTemplate.findFirst({
            where: { id: templateId, organizationId: orgId },
            select: { id: true, status: true },
        });
        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }
        if (template.status !== "approved") {
            return NextResponse.json({ error: "Template must be approved before campaign creation" }, { status: 409 });
        }

        const segmentQuery = body.segmentQuery && typeof body.segmentQuery === "object" ? body.segmentQuery : {};
        const throttlePolicy = body.throttlePolicy && typeof body.throttlePolicy === "object"
            ? body.throttlePolicy
            : { msgsPerMinute: 10, maxBatchesPerRun: 2 };

        const campaign = await prisma.whatsAppCampaign.create({
            data: {
                organizationId: orgId,
                name,
                templateId,
                segmentQuery: JSON.stringify(segmentQuery),
                throttlePolicy: JSON.stringify(throttlePolicy),
                status: "draft",
                stats: JSON.stringify({
                    totalTargetContacts: 0,
                    totalProcessed: 0,
                    totalSent: 0,
                    totalFailed: 0,
                    totalSkipped: 0,
                    totalDeduped: 0,
                    lastBatchAt: null,
                    nextBatchAt: null,
                    failureReason: null,
                }),
            },
            include: { template: { select: { id: true, name: true, language: true, status: true } } },
        });

        await writeAuditEvent({
            organizationId: orgId,
            action: "whatsappCampaignCreated",
            details: {
                campaignId: campaign.id,
                templateId,
                status: campaign.status,
            },
            strict: true,
            context: { campaignId: campaign.id },
        });

        return NextResponse.json({ campaign }, { status: 201 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
