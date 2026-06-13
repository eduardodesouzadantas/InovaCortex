import { prisma } from "@/lib/prisma";

export type OnboardingStepId = "email" | "pipeline" | "first_crm_record";
export type OnboardingStatusValue = "not_started" | "in_progress" | "completed";

type OnboardingRow = {
    organizationId: string;
    status: string;
    emailConnectedAt: Date | null;
    pipelineConfiguredAt: Date | null;
    firstContactAt: Date | null;
    firstDealAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

export type OnboardingStepProgress = {
    id: OnboardingStepId;
    label: string;
    detail: string;
    status: "done" | "pending";
    completedAt: string | null;
};

export type OnboardingStatusSnapshot = {
    organizationId: string;
    status: OnboardingStatusValue;
    progressPercent: number;
    completedStepCount: number;
    totalStepCount: number;
    emailConnectedAt: string | null;
    pipelineConfiguredAt: string | null;
    firstContactAt: string | null;
    firstDealAt: string | null;
    firstCrmRecordAt: string | null;
    completedAt: string | null;
    updatedAt: string;
    steps: OnboardingStepProgress[];
};

export type TenantReadinessBlockerId = OnboardingStepId;

export type TenantReadinessBlocker = {
    id: TenantReadinessBlockerId;
    label: string;
    detail: string;
    completed: boolean;
};

export type TenantReadinessSnapshot = {
    organizationId: string;
    ready: boolean;
    blockers: TenantReadinessBlocker[];
    completedStepCount: number;
    totalStepCount: number;
    onboarding: OnboardingStatusSnapshot;
};

type OnboardingField = "emailConnectedAt" | "pipelineConfiguredAt" | "firstContactAt" | "firstDealAt";
type OnboardingPatch = Partial<Pick<OnboardingRow, "status" | "emailConnectedAt" | "pipelineConfiguredAt" | "firstContactAt" | "firstDealAt" | "completedAt">>;

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function earliestDate(values: Array<Date | null | undefined>): Date | null {
    const sorted = values
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => left.getTime() - right.getTime());

    return sorted[0] ?? null;
}

function latestDate(values: Array<Date | null | undefined>): Date | null {
    const sorted = values
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime());

    return sorted[0] ?? null;
}

function mapStatus(completedStepCount: number): OnboardingStatusValue {
    if (completedStepCount >= 3) {
        return "completed";
    }

    if (completedStepCount > 0) {
        return "in_progress";
    }

    return "not_started";
}

function buildSnapshot(record: OnboardingRow): OnboardingStatusSnapshot {
    const emailDone = Boolean(record.emailConnectedAt);
    const pipelineDone = Boolean(record.pipelineConfiguredAt);
    const firstCrmRecordAt = earliestDate([record.firstContactAt, record.firstDealAt]);
    const firstCrmRecordDone = Boolean(firstCrmRecordAt);

    const steps: OnboardingStepProgress[] = [
        {
            id: "email",
            label: "Conectar email",
            detail: "A conexao OAuth do tenant ja esta ativa.",
            status: emailDone ? "done" : "pending",
            completedAt: toIso(record.emailConnectedAt),
        },
        {
            id: "pipeline",
            label: "Configurar pipeline",
            detail: "A pipeline padrao do CRM ja foi iniciada.",
            status: pipelineDone ? "done" : "pending",
            completedAt: toIso(record.pipelineConfiguredAt),
        },
        {
            id: "first_crm_record",
            label: "Primeiro contato/deal",
            detail: "O tenant ja registrou o primeiro contato ou deal.",
            status: firstCrmRecordDone ? "done" : "pending",
            completedAt: toIso(firstCrmRecordAt),
        },
    ];

    const completedStepCount = steps.filter((step) => step.status === "done").length;
    const completedAt = record.completedAt ?? (completedStepCount >= 3
        ? latestDate([record.emailConnectedAt, record.pipelineConfiguredAt, firstCrmRecordAt])
        : null);

    return {
        organizationId: record.organizationId,
        status: mapStatus(completedStepCount),
        progressPercent: Math.round((completedStepCount / steps.length) * 100),
        completedStepCount,
        totalStepCount: steps.length,
        emailConnectedAt: toIso(record.emailConnectedAt),
        pipelineConfiguredAt: toIso(record.pipelineConfiguredAt),
        firstContactAt: toIso(record.firstContactAt),
        firstDealAt: toIso(record.firstDealAt),
        firstCrmRecordAt: toIso(firstCrmRecordAt),
        completedAt: toIso(completedAt),
        updatedAt: record.updatedAt.toISOString(),
        steps,
    };
}

export function getTenantReadinessFromOnboarding(onboarding: OnboardingStatusSnapshot): TenantReadinessSnapshot {
    const blockers = onboarding.steps
        .filter((step) => step.status !== "done")
        .map((step) => ({
            id: step.id,
            label: step.label,
            detail: step.detail,
            completed: false,
        }));

    return {
        organizationId: onboarding.organizationId,
        ready: blockers.length === 0,
        blockers,
        completedStepCount: onboarding.completedStepCount,
        totalStepCount: onboarding.totalStepCount,
        onboarding,
    };
}

