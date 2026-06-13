import { Prisma } from "@prisma/client";

import { normalizeOrganizationAccountStatus, type OrganizationAccountStatus } from "@/lib/billing/account-status";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/http/pagination";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { deriveInviteStatus, type InviteStatus } from "@/lib/auth/invite";
import type { OrganizationUserRecord } from "@/lib/repositories/organizationUserRepository";

export const ORGANIZATION_LIFECYCLE_STATUS_OPTIONS = ["all", "active", "suspended", "onboarding"] as const;
export type OrganizationLifecycleStatusFilter = typeof ORGANIZATION_LIFECYCLE_STATUS_OPTIONS[number];
export type OrganizationLifecycleStatus = Exclude<OrganizationLifecycleStatusFilter, "all">;

const SUSPENDED_SUBSCRIPTION_STATUSES = [
    "suspended",
    "paused",
    "past_due",
    "canceled",
    "cancelled",
    "unpaid",
    "incomplete_expired",
] as const;

export const ORGANIZATION_LIFECYCLE_STATUS_LABELS: Record<OrganizationLifecycleStatus, string> = {
    active: "Ativo",
    suspended: "Suspenso",
    onboarding: "Onboarding",
};

export const ORGANIZATION_LIFECYCLE_STATUS_CLASSNAMES: Record<OrganizationLifecycleStatus, string> = {
    active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    suspended: "border-rose-400/20 bg-rose-400/10 text-rose-100",
    onboarding: "border-amber-400/20 bg-amber-400/10 text-amber-100",
};

export const ORGANIZATION_SUBSCRIPTION_STATUS_LABELS: Record<OrganizationAccountStatus, string> = {
    active: "Ativa",
    trial: "Trial",
    suspended: "Suspensa",
};

export const ORGANIZATION_SUBSCRIPTION_STATUS_CLASSNAMES: Record<OrganizationAccountStatus, string> = {
    active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    trial: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
    suspended: "border-rose-400/20 bg-rose-400/10 text-rose-100",
};

export function normalizeOrganizationLifecycleFilter(value?: string | null): OrganizationLifecycleStatusFilter {
    if (value === "active" || value === "suspended" || value === "onboarding") {
        return value;
    }

    return "all";
}

export function getOrganizationLifecycleStatusLabel(status: OrganizationLifecycleStatus): string {
    return ORGANIZATION_LIFECYCLE_STATUS_LABELS[status];
}

export function getOrganizationLifecycleStatusClassName(status: OrganizationLifecycleStatus): string {
    return ORGANIZATION_LIFECYCLE_STATUS_CLASSNAMES[status];
}

export function getOrganizationSubscriptionStatusLabel(status: OrganizationAccountStatus): string {
    return ORGANIZATION_SUBSCRIPTION_STATUS_LABELS[status];
}

export function getOrganizationSubscriptionStatusClassName(status: OrganizationAccountStatus): string {
    return ORGANIZATION_SUBSCRIPTION_STATUS_CLASSNAMES[status];
}

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

export function deriveOrganizationLifecycleStatus(input: {
    subscriptionStatus: string | null;
    onboardingStatus: string | null;
}): OrganizationLifecycleStatus {
    if (normalizeOrganizationAccountStatus(input.subscriptionStatus) === "suspended") {
        return "suspended";
    }

    return input.onboardingStatus === "completed" ? "active" : "onboarding";
}

export function buildOrganizationLifecycleWhere(status: OrganizationLifecycleStatusFilter): Prisma.OrganizationWhereInput {
    if (status === "suspended") {
        return {
            subscriptionStatus: { in: [...SUSPENDED_SUBSCRIPTION_STATUSES] },
        };
    }

    if (status === "active") {
        return {
            subscriptionStatus: { notIn: [...SUSPENDED_SUBSCRIPTION_STATUSES] },
            onboardingStatus: {
                is: {
                    status: "completed",
                },
            },
        };
    }

    if (status === "onboarding") {
        return {
            subscriptionStatus: { notIn: [...SUSPENDED_SUBSCRIPTION_STATUSES] },
            OR: [
                { onboardingStatus: { is: null } },
                { onboardingStatus: { is: { status: { not: "completed" } } } },
            ],
        };
    }

    return {};
}

