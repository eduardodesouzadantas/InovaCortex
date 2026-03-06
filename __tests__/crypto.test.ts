/**
 * __tests__/crypto.test.ts
 * Tests for lib/security/crypto.ts
 *
 * Run: npx jest __tests__/crypto.test.ts
 */

// Setup fake encryption key for tests
process.env.APP_ENCRYPTION_KEY = "test-encryption-key-for-unit-tests-32c";

import { encrypt, decrypt, maskToken, isEncrypted } from "../lib/security/crypto";

describe("AES-256-GCM Encryption", () => {
    test("encrypt produces a non-empty base64 string", () => {
        const cipherblob = encrypt("my-secret-token");
        expect(typeof cipherblob).toBe("string");
        expect(cipherblob.length).toBeGreaterThan(40);
    });

    test("decrypt correctly reverses encrypt", () => {
        const original = "META_ACCESS_TOKEN_abc123xyz";
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    test("two encryptions of the same value produce different ciphertexts (random IV)", () => {
        const val = "same-value";
        const enc1 = encrypt(val);
        const enc2 = encrypt(val);
        expect(enc1).not.toBe(enc2);
        // Both decrypt to the same original
        expect(decrypt(enc1)).toBe(val);
        expect(decrypt(enc2)).toBe(val);
    });

    test("decrypt throws on tampered ciphertext", () => {
        const enc = encrypt("hello");
        const tampered = enc.slice(0, -4) + "XXXX";
        expect(() => decrypt(tampered)).toThrow();
    });

    test("maskToken returns last 4 chars with bullet prefix", () => {
        expect(maskToken("EAABcdef1234")).toBe("••••••••1234");
        expect(maskToken("ab")).toBe("••••");
        expect(maskToken("")).toBe("••••");
    });

    test("isEncrypted detects encrypted blobs correctly", () => {
        const enc = encrypt("a real token");
        expect(isEncrypted(enc)).toBe(true);
        expect(isEncrypted("plain-value")).toBe(false);
        expect(isEncrypted("EAABcdef")).toBe(false);
    });
});
