import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DEAL_ACTIVITY_TYPE = "executive_pulse_action";
const CLOSED_DEAL_STATUSES = ["closed_won", "closed_lost", "archived"];

export type ExecutivePulseActionStatus = "open" | "tracking" | "delegated" | "resolved";
export type ExecutivePulseLinkedEntityType = "deal" | "contact";

export interface ExecutivePulseActionState {
    pulseKey: string;
    status: ExecutivePulseActionStatus;
    lastActionAt: string | null;
    lastActionBy: string | null;
    linkedEntityType: ExecutivePulseLinkedEntityType | null;
    linkedEntityId: string | null;
}

interface ExecutivePulseActionRow {
    pulseKey: string;
    status: string;
    lastActionAt: Date | null;
    lastActionBy: string | null;
    linkedEntityType: string | null;
    linkedEntityId: string | null;
}

function normalizeLinkedEntityType(value: unknown): ExecutivePulseLinkedEntityType | null {
    return value === "deal" || value === "contact" ? value : null;
}

function normalizePulseActionStatus(value: unknown): ExecutivePulseActionStatus {
    return value === "tracking" || value === "delegated" || value === "resolved" ? value : "open";
}

export function toPulseActionState(row: ExecutivePulseActionRow): ExecutivePulseActionState {
    return {
        pulseKey: row.pulseKey,
        status: normalizePulseActionStatus(row.status),
        lastActionAt: row.lastActionAt ? row.lastActionAt.toISOString() : null,
        lastActionBy: typeof row.lastActionBy === "string" && row.lastActionBy.trim().length > 0 ? row.lastActionBy.trim() : null,
        linkedEntityType: normalizeLinkedEntityType(row.linkedEntityType),
        linkedEntityId: typeof row.linkedEntityId === "string" && row.linkedEntityId.trim().length > 0
            ? row.linkedEntityId.trim()
            : null,
    };
}

export async function loadExecutivePulseActionStates(organizationId: string, pulseKeys: string[]): Promise<Map<string, ExecutivePulseActionState>> {
    const normalizedPulseKeys = [...new Set(pulseKeys.map((value) => value.trim().toLowerCase()).filter(Boolean))];

    if (normalizedPulseKeys.length === 0) {
        return new Map();
    }

    const rows = await prisma.executivePulseAction.findMany({
        where: {
            organizationId,
            pulseKey: {
                in: normalizedPulseKeys,
            },
        },
        select: {
            pulseKey: true,
            status: true,
            lastActionAt: true,
            lastActionBy: true,
            linkedEntityType: true,
            linkedEntityId: true,
        },
    });

    return new Map(rows.map((row) => [row.pulseKey, toPulseActionState(row)]));
}

async function resolveLinkedDealId(input: {
    organizationId: string;
    linkedEntityType: ExecutivePulseLinkedEntityType | null;
    linkedEntityId: string | null;
}): Promise<string | null> {
    if (!input.linkedEntityType || !input.linkedEntityId) {
        return null;
    }

    if (input.linkedEntityType === "deal") {
        const deal = await prisma.deal.findFirst({
            where: {
                id: input.linkedEntityId,
                organizationId: input.organizationId,
            },
            select: {
                id: true,
            },
        });
        return deal?.id ?? null;
    }

    const deal = await prisma.deal.findFirst({
        where: {
            contactId: input.linkedEntityId,
            organizationId: input.organizationId,
            status: {
                notIn: CLOSED_DEAL_STATUSES,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            id: true,
        },
    });

    return deal?.id ?? null;
}

export async function recordExecutivePulseAction(input: {
    organizationId: string;
    pulseKey: string;
    status: Exclude<ExecutivePulseActionStatus, "open">;
    lastActionBy: string;
    linkedEntityType?: ExecutivePulseLinkedEntityType | null;
    linkedEntityId?: string | null;
}): Promise<ExecutivePulseActionState> {
    const now = new Date();
    const pulseKey = input.pulseKey.trim().toLowerCase();
    const linkedEntityType = normalizeLinkedEntityType(input.linkedEntityType ?? null);
    const linkedEntityId = typeof input.linkedEntityId === "string" && input.linkedEntityId.trim().length > 0
        ? input.linkedEntityId.trim()
        : null;

    const existing = await prisma.executivePulseAction.findUnique({
        where: {
            organizationId_pulseKey: {
                organizationId: input.organizationId,
                pulseKey,
            },
        },
        select: {
            pulseKey: true,
            status: true,
            linkedEntityType: true,
            linkedEntityId: true,
        },
    });

    const resolvedLinkedEntityType = linkedEntityType ?? normalizeLinkedEntityType(existing?.linkedEntityType ?? null);
    const resolvedLinkedEntityId = linkedEntityId ?? (typeof existing?.linkedEntityId === "string" && existing.linkedEntityId.trim().length > 0 ? existing.linkedEntityId.trim() : null);

    const linkedDealId = await resolveLinkedDealId({
        organizationId: input.organizationId,
        linkedEntityType: resolvedLinkedEntityType,
        linkedEntityId: resolvedLinkedEntityId,
    });

    const pulseAction = await prisma.$transaction(async (tx) => {
        const saved = await tx.executivePulseAction.upsert({
            where: {
                organizationId_pulseKey: {
                    organizationId: input.organizationId,
                    pulseKey,
                },
            },
            create: {
                organizationId: input.organizationId,
                pulseKey,
                status: input.status,
                linkedEntityType: resolvedLinkedEntityType,
                linkedEntityId: resolvedLinkedEntityId,
                lastActionAt: now,
                lastActionBy: input.lastActionBy,
            },
            update: {
                status: input.status,
                linkedEntityType: resolvedLinkedEntityType,
                linkedEntityId: resolvedLinkedEntityId,
                lastActionAt: now,
                lastActionBy: input.lastActionBy,
            },
            select: {
                pulseKey: true,
                status: true,
                lastActionAt: true,
                lastActionBy: true,
                linkedEntityType: true,
                linkedEntityId: true,
            },
        });

        await tx.auditEvent.create({
            data: {
                organizationId: input.organizationId,
                assessmentId: null,
                action: `executivePulse:${input.status}`,
                details: JSON.stringify({
                    pulseKey,
                    status: input.status,
                    lastActionBy: input.lastActionBy,
                    linkedEntityType: resolvedLinkedEntityType,
                    linkedEntityId: resolvedLinkedEntityId,
                    linkedDealId,
                }),
            },
        });

        if (linkedDealId) {
            await tx.activity.create({
                data: {
                    organizationId: input.organizationId,
                    dealId: linkedDealId,
                    type: DEAL_ACTIVITY_TYPE,
                    note: `CEO Pulse ${input.status} para ${pulseKey}`,
                },
            });
        }

        return saved;
    });

    logger.info("[CEO Pulse] Recorded executive action", {
        organizationId: input.organizationId,
        pulseKey,
        status: input.status,
        linkedEntityType: resolvedLinkedEntityType,
        linkedEntityId: resolvedLinkedEntityId,
        linkedDealId,
    });

    return toPulseActionState(pulseAction);
}