export interface OrganizationWorkspaceSummary {
    id: string;
    status: string;
    createdAt: string;
    goLiveAt: string | null;
    proposalId: string;
    assessmentId: string;
}

export interface OrganizationListItem {
    id: string;
    name: string;
    lifecycleStatus: OrganizationLifecycleStatus;
    createdAt: string;
    latestWorkspace: OrganizationWorkspaceSummary | null;
}

export interface OrganizationDetailRecord {
    id: string;
    name: string;
    slug: string;
    plan: string;
    industry: string;
    maxUsers: number;
    subscriptionStatus: string;
    normalizedSubscriptionStatus: OrganizationAccountStatus;
    subscriptionStatusLabel: string;
    lifecycleStatus: OrganizationLifecycleStatus;
    createdAt: string;
    updatedAt: string;
    onboarding: {
        status: string | null;
        emailConnectedAt: string | null;
        pipelineConfiguredAt: string | null;
        firstContactAt: string | null;
        firstDealAt: string | null;
        completedAt: string | null;
        updatedAt: string | null;
    };
    counts: {
        users: number;
        agencyMemberships: number;
        organizationAccesses: number;
        workspaces: number;
    };
    users: OrganizationUserRecord[];
    invites: OrganizationInviteRecord[];
    workspaces: OrganizationWorkspaceSummary[];
}

export interface OrganizationInviteRecord {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    status: InviteStatus;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    createdByUserId: string;
    createdAt: string;
}

export interface ListOrganizationsResult {
    organizations: OrganizationListItem[];
    pagination: PaginationMeta;
}

export type OrganizationOperationalStatus = "active" | "suspended";

export interface OrganizationStatusChangeResult {
    organizationId: string;
    organizationName: string;
    previousSubscriptionStatus: string;
    nextSubscriptionStatus: string;
    previousLifecycleStatus: OrganizationLifecycleStatus;
    nextLifecycleStatus: OrganizationLifecycleStatus;
    changed: boolean;
}

function mapWorkspaceSummary(workspace: {
    id: string;
    status: string;
    createdAt: Date;
    goLiveAt: Date | null;
    proposalId: string;
    assessmentId: string;
}): OrganizationWorkspaceSummary {
    return {
        id: workspace.id,
        status: workspace.status,
        createdAt: workspace.createdAt.toISOString(),
        goLiveAt: toIso(workspace.goLiveAt),
        proposalId: workspace.proposalId,
        assessmentId: workspace.assessmentId,
    };
}

function mapInviteRecord(invite: {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    createdByUserId: string;
    createdAt: Date;
}): OrganizationInviteRecord {
    return {
        id: invite.id,
        organizationId: invite.organizationId,
        email: invite.email,
        role: invite.role,
        status: deriveInviteStatus({
            acceptedAt: invite.acceptedAt,
            revokedAt: invite.revokedAt,
            expiresAt: invite.expiresAt,
        }),
        expiresAt: invite.expiresAt.toISOString(),
        acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
        revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
        createdByUserId: invite.createdByUserId,
        createdAt: invite.createdAt.toISOString(),
    };
}