async function ensureOnboardingRow(organizationId: string): Promise<OnboardingRow> {
    const row = await prisma.onboardingStatus.upsert({
        where: { organizationId },
        create: {
            organizationId,
            status: "not_started",
        },
        update: {},
        select: {
            organizationId: true,
            status: true,
            emailConnectedAt: true,
            pipelineConfiguredAt: true,
            firstContactAt: true,
            firstDealAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return row;
}

async function commitOnboardingPatch(organizationId: string, patch: OnboardingPatch): Promise<OnboardingRow> {
    const updated = await prisma.onboardingStatus.update({
        where: { organizationId },
        data: patch,
        select: {
            organizationId: true,
            status: true,
            emailConnectedAt: true,
            pipelineConfiguredAt: true,
            firstContactAt: true,
            firstDealAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return updated;
}

async function advanceOnboardingField(
    organizationId: string,
    field: OnboardingField,
    completedAt = new Date(),
): Promise<OnboardingStatusSnapshot> {
    const current = await ensureOnboardingRow(organizationId);
    const next: OnboardingRow = { ...current };

    if (!next[field]) {
        next[field] = completedAt;
    }

    const nextSnapshot = buildSnapshot(next);
    const patch: OnboardingPatch = {};

    if (!current[field] && next[field]) {
        patch[field] = next[field];
    }

    if (current.status !== nextSnapshot.status) {
        patch.status = nextSnapshot.status;
    }

    if (nextSnapshot.status === "completed" && !current.completedAt) {
        patch.completedAt = nextSnapshot.completedAt ? new Date(nextSnapshot.completedAt) : completedAt;
    }

    if (Object.keys(patch).length > 0) {
        return buildSnapshot(await commitOnboardingPatch(organizationId, patch));
    }

    return nextSnapshot;
}

export async function ensureOnboardingStatus(organizationId: string): Promise<OnboardingStatusSnapshot> {
    return buildSnapshot(await ensureOnboardingRow(organizationId));
}

export async function refreshOnboardingStatusFromTenant(organizationId: string): Promise<OnboardingStatusSnapshot> {
    const current = await ensureOnboardingRow(organizationId);

    const [emailIntegration, pipeline, firstContact, firstDeal] = await Promise.all([
        prisma.emailIntegration.findFirst({
            where: {
                organizationId,
                status: "connected",
            },
            select: {
                updatedAt: true,
            },
        }),
        prisma.pipeline.findFirst({
            where: { organizationId },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }),
        prisma.contact.findFirst({
            where: { organizationId },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }),
        prisma.deal.findFirst({
            where: { organizationId },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }),
    ]);

    const patch: OnboardingPatch = {};

    if (!current.emailConnectedAt && emailIntegration?.updatedAt) {
        patch.emailConnectedAt = emailIntegration.updatedAt;
    }

    if (!current.pipelineConfiguredAt && pipeline?.createdAt) {
        patch.pipelineConfiguredAt = pipeline.createdAt;
    }

    if (!current.firstContactAt && firstContact?.createdAt) {
        patch.firstContactAt = firstContact.createdAt;
    }

    if (!current.firstDealAt && firstDeal?.createdAt) {
        patch.firstDealAt = firstDeal.createdAt;
    }

    const merged = {
        ...current,
        ...patch,
    };
    const snapshot = buildSnapshot(merged);

    if (snapshot.status !== current.status || Object.keys(patch).length > 0) {
        const persisted = await commitOnboardingPatch(organizationId, {
            ...patch,
            status: snapshot.status,
            ...(snapshot.status === "completed" && !current.completedAt
                ? { completedAt: snapshot.completedAt ? new Date(snapshot.completedAt) : latestDate([
                    patch.emailConnectedAt ?? current.emailConnectedAt,
                    patch.pipelineConfiguredAt ?? current.pipelineConfiguredAt,
                    patch.firstContactAt ?? current.firstContactAt,
                    patch.firstDealAt ?? current.firstDealAt,
                ]) }
                : {}),
        });

        return buildSnapshot(persisted);
    }

    return snapshot;
}

export async function isTenantReady(organizationId: string): Promise<TenantReadinessSnapshot> {
    return getTenantReadinessFromOnboarding(await refreshOnboardingStatusFromTenant(organizationId));
}

export async function recordOnboardingEmailConnected(
    organizationId: string,
    completedAt = new Date(),
): Promise<OnboardingStatusSnapshot> {
    return advanceOnboardingField(organizationId, "emailConnectedAt", completedAt);
}

export async function recordOnboardingPipelineConfigured(
    organizationId: string,
    completedAt = new Date(),
): Promise<OnboardingStatusSnapshot> {
    return advanceOnboardingField(organizationId, "pipelineConfiguredAt", completedAt);
}

export async function recordOnboardingFirstContact(
    organizationId: string,
    completedAt = new Date(),
): Promise<OnboardingStatusSnapshot> {
    return advanceOnboardingField(organizationId, "firstContactAt", completedAt);
}

export async function recordOnboardingFirstDeal(
    organizationId: string,
    completedAt = new Date(),
): Promise<OnboardingStatusSnapshot> {
    return advanceOnboardingField(organizationId, "firstDealAt", completedAt);
}
