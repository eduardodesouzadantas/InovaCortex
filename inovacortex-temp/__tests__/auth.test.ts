/**
 * __tests__/auth.test.ts
 * V9: Auth tests — bcrypt hashing and RBAC role system.
 * JWT session tests are omitted here because `jose` is an ESM-only package
 * incompatible with Jest's CommonJS runner. JWT is covered by integration tests.
 */

import bcrypt from "bcryptjs";
import { hasRole, assertRole, can } from "../lib/auth/rbac";

// ─── Password Tests ───────────────────────────────────────────────────────────

describe("Auth: Password Hashing (bcrypt)", () => {
    test("hashPassword produces a bcrypt hash", async () => {
        const hash = await bcrypt.hash("myPassword123", 10);
        expect(hash).toMatch(/^\$2[aby]\$/);
        expect(hash.length).toBeGreaterThan(30);
    });

    test("compare returns true for correct password", async () => {
        const hash = await bcrypt.hash("correct-horse-battery", 10);
        const ok = await bcrypt.compare("correct-horse-battery", hash);
        expect(ok).toBe(true);
    });

    test("compare returns false for wrong password", async () => {
        const hash = await bcrypt.hash("correct-horse-battery", 10);
        const ok = await bcrypt.compare("wrong-password", hash);
        expect(ok).toBe(false);
    });

    test("two hashes of same password are different (salt)", async () => {
        const h1 = await bcrypt.hash("same-password", 10);
        const h2 = await bcrypt.hash("same-password", 10);
        expect(h1).not.toBe(h2);
    });
});

// ─── RBAC Tests ───────────────────────────────────────────────────────────────

describe("RBAC: Role Hierarchy", () => {
    test("owner has access to all roles", () => {
        expect(hasRole("owner", "owner")).toBe(true);
        expect(hasRole("owner", "admin")).toBe(true);
        expect(hasRole("owner", "closer")).toBe(true);
        expect(hasRole("owner", "viewer")).toBe(true);
    });

    test("admin has access to closer and viewer but not owner", () => {
        expect(hasRole("admin", "owner")).toBe(false);
        expect(hasRole("admin", "admin")).toBe(true);
        expect(hasRole("admin", "closer")).toBe(true);
        expect(hasRole("admin", "viewer")).toBe(true);
    });

    test("closer can access viewer but not admin or owner", () => {
        expect(hasRole("closer", "owner")).toBe(false);
        expect(hasRole("closer", "admin")).toBe(false);
        expect(hasRole("closer", "closer")).toBe(true);
        expect(hasRole("closer", "viewer")).toBe(true);
    });

    test("viewer cannot perform closer/admin/owner actions", () => {
        expect(hasRole("viewer", "closer")).toBe(false);
        expect(hasRole("viewer", "admin")).toBe(false);
        expect(hasRole("viewer", "owner")).toBe(false);
    });

    test("assertRole throws FORBIDDEN for insufficient permissions", () => {
        expect(() => assertRole("viewer", "admin")).toThrow("FORBIDDEN");
        expect(() => assertRole("closer", "owner")).toThrow("FORBIDDEN");
    });

    test("assertRole does not throw for sufficient role", () => {
        expect(() => assertRole("owner", "admin")).not.toThrow();
        expect(() => assertRole("admin", "closer")).not.toThrow();
    });

    test("can() works correctly on typed permissions", () => {
        expect(can("owner", "manageUsers")).toBe(true);
        expect(can("admin", "manageUsers")).toBe(false);
        expect(can("closer", "generateProposal")).toBe(true);
        expect(can("viewer", "generateProposal")).toBe(false);
        expect(can("viewer", "viewDashboard")).toBe(true);
        expect(can("admin", "manageSettings")).toBe(true);
    });
});
