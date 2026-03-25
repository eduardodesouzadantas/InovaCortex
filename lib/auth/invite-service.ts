import { hashPassword } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/app/services/identityEvents/identityEvent.service";
import { sendEmail } from "@/app/services/communication/email.service";
import type { OrganizationInviteRecord } from "@/lib/repositories/organizationRepository";
import {
    deriveInviteStatus,
    generateInviteToken,
    hashInviteToken,
    isInviteExpired,
    VALID_INVITE_ROLES,
    type InviteStatus,
} from "@/lib/auth/invite";

export interface OrganizationInviteCreateResult {
    organizationId: string;
    organizationName: string;
    invite: OrganizationInviteRecord;
    inviteUrl?: string;
}

export type OrganizationInviteCreateOutcome =
    | { ok: true; data: OrganizationInviteCreateResult }
    | { ok: false; reason: "not_found" | "email_conflict" | "invalid_role" | "user_limit_reached" };

export type OrganizationInviteRevokeOutcome =
    | { ok: true; organizationId: string; organizationName: string; invite: OrganizationInviteRecord; changed: boolean }
    | { ok: false; reason: "not_found" | "invalid_state" };

export type OrganizationInviteAcceptOutcome =
    | { ok: true; organizationId: string; organizationName: string; userId: string; email: string }
    | { ok: false; reason: "invalid_token" | "expired_token" | "invalid_name" | "weak_password" | "email_conflict" | "invalid_role" | "organization_not_found" | "user_limit_reached" };

function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
    return value.trim();
}

function toInviteRecord(input: {
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
        id: input.id,
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        status: deriveInviteStatus({
            acceptedAt: input.acceptedAt,
            revokedAt: input.revokedAt,
            expiresAt: input.expiresAt,
        }),
        expiresAt: input.expiresAt.toISOString(),
        acceptedAt: input.acceptedAt ? input.acceptedAt.toISOString() : null,
        revokedAt: input.revokedAt ? input.revokedAt.toISOString() : null,
        createdByUserId: input.createdByUserId,
        createdAt: input.createdAt.toISOString(),
    };
}