export async function listOrganizations(input: {
    page: number;
    limit: number;
    status: OrganizationLifecycleStatusFilter;
}): Promise<ListOrganizationsResult> {
    const where = buildOrganizationLifecycleWhere(input.status);

    try {
        const [total, organizations] = await Promise.all([
            prisma.organization.count({ where }),
            prisma.organization.findMany({
                where,
                orderBy: [{ createdAt: "desc" }, { name: "asc" }],
                skip: (input.page - 1) * input.limit,
                take: input.limit,
                select: {
                    id: true,
                    name: true,
                    subscriptionStatus: true,
                    createdAt: true,
                    onboardingStatus: {
                        select: {
                            status: true,
                        },
                    },
                },
            }),
        ]);

        const organizationIds = organizations.map((organization) => organization.id);
        const workspaces = organizationIds.length > 0
            ? await prisma.clientWorkspace.findMany({
                where: { organizationId: { in: organizationIds } },
                orderBy: [{ createdAt: "desc" }],
                select: {
                    id: true,
                    organizationId: true,
                    status: true,
                    createdAt: true,
                    goLiveAt: true,
                    proposalId: true,
                    assessmentId: true,
                },
            })
            : [];

        const latestWorkspaceByOrg = new Map<string, OrganizationWorkspaceSummary>();
        for (const workspace of workspaces) {
            if (!latestWorkspaceByOrg.has(workspace.organizationId)) {
                latestWorkspaceByOrg.set(workspace.organizationId, mapWorkspaceSummary(workspace));
            }
        }

        return {
            organizations: organizations.map((organization) => {
                return {
                    id: organization.id,
                    name: organization.name,
                    lifecycleStatus: deriveOrganizationLifecycleStatus({
                        subscriptionStatus: organization.subscriptionStatus,
                        onboardingStatus: organization.onboardingStatus?.status ?? null,
                    }),
                    createdAt: organization.createdAt.toISOString(),
                    latestWorkspace: latestWorkspaceByOrg.get(organization.id) ?? null,
                };
            }),
            pagination: buildPaginationMeta({
                page: input.page,
                limit: input.limit,
                skip: (input.page - 1) * input.limit,
                total,
            }),
        };
    } catch (error) {
        logger.error("Failed to list organizations for Agency", {
            operation: "organizationRepository.listOrganizations",
            error: error instanceof Error ? error.message : String(error),
            status: input.status,
            page: input.page,
            limit: input.limit,
        });
        throw error;
    }
}

