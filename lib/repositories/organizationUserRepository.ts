import { hashPassword } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface OrganizationUserRecord {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    active: boolean;
    createdAt: string;
    lastAccessAt?: string | null;
}

export type OrganizationUserBootstrapResult =
    | { ok: true; organizationId: string; organizationName: string; user: OrganizationUserRecord }
    | { ok: false; reason: "not_found" | "already_has_users" | "user_limit_reached" | "email_conflict" };

export type OrganizationUserStatusChangeResult =
    | { ok: true; organizationId: string; organizationName: string; user: OrganizationUserRecord; changed: boolean; previousActive: boolean }
    | { ok: false; reason: "not_found" };

function toUserRecord(user: {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    active: boolean;
    createdAt: Date;
    lastAccessAt?: Date | null;
}): OrganizationUserRecord {
    return {
        id: user.id,
        name: user.name ?? null,
        email: user.email,
        role: user.role,
        active: user.active,
        createdAt: user.createdAt.toISOString(),
        lastAccessAt: user.lastAccessAt ? user.lastAccessAt.toISOString() : null,
    };
}

export async function createOrganizationInitialUser(input: {
    organizationId: string;
    name?: string | null;
    email: string;
    password: string;
    actorUserId: string;
    actorRole: string;
    source: "agency_surface";
}): Promise<OrganizationUserBootstrapResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedName = input.name?.trim() || null;

    try {
        return await prisma.$transaction(async (tx) => {
            const organization = await tx.organization.findUnique({
                where: { id: input.organizationId },
                select: {
                    id: true,
                    name: true,
                    maxUsers: true,
                },
            });

            if (!organization) {
                return { ok: false, reason: "not_found" };
            }

            const userCount = await tx.user.count({
                where: { organizationId: input.organizationId },
            });

            if (userCount > 0) {
                return { ok: false, reason: "already_has_users" };
            }

            if (userCount >= organization.maxUsers) {
                return { ok: false, reason: "user_limit_reached" };
            }

            const existingEmail = await tx.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true },
            });
            if (existingEmail) {
                return { ok: false, reason: "email_conflict" };
            }

            const passwordHash = await hashPassword(input.password);
            const user = await tx.user.create({
                data: {
                    name: normalizedName,
                    email: normalizedEmail,
                    passwordHash,
                    role: "owner",
                    organizationId: input.organizationId,
                    active: true,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    lastAccessAt: true,
                },
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    action: "agencyOrganizationUser:created",
                    details: JSON.stringify({
                        organizationId: input.organizationId,
                        organizationName: organization.name,
                        userId: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        actorUserId: input.actorUserId,
                        actorRole: input.actorRole,
                        source: input.source,
                    }),
                },
            });

            return {
                ok: true,
                organizationId: organization.id,
                organizationName: organization.name,
                user: toUserRecord(user),
            };
        });
    } catch (error) {
        logger.error("Failed to create initial organization user for Agency", {
            operation: "organizationUserRepository.createOrganizationInitialUser",
            organizationId: input.organizationId,
            email: normalizedEmail,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function updateOrganizationUserActive(input: {
    organizationId: string;
    userId: string;
    nextActive: boolean;
    actorUserId: string;
    actorRole: string;
    source: "agency_surface";
}): Promise<OrganizationUserStatusChangeResult> {
    try {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.findFirst({
                where: {
                    id: input.userId,
                    organizationId: input.organizationId,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    lastAccessAt: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            if (!user) {
                return { ok: false, reason: "not_found" };
            }

            if (user.active === input.nextActive) {
                return {
                    ok: true,
                    organizationId: input.organizationId,
                    organizationName: user.organization.name,
                    user: toUserRecord(user),
                    changed: false,
                    previousActive: user.active,
                };
            }

            const updated = await tx.user.update({
                where: { id: input.userId },
                data: { active: input.nextActive },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    active: true,
                    createdAt: true,
                    lastAccessAt: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    action: input.nextActive
                        ? "agencyOrganizationUser:activated"
                        : "agencyOrganizationUser:deactivated",
                    details: JSON.stringify({
                        organizationId: input.organizationId,
                        organizationName: updated.organization.name,
                        userId: updated.id,
                        email: updated.email,
                        role: updated.role,
                        previousActive: user.active,
                        nextActive: updated.active,
                        actorUserId: input.actorUserId,
                        actorRole: input.actorRole,
                        source: input.source,
                    }),
                },
            });

            return {
                ok: true,
                organizationId: input.organizationId,
                organizationName: updated.organization.name,
                user: toUserRecord(updated),
                changed: true,
                previousActive: user.active,
            };
        });
    } catch (error) {
        logger.error("Failed to update organization user active state for Agency", {
            operation: "organizationUserRepository.updateOrganizationUserActive",
            organizationId: input.organizationId,
            userId: input.userId,
            nextActive: input.nextActive,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
