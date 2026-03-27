import { createHash, randomBytes } from "crypto";

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

const INVITE_TOKEN_BYTES = 32;
const INVITE_TTL_DAYS = 7;

export const VALID_INVITE_ROLES = new Set(["owner", "admin", "closer", "viewer"] as const);

export function hashInviteToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateInviteToken(now = new Date()): { token: string; tokenHash: string; expiresAt: Date } {
    const token = randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
    return {
        token,
        tokenHash: hashInviteToken(token),
        expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    };
}

export function isInviteExpired(expiresAt: Date, now = new Date()): boolean {
    return expiresAt.getTime() <= now.getTime();
}

export function deriveInviteStatus(input: {
    acceptedAt?: Date | null;
    revokedAt?: Date | null;
    expiresAt: Date;
}, now = new Date()): InviteStatus {
    if (input.acceptedAt) return "accepted";
    if (input.revokedAt) return "revoked";
    if (isInviteExpired(input.expiresAt, now)) return "expired";
    return "pending";
}
