import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { writeAuditEvent } from "@/lib/audit";
import {
    enqueueCampaignExecutionJob,
    getCampaignOperationalSummary,
    isCampaignExecutionInProgress,
    prepareCampaignAudience,
    runCampaignBatches,
} from "@/lib/whatsapp/engines/campaign-engine";

type CampaignAction = "start" | "resume" | "pause" | "run_batch";
type CampaignPatchBody = {
    action?: CampaignAction;
    batchLimit?: number;
    maxBatches?: number;
};

function parseAction(value: unknown): CampaignAction | null {
    if (value === "start" || value === "resume" || value === "pause" || value === "run_batch") return value;
    return null;
}

function parsePositiveInt(value: unknown, fallback: number, max = 20): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(1, Math.floor(value)));
}

function campaignView(campaign: {
    id: string;
    name: string;
    status: string;
    template: { id: string; name: string; language: string; status: string };
}) {
    return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        template: campaign.template,
    };
}

async function PATCHHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id: campaignId } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);
        assertTenantRole(role, "admin");

        const body = await request.json().catch(() => null) as CampaignPatchBody | null;
        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }
        const action = parseAction(body.action);
        if (!action) {
            return invalidTenantInputResponse("Invalid action. Allowed: start, resume, pause, run_batch");
        }

        const campaign = await prisma.whatsAppCampaign.findFirst({
            where: { id: campaignId, organizationId: orgId },
            select: {
                id: true,
                name: true,
                status: true,
                stats: true,
                template: { select: { id: true, name: true, status: true, language: true } },
            },
        });
        if (!campaign) {
            return tenantNotFoundResponse("Campaign not found");
        }

        if (action === "pause") {
            if (campaign.status !== "running") {
                return NextResponse.json({ error: "Only running campaigns can be paused" }, { status: 409 });
            }

            const currentStats = (() => {
                try {
                    const parsed = JSON.parse(campaign.stats) as Record<string, unknown>;
                    return parsed && typeof parsed === "object" ? parsed : {};
                } catch {
                    return {};
                }
            })();

            const updated = await prisma.whatsAppCampaign.update({
                where: { id: campaignId },
                data: {
                    status: "paused",
                    stats: JSON.stringify({
                        ...currentStats,
                        nextBatchAt: null,
                    }),
                },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    template: { select: { id: true, name: true, status: true, language: true } },
                },
            });

            const summary = await getCampaignOperationalSummary(orgId, campaignId);
            await writeAuditEvent({
                organizationId: orgId,
                action: "campaign_paused",
                details: {
                    campaignId: updated.id,
                    actorUserId: userId,
                    previousStatus: campaign.status,
                    summary,
                },
                strict: false,
                context: { campaignId: updated.id },
            });

            return NextResponse.json({ success: true, campaign: campaignView(updated), summary, warnings: [] }, { status: 200 });
        }

        if (campaign.template.status !== "approved") {
            return NextResponse.json({ error: "Campaign template is not approved", code: "TEMPLATE_NOT_APPROVED" }, { status: 422 });
        }

        if (action === "start" || action === "resume") {
            if (action === "start" && !["draft", "paused"].includes(campaign.status)) {
                return NextResponse.json({ error: `Cannot start campaign with status '${campaign.status}'` }, { status: 409 });
            }
            if (action === "resume" && !["paused", "running"].includes(campaign.status)) {
                return NextResponse.json({ error: `Cannot resume campaign with status '${campaign.status}'` }, { status: 409 });
            }

            if (await isCampaignExecutionInProgress(orgId, campaignId)) {
                return NextResponse.json({ error: "Campaign already has an active execution lock" }, { status: 409 });
            }

            const audience = await prepareCampaignAudience(orgId, campaignId);
            const resumeStats = (() => {
                try {
                    const parsed = JSON.parse(campaign.stats) as Record<string, unknown>;
                    return parsed && typeof parsed === "object" ? parsed : {};
                } catch {
                    return {};
                }
            })();
            const updated = await prisma.whatsAppCampaign.update({
                where: { id: campaignId },
                data: {
                    status: "running",
                    stats: JSON.stringify({
                        ...resumeStats,
                        failureReason: null,
                    }),
                },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    template: { select: { id: true, name: true, status: true, language: true } },
                },
            });

            const queue = await enqueueCampaignExecutionJob(orgId, campaignId, {
                reason: action === "start" ? "campaign_started" : "campaign_resumed",
                trigger: action,
                maxBatches: parsePositiveInt(body.maxBatches, 2),
                batchLimit: parsePositiveInt(body.batchLimit, 25, 100),
            });

            const summary = await getCampaignOperationalSummary(orgId, campaignId);
            const warnings = queue.queued ? [] : ["Campaign already queued for execution."];

            await writeAuditEvent({
                organizationId: orgId,
                action: action === "start" ? "campaign_started" : "campaign_resumed",
                details: {
                    campaignId,
                    actorUserId: userId,
                    audience,
                    queue,
                    summary,
                },
                strict: false,
                context: { campaignId, action },
            });

            return NextResponse.json({
                success: true,
                campaign: campaignView(updated),
                summary,
                warnings,
                queue,
                audience,
            }, { status: 200 });
        }

        if (campaign.status !== "running") {
            return NextResponse.json({ error: "Campaign must be running to process batch" }, { status: 409 });
        }

        if (await isCampaignExecutionInProgress(orgId, campaignId)) {
            return NextResponse.json({ error: "Campaign is already being processed" }, { status: 409 });
        }

        const execution = await runCampaignBatches(orgId, campaignId, {
            trigger: "manual",
            actorUserId: userId,
            maxBatches: parsePositiveInt(body.maxBatches, 1),
            batchLimit: parsePositiveInt(body.batchLimit, 25, 100),
            autoQueueNext: true,
        });

        const refreshed = await prisma.whatsAppCampaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                status: true,
                template: { select: { id: true, name: true, status: true, language: true } },
            },
        });

        await writeAuditEvent({
            organizationId: orgId,
            action: "campaign_batch_executed",
            details: {
                campaignId,
                actorUserId: userId,
                manual: true,
                execution,
            },
            strict: false,
            context: { campaignId, action },
        });

        return NextResponse.json({
            success: true,
            campaign: refreshed ? campaignView(refreshed) : campaignView(campaign),
            summary: execution.summary,
            warnings: execution.warnings,
            queue: execution.queue,
            run: {
                processed: execution.processedInRun,
                sent: execution.sentInRun,
                failed: execution.failedInRun,
                skipped: execution.skippedInRun,
                deduped: execution.dedupedInRun,
                retryScheduled: execution.retryScheduledInRun,
            },
        }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to update campaign");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/whatsapp/campaigns/[id]", "PATCH", PATCHHandler);
