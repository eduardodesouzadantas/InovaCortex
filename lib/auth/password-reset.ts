import { createHash, randomBytes } from "crypto";

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TTL_MINUTES = 30;

export interface GeneratedPasswordResetToken {
    token: string;
    tokenHash: string;
    expiresAt: Date;
}

export function hashPasswordResetToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generatePasswordResetToken(now = new Date()): GeneratedPasswordResetToken {
    const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url");
    return {
        token,
        tokenHash: hashPasswordResetToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
    };
}

export function isPasswordResetTokenExpired(expiresAt: Date, now = new Date()): boolean {
    return expiresAt.getTime() <= now.getTime();
}

