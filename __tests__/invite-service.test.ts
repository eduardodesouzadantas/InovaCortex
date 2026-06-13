const hashPasswordMock = jest.fn(async (value: string) => `hashed:${value}`);

const mockOrganizationFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserCount = jest.fn();
const mockUserCreate = jest.fn();
const mockUserInviteUpdateMany = jest.fn();
const mockUserInviteCreate = jest.fn();
const mockUserInviteFindFirst = jest.fn();
const mockUserInviteFindUnique = jest.fn();
const mockUserInviteUpdate = jest.fn();
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
        organization: {
            findUnique: mockOrganizationFindUnique,
        },
        user: {
            findUnique: mockUserFindUnique,
            count: mockUserCount,
            create: mockUserCreate,
        },
        userInvite: {
            updateMany: mockUserInviteUpdateMany,
            create: mockUserInviteCreate,
            findFirst: mockUserInviteFindFirst,
            findUnique: mockUserInviteFindUnique,
            update: mockUserInviteUpdate,
        },
        auditEvent: {
            create: mockAuditEventCreate,
        },
        $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback({
            organization: {
                findUnique: mockOrganizationFindUnique,
            },
            user: {
                findUnique: mockUserFindUnique,
                count: mockUserCount,
                create: mockUserCreate,
            },
            userInvite: {
                updateMany: mockUserInviteUpdateMany,
                create: mockUserInviteCreate,
                findFirst: mockUserInviteFindFirst,
                findUnique: mockUserInviteFindUnique,
                update: mockUserInviteUpdate,
            },
            auditEvent: {
                create: mockAuditEventCreate,
            },
        })),
    },
}));

import {
    acceptOrganizationInvite,
    createOrganizationInvite,
    revokeOrganizationInvite,
} from "../lib/auth/invite-service";

