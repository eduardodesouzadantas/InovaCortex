/**
 * lib/security/crypto.ts
 * AES-256-GCM encryption/decryption for sensitive values (API tokens, etc.)
 *
 * Encryption format (base64 of):
 *   [ iv (12 bytes) ][ authTag (16 bytes) ][ ciphertext ]
 *
 * Required ENV:  APP_ENCRYPTION_KEY  (min 32 chars, will be SHA-256 derived)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getDerivedKey(): Buffer {
    const raw = process.env.APP_ENCRYPTION_KEY;
    if (!raw || raw.length < 16) {
        throw new Error(
            "APP_ENCRYPTION_KEY is not set or too short. " +
            "Add APP_ENCRYPTION_KEY=<min-32-chars> to your .env file."
        );
    }
    // Derive a stable 32-byte key from the env value
    return createHash("sha256").update(raw).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded blob: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
    const key = getDerivedKey();
    const iv = randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Pack: iv (12) + authTag (16) + ciphertext
    const packed = Buffer.concat([iv, authTag, encrypted]);
    return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded blob produced by encrypt().
 */
export function decrypt(cipherblob: string): string {
    const key = getDerivedKey();
    const packed = Buffer.from(cipherblob, "base64");

    const iv = packed.subarray(0, 12);
    const authTag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString("utf8");
}

/**
 * Return a masked version of a token for display: ••••••••abcd
 */
export function maskToken(value: string): string {
    if (!value || value.length < 4) return "••••";
    return "••••••••" + value.slice(-4);
}

/**
 * Detect if a string looks like an encrypted blob (base64, 40+ chars).
 * Used to avoid double-encrypting.
 */
export function isEncrypted(value: string): boolean {
    return /^[A-Za-z0-9+/=]{40,}$/.test(value);
}
