import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/session";
import { trackEvent } from "@/app/services/identityEvents/identityEvent.service";
import { sendEmail } from "@/app/services/communication/email.service";
import type { OrganizationUserRecord } from "@/lib/repositories/organizationUserRepository";
import { generatePasswordResetToken, hashPasswordResetToken, isPasswordResetTokenExpired } from "@/lib/auth/password-reset";

type ResetSource = "agency_surface";

export interface PasswordResetRequestSuccess {
    organizationId: string;
    organizationName: string;
    user: OrganizationUserRecord;
    token: string;
    expiresAt: string;
}

export type PasswordResetRequestResult =
    | { ok: true; data: PasswordResetRequestSuccess }
    | { ok: false; reason: "not_found" };

export type PasswordResetConfirmResult =
    | { ok: true; organizationId: string; organizationName: string; userId: string }
    | { ok: false; reason: "invalid_token" | "expired_token" | "weak_password" };

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

export async function requestOrganizationUserPasswordReset(input: {
    organizationId: string;
    userId: string;
    actorUserId: string;
    actorRole: string;
    source: ResetSource;
    baseUrl?: string;
}): Promise<PasswordResetRequestResult> {
    let resetEmail: Parameters<typeof sendEmail>[0] | null = null;
    try {
        const outcome = await prisma.$transaction(async (tx): Promise<PasswordResetRequestResult> => {
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

            const generated = generatePasswordResetToken();

            await tx.userPasswordResetToken.deleteMany({
                where: { userId: user.id },
            });

            await tx.userPasswordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash: generated.tokenHash,
                    expiresAt: generated.expiresAt,
                },
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: input.organizationId,
                    action: "userPasswordReset:requested",
                    details: JSON.stringify({
                        organizationId: input.organizationId,
                        organizationName: user.organization.name,
                        userId: user.id,
                        email: user.email,
                        actorUserId: input.actorUserId,
                        actorRole: input.actorRole,
                        source: input.source,
                        expiresAt: generated.expiresAt.toISOString(),
                    }),
                },
            });

            await trackEvent({
                type: "PASSWORD_RESET_REQUESTED",
                userId: user.id,
                organizationId: input.organizationId,
                metadata: { email: user.email, actorUserId: input.actorUserId },
            });

            let link = "";
            if (input.baseUrl) {
                const url = new URL("/api/auth/reset/confirm", input.baseUrl);
                url.searchParams.set("token", generated.token);
                link = url.toString();
            }

            if (link) {
                resetEmail = {
                    to: user.email,
                    subject: "Redefinição de Senha - InovaCortex",
                    html: `
                        <h2>Recuperação de Senha</h2>
                        <p>Você solicitou a redefinição de senha na organização <strong>${user.organization.name}</strong>.</p>
                        <p><a href="${link}">Clique aqui para redefinir sua senha</a></p>
                        <br/>
                        <small>Se você não solicitou isso, pode ignorar este email.</small>
                    `
                };
            }

            return {
                ok: true,
                data: {
                    organizationId: user.organization.id,
                    organizationName: user.organization.name,
                    user: toUserRecord(user),
                    token: generated.token,
                    expiresAt: generated.expiresAt.toISOString(),
                },
            };
        });
        if (outcome.ok && resetEmail) {
            await sendEmail(resetEmail);
        }
        return outcome;
    } catch (error) {
        logger.error("Failed to request organization user password reset", {
            operation: "passwordReset.request",
            organizationId: input.organizationId,
            userId: input.userId,
            actorUserId: input.actorUserId,
            actorRole: input.actorRole,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function confirmPasswordReset(input: {
    token: string;
    password: string;
}): Promise<PasswordResetConfirmResult> {
    const normalizedPassword = input.password.trim();
    if (normalizedPassword.length < 8) {
        return { ok: false, reason: "weak_password" };
    }

    const tokenHash = hashPasswordResetToken(input.token);

    try {
        return await prisma.$transaction(async (tx) => {
            const tokenRecord = await tx.userPasswordResetToken.findUnique({
                where: { tokenHash },
                select: {
                    id: true,
                    expiresAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            organizationId: true,
                            organization: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!tokenRecord) {
                return { ok: false, reason: "invalid_token" };
            }

            if (isPasswordResetTokenExpired(tokenRecord.expiresAt)) {
                await tx.userPasswordResetToken.deleteMany({
                    where: { userId: tokenRecord.user.id },
                });
                return { ok: false, reason: "expired_token" };
            }

            const passwordHash = await hashPassword(normalizedPassword);

            await tx.user.update({
                where: { id: tokenRecord.user.id },
                data: {
                    passwordHash,
                },
            });

            await tx.userPasswordResetToken.deleteMany({
                where: { userId: tokenRecord.user.id },
            });

            await tx.auditEvent.create({
                data: {
                    organizationId: tokenRecord.user.organizationId,
                    action: "userPasswordReset:completed",
                    details: JSON.stringify({
                        organizationId: tokenRecord.user.organizationId,
                        organizationName: tokenRecord.user.organization.name,
                        userId: tokenRecord.user.id,
                        email: tokenRecord.user.email,
                    }),
                },
            });

            await trackEvent({
                type: "PASSWORD_RESET_COMPLETED",
                userId: tokenRecord.user.id,
                organizationId: tokenRecord.user.organizationId,
                metadata: { email: tokenRecord.user.email },
            });

            return {
                ok: true,
                organizationId: tokenRecord.user.organizationId,
                organizationName: tokenRecord.user.organization.name,
                userId: tokenRecord.user.id,
            };
        });
    } catch (error) {
        logger.error("Failed to confirm organization user password reset", {
            operation: "passwordReset.confirm",
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
