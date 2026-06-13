const hashPasswordMock = jest.fn(async (value: string) => `hashed:${value}`);

const mockUserFindFirst = jest.fn();
const mockResetTokenDeleteMany = jest.fn();
const mockResetTokenCreate = jest.fn();
const mockResetTokenFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockAuditEventCreate = jest.fn();

jest.mock("../lib/auth/session", () => ({
    hashPassword: hashPasswordMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        error: jest.fn(),
    },
}));

jest.mock("../lib/prisma", () => ({
    prisma: {
        user: {
            findFirst: mockUserFindFirst,
            update: mockUserUpdate,
        },
        userPasswordResetToken: {
            deleteMany: mockResetTokenDeleteMany,
            create: mockResetTokenCreate,
            findUnique: mockResetTokenFindUnique,
        },
        auditEvent: {
            create: mockAuditEventCreate,
        },
        $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback({
            user: {
                findFirst: mockUserFindFirst,
                update: mockUserUpdate,
            },
            userPasswordResetToken: {
                deleteMany: mockResetTokenDeleteMany,
                create: mockResetTokenCreate,
                findUnique: mockResetTokenFindUnique,
            },
            auditEvent: {
                create: mockAuditEventCreate,
            },
        })),
    },
}));

import {
    confirmPasswordReset,
    requestOrganizationUserPasswordReset,
} from "../lib/auth/password-reset-service";
import { hashPasswordResetToken } from "../lib/auth/password-reset";

describe("password-reset-service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("request generates a hashed single-use token with expiration", async () => {
        mockUserFindFirst.mockResolvedValue({
            id: "user-1",
            name: "Admin Acme",
            email: "admin@acme.com",
            role: "owner",
            active: true,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            lastAccessAt: null,
            organization: {
                id: "org-1",
                name: "Acme",
            },
        });
        mockResetTokenCreate.mockResolvedValue({
            id: "reset-1",
        });
        mockAuditEventCreate.mockResolvedValue({
            id: "audit-1",
        });

        const result = await requestOrganizationUserPasswordReset({
            organizationId: "org-1",
            userId: "user-1",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected success");

        expect(result.data.token).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(result.data.user).toEqual(expect.objectContaining({
            name: "Admin Acme",
            email: "admin@acme.com",
        }));
        expect(mockResetTokenDeleteMany).toHaveBeenCalledWith({
            where: { userId: "user-1" },
        });
        expect(mockResetTokenCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                userId: "user-1",
                tokenHash: hashPasswordResetToken(result.data.token),
                expiresAt: expect.any(Date),
            }),
        }));
        expect(mockAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: "userPasswordReset:requested",
            }),
        }));
    });

    test("confirm rejects invalid and expired tokens", async () => {
        mockResetTokenFindUnique.mockResolvedValueOnce(null);

        const invalid = await confirmPasswordReset({
            token: "invalid-token",
            password: "newSecret123",
        });

        expect(invalid).toEqual({ ok: false, reason: "invalid_token" });

        mockResetTokenFindUnique.mockResolvedValueOnce({
            id: "reset-1",
            expiresAt: new Date("2026-03-22T10:00:00.000Z"),
            user: {
                id: "user-1",
                email: "admin@acme.com",
                organizationId: "org-1",
                organization: {
                    name: "Acme",
                },
            },
        });

        const expired = await confirmPasswordReset({
            token: "expired-token",
            password: "newSecret123",
        });

        expect(expired).toEqual({ ok: false, reason: "expired_token" });
        expect(mockResetTokenDeleteMany).toHaveBeenCalledWith({
            where: { userId: "user-1" },
        });
    });

    test("confirm updates the password and consumes the token exactly once", async () => {
        const token = "reset-token-123";
        const tokenHash = hashPasswordResetToken(token);
        let tokenExists = true;

        mockResetTokenFindUnique.mockImplementation(async () => {
            if (!tokenExists) {
                return null;
            }

            return {
                id: "reset-1",
                expiresAt: new Date("2026-03-25T11:00:00.000Z"),
                user: {
                    id: "user-1",
                    email: "admin@acme.com",
                    organizationId: "org-1",
                    organization: {
                        name: "Acme",
                    },
                },
            };
        });
        mockResetTokenDeleteMany.mockImplementation(async () => {
            tokenExists = false;
            return { count: 1 };
        });
        mockUserUpdate.mockResolvedValue({
            id: "user-1",
        });
        mockAuditEventCreate.mockResolvedValue({
            id: "audit-2",
        });

        const first = await confirmPasswordReset({
            token,
            password: "newSecret123",
        });

        expect(first).toEqual({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            userId: "user-1",
        });
        expect(hashPasswordMock).toHaveBeenCalledWith("newSecret123");
        expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "user-1" },
            data: {
                passwordHash: "hashed:newSecret123",
            },
        }));
        expect(mockResetTokenDeleteMany).toHaveBeenCalledWith({
            where: { userId: "user-1" },
        });
        expect(mockResetTokenFindUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { tokenHash },
        }));

        const second = await confirmPasswordReset({
            token,
            password: "newSecret123",
        });

        expect(second).toEqual({ ok: false, reason: "invalid_token" });
    });
});