describe("invite-service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("creates an invite with a hashed token and revokes older pending invites", async () => {
        mockOrganizationFindUnique.mockResolvedValue({
            id: "org-1",
            name: "Acme",
            maxUsers: 5,
        });
        mockUserFindUnique.mockResolvedValue(null);
        mockUserCount.mockResolvedValue(1);
        mockUserInviteUpdateMany.mockResolvedValue({ count: 1 });
        mockUserInviteCreate.mockResolvedValue({
            id: "invite-1",
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "admin",
            expiresAt: new Date("2026-03-31T10:00:00.000Z"),
            acceptedAt: null,
            revokedAt: null,
            createdByUserId: "agency-user-1",
            createdAt: new Date("2026-03-24T10:00:00.000Z"),
        });
        mockAuditEventCreate.mockResolvedValue({ id: "audit-1" });

        const result = await createOrganizationInvite({
            organizationId: "org-1",
            email: "Invitee@Acme.com",
            role: "admin",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
            exposeToken: true,
            baseUrl: "http://localhost:3000",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected success");
        expect(result.data.invite.email).toBe("invitee@acme.com");
        expect(result.data.invite.status).toBe("pending");
        expect(result.data.inviteUrl).toContain("/api/auth/invite/accept?token=");
        expect(mockUserInviteUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                organizationId: "org-1",
                email: "invitee@acme.com",
                acceptedAt: null,
                revokedAt: null,
            }),
            data: {
                revokedAt: expect.any(Date),
            },
        }));
        expect(mockAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: "userInvite:created",
            }),
        }));
    });

    test("rejects invalid invite roles", async () => {
        const result = await createOrganizationInvite({
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "invalid",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result).toEqual({ ok: false, reason: "invalid_role" });
        expect(mockOrganizationFindUnique).not.toHaveBeenCalled();
    });

    test("revokes a pending invite", async () => {
        mockUserInviteFindFirst.mockResolvedValue({
            id: "invite-1",
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "viewer",
            expiresAt: new Date("2026-03-31T10:00:00.000Z"),
            acceptedAt: null,
            revokedAt: null,
            createdByUserId: "agency-user-1",
            createdAt: new Date("2026-03-24T10:00:00.000Z"),
            organization: {
                name: "Acme",
            },
        });
        mockUserInviteUpdate.mockResolvedValue({
            id: "invite-1",
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "viewer",
            expiresAt: new Date("2026-03-31T10:00:00.000Z"),
            acceptedAt: null,
            revokedAt: new Date("2026-03-24T12:00:00.000Z"),
            createdByUserId: "agency-user-1",
            createdAt: new Date("2026-03-24T10:00:00.000Z"),
        });
        mockAuditEventCreate.mockResolvedValue({ id: "audit-2" });

        const result = await revokeOrganizationInvite({
            organizationId: "org-1",
            inviteId: "invite-1",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected success");
        expect(result.invite.status).toBe("revoked");
        expect(mockUserInviteUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "invite-1" },
            data: expect.objectContaining({
                revokedAt: expect.any(Date),
            }),
        }));
    });

    test("accepts a valid invite and creates the user account", async () => {
        mockUserInviteFindUnique.mockResolvedValue({
            id: "invite-1",
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "viewer",
            tokenHash: "token-hash",
            expiresAt: new Date("2026-03-31T10:00:00.000Z"),
            acceptedAt: null,
            revokedAt: null,
            createdByUserId: "agency-user-1",
            createdAt: new Date("2026-03-24T10:00:00.000Z"),
            organization: {
                name: "Acme",
                maxUsers: 5,
            },
        });
        mockUserCount.mockResolvedValue(1);
        mockUserInviteUpdateMany.mockResolvedValue({ count: 1 });
        mockUserCreate.mockResolvedValue({
            id: "user-1",
        });
        mockAuditEventCreate.mockResolvedValue({ id: "audit-3" });

        const result = await acceptOrganizationInvite({
            token: "raw-token",
            name: "Invitee Acme",
            password: "newSecret123",
            now: new Date("2026-03-24T10:00:00.000Z"),
        });

        expect(result).toEqual({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            userId: "user-1",
            email: "invitee@acme.com",
        });
        expect(hashPasswordMock).toHaveBeenCalledWith("newSecret123");
        expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                email: "invitee@acme.com",
                name: "Invitee Acme",
                passwordHash: "hashed:newSecret123",
                role: "viewer",
                organizationId: "org-1",
                active: true,
            }),
        }));
    });

    test("rejects invalid invite tokens", async () => {
        mockUserInviteFindUnique.mockResolvedValue(null);

        const result = await acceptOrganizationInvite({
            token: "missing",
            name: "Invitee Acme",
            password: "newSecret123",
        });

        expect(result).toEqual({ ok: false, reason: "invalid_token" });
    });

    test("rejects expired invite tokens", async () => {
        mockUserInviteFindUnique.mockResolvedValue({
            id: "invite-1",
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "viewer",
            tokenHash: "token-hash",
            expiresAt: new Date("2026-03-24T09:00:00.000Z"),
            acceptedAt: null,
            revokedAt: null,
            createdByUserId: "agency-user-1",
            createdAt: new Date("2026-03-24T08:00:00.000Z"),
            organization: {
                name: "Acme",
                maxUsers: 5,
            },
        });

        const result = await acceptOrganizationInvite({
            token: "raw-token",
            name: "Invitee Acme",
            password: "newSecret123",
            now: new Date("2026-03-24T10:00:00.000Z"),
        });

        expect(result).toEqual({ ok: false, reason: "expired_token" });
    });

    test("rejects reused invite tokens", async () => {
        mockUserInviteFindUnique.mockResolvedValue({
            id: "invite-1",
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "viewer",
            tokenHash: "token-hash",
            expiresAt: new Date("2026-03-31T10:00:00.000Z"),
            acceptedAt: null,
            revokedAt: null,
            createdByUserId: "agency-user-1",
            createdAt: new Date("2026-03-24T10:00:00.000Z"),
            organization: {
                name: "Acme",
                maxUsers: 5,
            },
        });
        mockUserCount.mockResolvedValue(1);
        mockUserInviteUpdateMany.mockResolvedValue({ count: 0 });

        const result = await acceptOrganizationInvite({
            token: "raw-token",
            name: "Invitee Acme",
            password: "newSecret123",
            now: new Date("2026-03-24T10:00:00.000Z"),
        });

        expect(result).toEqual({ ok: false, reason: "invalid_token" });
    });
});