export async function createOrganizationInvite(input: {
    organizationId: string;
    email: string;
    role?: string;
    actorUserId: string;
    actorRole: string;
    source: "agency_surface";
    now?: Date;
    exposeToken?: boolean;
    baseUrl?: string;
}): Promise<OrganizationInviteCreateOutcome> {
    const now = input.now ?? new Date();
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedRole = (input.role?.trim().toLowerCase() ?? "viewer") as string;
    let inviteEmail: Parameters<typeof sendEmail>[0] | null = null;

    if (!VALID_INVITE_ROLES.has(normalizedRole as never)) {
        return { ok: false, reason: "invalid_role" };
    }

    try {
        const outcome = await prisma.$transaction(async (tx): Promise<OrganizationInviteCreateOutcome> => {
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

            const existingUser = await tx.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true },
            });
            if (existingUser) {
                return { ok: false, reason: "email_conflict" };
            }

            const userCount = await tx.user.count({
                where: { organizationId: input.organizationId },
            });
            if (userCount >= organization.maxUsers) {
                return { ok: false, reason: "user_limit_reached" };
            }

            const token = generateInviteToken(now);

            await tx.userInvite.updateMany({
                where: {
                    organizationId: input.organizationId,
                    email: normalizedEmail,
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: {
                    revokedAt: now,
                },
            });

            const invite = await tx.userInvite.create({
                data: {
                    organizationId: input.organizationId,
                    email: normalizedEmail,
                    role: normalizedRole,
                    tokenHash: token.tokenHash,
                    expiresAt: token.expiresAt,
                    createdByUserId: input.actorUserId,
                },
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
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    action: "userInvite:created",
                    details: JSON.stringify({
                        organizationId: input.organizationId,
                        organizationName: organization.name,
                        inviteId: invite.id,
                        email: invite.email,
                        role: invite.role,
                        actorUserId: input.actorUserId,
                        actorRole: input.actorRole,
                        source: input.source,
                        expiresAt: token.expiresAt.toISOString(),
                    }),
                },
            });

            const record = toInviteRecord(invite);
            const result: OrganizationInviteCreateResult = {
                organizationId: organization.id,
                organizationName: organization.name,
                invite: record,
            };

            if (input.exposeToken && input.baseUrl) {
                const inviteUrl = new URL("/api/auth/invite/accept", input.baseUrl);
                inviteUrl.searchParams.set("token", token.token);
                result.inviteUrl = inviteUrl.toString();
            }

            await trackEvent({
                type: "INVITE_CREATED",
                organizationId: input.organizationId,
                metadata: { 
                    email: normalizedEmail, 
                    role: normalizedRole, 
                    inviteId: invite.id,
                    actorUserId: input.actorUserId,
                },
            });

            let link = result.inviteUrl;
            if (!link && input.baseUrl) {
                const url = new URL("/api/auth/invite/accept", input.baseUrl);
                url.searchParams.set("token", token.token);
                link = url.toString();
            }

            if (link) {
                inviteEmail = {
                    to: normalizedEmail,
                    subject: `Convite para InovaCortex: ${organization.name}`,
                    html: `
                      <h2>Você foi convidado(a) para a equipe!</h2>
                      <p>A organização <strong>${organization.name}</strong> te enviou um convite.</p>
                      <p><a href="${link}">Clique aqui para aceitar e criar sua senha</a></p>
                      <br/>
                      <small>Se você não solicitou isso, pode ignorar este email.</small>
                    `
                };
            }

            return { ok: true, data: result };
        });
        if (outcome.ok && inviteEmail) {
            await sendEmail(inviteEmail);
        }
        return outcome;
    } catch (error) {
        logger.error("Failed to create organization invite", {
            operation: "invite.create",
            organizationId: input.organizationId,
            email: normalizedEmail,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function revokeOrganizationInvite(input: {
    organizationId: string;
    inviteId: string;
    actorUserId: string;
    actorRole: string;
    source: "agency_surface";
}): Promise<OrganizationInviteRevokeOutcome> {
    try {
        return await prisma.$transaction(async (tx) => {
            const invite = await tx.userInvite.findFirst({
                where: {
                    id: input.inviteId,
                    organizationId: input.organizationId,
                },
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
                    organization: {
                        select: {
                            name: true,
                        },
                    },
                },
            });

            if (!invite) {
                return { ok: false, reason: "not_found" };
            }

            if (invite.acceptedAt || invite.revokedAt) {
                return { ok: false, reason: "invalid_state" };
            }

            const updated = await tx.userInvite.update({
                where: { id: invite.id },
                data: {
                    revokedAt: new Date(),
                },
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
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    action: "userInvite:revoked",
                    details: JSON.stringify({
                        organizationId: input.organizationId,
                        organizationName: invite.organization.name,
                        inviteId: invite.id,
                        email: invite.email,
                        role: invite.role,
                        actorUserId: input.actorUserId,
                        actorRole: input.actorRole,
                        source: input.source,
                    }),
                },
            });

            return {
                ok: true,
                organizationId: input.organizationId,
                organizationName: invite.organization.name,
                invite: toInviteRecord(updated),
                changed: true,
            };
        });
    } catch (error) {
        logger.error("Failed to revoke organization invite", {
            operation: "invite.revoke",
            organizationId: input.organizationId,
            inviteId: input.inviteId,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function acceptOrganizationInvite(input: {
    token: string;
    name: string;
    password: string;
    now?: Date;
}): Promise<OrganizationInviteAcceptOutcome> {
    const now = input.now ?? new Date();
    const normalizedName = normalizeName(input.name);
    const normalizedPassword = input.password.trim();
    if (!normalizedName) {
        return { ok: false, reason: "invalid_name" };
    }
    if (normalizedPassword.length < 8) {
        return { ok: false, reason: "weak_password" };
    }

    const tokenHash = hashInviteToken(input.token);

    try {
        return await prisma.$transaction(async (tx) => {
            const invite = await tx.userInvite.findUnique({
                where: { tokenHash },
                select: {
                    id: true,
                    organizationId: true,
                    email: true,
                    role: true,
                    tokenHash: true,
                    expiresAt: true,
                    acceptedAt: true,
                    revokedAt: true,
                    createdByUserId: true,
                    createdAt: true,
                    organization: {
                        select: {
                            name: true,
                            maxUsers: true,
                        },
                    },
                },
            });

            if (!invite) {
                return { ok: false, reason: "invalid_token" };
            }

            if (invite.acceptedAt || invite.revokedAt) {
                return { ok: false, reason: "invalid_token" };
            }

            if (isInviteExpired(invite.expiresAt, now)) {
                return { ok: false, reason: "expired_token" };
            }

            const currentUsers = await tx.user.count({
                where: { organizationId: invite.organizationId },
            });
            if (currentUsers >= invite.organization.maxUsers) {
                return { ok: false, reason: "user_limit_reached" };
            }

            const claimed = await tx.userInvite.updateMany({
                where: {
                    id: invite.id,
                    tokenHash,
                    acceptedAt: null,
                    revokedAt: null,
                },
                data: {
                    acceptedAt: now,
                },
            });

            if (claimed.count !== 1) {
                return { ok: false, reason: "invalid_token" };
            }

            const passwordHash = await hashPassword(normalizedPassword);

            const createdUser = await tx.user.create({
                data: {
                    email: invite.email,
                    name: normalizedName,
                    passwordHash,
                    role: invite.role,
                    organizationId: invite.organizationId,
                    active: true,
                },
                select: {
                    id: true,
                },
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: invite.organizationId,
                    action: "userInvite:accepted",
                    details: JSON.stringify({
                        organizationId: invite.organizationId,
                        organizationName: invite.organization.name,
                        inviteId: invite.id,
                        email: invite.email,
                        role: invite.role,
                        userId: createdUser.id,
                    }),
                },
            });

            await trackEvent({
                type: "INVITE_ACCEPTED",
                userId: createdUser.id,
                organizationId: invite.organizationId,
                metadata: { email: invite.email, role: invite.role, inviteId: invite.id },
            });

            return {
                ok: true,
                organizationId: invite.organizationId,
                organizationName: invite.organization.name,
                userId: createdUser.id,
                email: invite.email,
            };
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to accept organization invite", {
            operation: "invite.accept",
            error: message,
        });
        if (message.toLowerCase().includes("unique")) {
            return { ok: false, reason: "email_conflict" };
        }
        throw error;
    }
}

export function getInviteStatus(input: {
    acceptedAt?: Date | null;
    revokedAt?: Date | null;
    expiresAt: Date;
}, now = new Date()): InviteStatus {
    return deriveInviteStatus(input, now);
}