export async function getOrganizationDetails(organizationId: string): Promise<OrganizationDetailRecord | null> {
    try {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                industry: true,
                maxUsers: true,
                subscriptionStatus: true,
                createdAt: true,
                updatedAt: true,
                onboardingStatus: {
                    select: {
                        status: true,
                        emailConnectedAt: true,
                        pipelineConfiguredAt: true,
                        firstContactAt: true,
                        firstDealAt: true,
                        completedAt: true,
                        updatedAt: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                        agencyMemberships: true,
                        organizationAccesses: true,
                    },
                },
            },
        });

        if (!organization) {
            return null;
        }

        const [users, workspaces, invites] = await Promise.all([
            prisma.user.findMany({
                where: { organizationId },
                orderBy: [{ createdAt: "asc" }],
                take: 10,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    lastAccessAt: true,
                },
            }),
            prisma.clientWorkspace.findMany({
                where: { organizationId },
                orderBy: [{ createdAt: "desc" }],
                take: 10,
                select: {
                    id: true,
                    organizationId: true,
                    status: true,
                    createdAt: true,
                    goLiveAt: true,
                    proposalId: true,
                    assessmentId: true,
                },
            }),
            prisma.userInvite.findMany({
                where: { organizationId },
                orderBy: [{ createdAt: "desc" }],
                take: 10,
                select: {
                    id: true,
                    organizationId: true,
                    email: true,
                    role: true,
                    expiresAt: true,
                    acceptedAt: true,
                    revokedAt: true,
                    createdByUserId: true,
                    createdAt: true,
                },
            }),
            prisma.userInvite.findMany({
                where: { organizationId },
                orderBy: [{ createdAt: "desc" }],
                take: 10,
                select: {
                    id: true,
                    organizationId: true,
                    email: true,
                    role: true,
                    expiresAt: true,
                    acceptedAt: true,
                    revokedAt: true,
                    createdByUserId: true,
                    createdAt: true,
                },
            }),
        ]);

        const normalizedSubscriptionStatus = normalizeOrganizationAccountStatus(organization.subscriptionStatus);

        return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            plan: organization.plan,
            industry: organization.industry,
            maxUsers: organization.maxUsers,
            subscriptionStatus: organization.subscriptionStatus,
            normalizedSubscriptionStatus,
            subscriptionStatusLabel: ORGANIZATION_SUBSCRIPTION_STATUS_LABELS[normalizedSubscriptionStatus],
            lifecycleStatus: deriveOrganizationLifecycleStatus({
                subscriptionStatus: organization.subscriptionStatus,
                onboardingStatus: organization.onboardingStatus?.status ?? null,
            }),
            createdAt: organization.createdAt.toISOString(),
            updatedAt: organization.updatedAt.toISOString(),
            onboarding: {
                status: organization.onboardingStatus?.status ?? null,
                emailConnectedAt: toIso(organization.onboardingStatus?.emailConnectedAt),
                pipelineConfiguredAt: toIso(organization.onboardingStatus?.pipelineConfiguredAt),
                firstContactAt: toIso(organization.onboardingStatus?.firstContactAt),
                firstDealAt: toIso(organization.onboardingStatus?.firstDealAt),
                completedAt: toIso(organization.onboardingStatus?.completedAt),
                updatedAt: toIso(organization.onboardingStatus?.updatedAt),
            },
            counts: {
                users: organization._count.users,
                agencyMemberships: organization._count.agencyMemberships,
                organizationAccesses: organization._count.organizationAccesses,
                workspaces: workspaces.length,
            },
            users: users.map((user) => ({
                id: user.id,
                name: user.name ?? null,
                email: user.email,
                role: user.role,
                active: user.active,
                createdAt: user.createdAt.toISOString(),
                lastAccessAt: user.lastAccessAt ? user.lastAccessAt.toISOString() : null,
            })),
            invites: invites.map(mapInviteRecord),
            workspaces: workspaces.map(mapWorkspaceSummary),
        };
    } catch (error) {
        logger.error("Failed to load organization details for Agency", {
            operation: "organizationRepository.getOrganizationDetails",
            organizationId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function updateOrganizationOperationalStatus(input: {
    organizationId: string;
    nextSubscriptionStatus: OrganizationOperationalStatus;
    actorUserId: string;
    actorRole: string;
    source: "agency_surface";
}): Promise<OrganizationStatusChangeResult | null> {
    try {
        return await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.findUnique({
                where: { id: input.organizationId },
                select: {
                    id: true,
                    name: true,
                    subscriptionStatus: true,
                    onboardingStatus: {
                        select: {
                            status: true,
                        },
                    },
                },
            });

            if (!organization) {
                return null;
            }

            const previousSubscriptionStatus = organization.subscriptionStatus;
            const previousLifecycleStatus = deriveOrganizationLifecycleStatus({
                subscriptionStatus: previousSubscriptionStatus,
                onboardingStatus: organization.onboardingStatus?.status ?? null,
            });

            if (normalizeOrganizationAccountStatus(previousSubscriptionStatus) === input.nextSubscriptionStatus) {
                return {
                    organizationId: organization.id,
                    organizationName: organization.name,
                    previousSubscriptionStatus,
                    nextSubscriptionStatus: previousSubscriptionStatus,
                    previousLifecycleStatus,
                    nextLifecycleStatus: previousLifecycleStatus,
                    changed: false,
                };
            }

            const updated = await tx.organization.update({
                where: { id: input.organizationId },
                data: {
                    subscriptionStatus: input.nextSubscriptionStatus,
                },
                select: {
                    id: true,
                    name: true,
                    subscriptionStatus: true,
                    onboardingStatus: {
                        select: {
                            status: true,
                        },
                    },
                },
            });

            const nextLifecycleStatus = deriveOrganizationLifecycleStatus({
                subscriptionStatus: updated.subscriptionStatus,
                onboardingStatus: updated.onboardingStatus?.status ?? null,
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    action: "agencyOrganization:statusChanged",
                    details: JSON.stringify({
                        organizationId: input.organizationId,
                        organizationName: updated.name,
                        actorUserId: input.actorUserId,
                        actorRole: input.actorRole,
                        source: input.source,
                        previousSubscriptionStatus,
                        nextSubscriptionStatus: updated.subscriptionStatus,
                        previousLifecycleStatus,
                        nextLifecycleStatus,
                    }),
                },
            });

            return {
                organizationId: updated.id,
                organizationName: updated.name,
                previousSubscriptionStatus,
                nextSubscriptionStatus: updated.subscriptionStatus,
                previousLifecycleStatus,
                nextLifecycleStatus,
                changed: true,
            };
        });
    } catch (error) {
        logger.error("Failed to update organization operational status for Agency", {
            operation: "organizationRepository.updateOrganizationOperationalStatus",
            organizationId: input.organizationId,
            nextSubscriptionStatus: input.nextSubscriptionStatus,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
