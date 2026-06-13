import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiLogging } from "@/lib/logger";
import { requireOrgContextFromRequest, orgContextErrorResponse } from "@/lib/auth/org-context";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";
import { prisma } from "@/lib/prisma";
import {
    recordExecutivePulseAction,
    type ExecutivePulseActionStatus,
    type ExecutivePulseLinkedEntityType,
} from "@/lib/executive/pulse-actions";

export const runtime = "nodejs";

const pulseActionRequestSchema = z.object({
    pulseKey: z.string().trim().min(3),
    action: z.enum(["tracking", "delegated", "resolved"]),
    linkedEntityType: z.enum(["deal", "contact"]).nullable().optional(),
    linkedEntityId: z.string().trim().min(1).nullable().optional(),
}).superRefine((value, context) => {
    if (value.linkedEntityId && !value.linkedEntityType) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["linkedEntityType"],
            message: "linkedEntityType is required when linkedEntityId is present",
        });
    }
});

async function handlePulseActionRequest(req: Request, context: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await context.params;
        const orgContext = await requireOrgContextFromRequest(req as any, slug).catch((error) => error);
        if (orgContext instanceof Error) {
            return orgContextErrorResponse(orgContext);
        }

        if (!["owner", "admin"].includes(orgContext.role)) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        if ((await getOrganizationAccountStatus(orgContext.orgId)) === "suspended") {
            return NextResponse.json({
                success: false,
                error: "FORBIDDEN",
                message: ORGANIZATION_BILLING_SUSPENDED_MESSAGE,
            }, { status: 403 });
        }

        const body = await req.json().catch(() => null);
        const parsed = pulseActionRequestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({
                success: false,
                error: "INVALID_PULSE_ACTION",
                message: "Payload inválido para ação executiva.",
            }, { status: 400 });
        }

        const actor = await prisma.user.findUnique({
            where: { id: orgContext.userId },
            select: { email: true },
        }).catch(() => null);

        const alertState = await recordExecutivePulseAction({
            organizationId: orgContext.orgId,
            pulseKey: parsed.data.pulseKey,
            status: parsed.data.action as Exclude<ExecutivePulseActionStatus, "open">,
            lastActionBy: actor?.email?.trim() || orgContext.userId,
            linkedEntityType: parsed.data.linkedEntityType as ExecutivePulseLinkedEntityType | null | undefined,
            linkedEntityId: parsed.data.linkedEntityId ?? null,
        });

        return NextResponse.json({
            success: true,
            data: {
                alertState,
            },
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: "FAILED_TO_RECORD_PULSE_ACTION",
            message: error instanceof Error ? error.message : "Falha ao registrar a ação executiva.",
        }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/org/[slug]/executive/pulse-actions", "POST", handlePulseActionRequest);
