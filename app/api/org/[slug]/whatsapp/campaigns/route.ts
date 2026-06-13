import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertTenantRole, invalidTenantInputResponse, resolveTenantRouteError, tenantNotFoundResponse } from "@/lib/auth/tenant-route";
import { writeAuditEvent } from "@/lib/audit";
import { getCampaignSummaryFromStats } from "@/lib/whatsapp/engines/campaign-engine";
import { buildPaginationMeta, parsePagination } from "@/lib/http/pagination";
type CampaignCreateBody = {
    name?: string;
    segmentQuery?: unknown;
    templateId?: string;
    throttlePolicy?: unknown;
};

async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const pagination = parsePagination(new URL(request.url).searchParams, { defaultLimit: 25, maxLimit: 100 });

        const [total, campaigns] = await prisma.$transaction([
            prisma.whatsAppCampaign.count({
                where: { organizationId: orgId },
            }),
            prisma.whatsAppCampaign.findMany({
                where: { organizationId: orgId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    stats: true,
                    template: { select: { id: true, name: true, language: true, status: true } },
                    _count: { select: { sends: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: pagination.skip,
                take: pagination.limit,
            }),
        ]);

        const mapped = campaigns.map((campaign) => ({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            createdAt: campaign.createdAt,
            template: campaign.template,
            _count: campaign._count,
            summary: getCampaignSummaryFromStats(campaign.stats),
        }));

        return NextResponse.json({
            campaigns: mapped,
            pagination: buildPaginationMeta({ ...pagination, total }),
        }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to load campaigns");
    }
}

async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role } = await requireOrgContext((await params).slug);
        assertTenantRole(role, "admin");

        const body = await request.json().catch(() => null) as CampaignCreateBody | null;
        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const templateId = typeof body.templateId === "string" ? body.templateId : "";

        if (!name) {
            return invalidTenantInputResponse("Campaign name is required");
        }
        if (!templateId) {
            return invalidTenantInputResponse("templateId is required");
        }

        const template = await prisma.whatsAppTemplate.findFirst({
            where: { id: templateId, organizationId: orgId },
            select: { id: true, status: true },
        });
        if (!template) {
            return tenantNotFoundResponse("Template not found");
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
            select: {
                id: true,
                name: true,
                status: true,
                createdAt: true,
                template: { select: { id: true, name: true, language: true, status: true } },
            },
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
        return resolveTenantRouteError(error, "Failed to create campaign");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/campaigns", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/whatsapp/campaigns", "POST", POSTHandler);
