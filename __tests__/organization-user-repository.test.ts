const hashPasswordMock = jest.fn(async (value: string) => `hashed:${value}`);

const mockOrganizationFindUnique = jest.fn();
const mockUserCount = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockUserFindFirst = jest.fn();
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

const mockPrisma = {
    organization: {
        findUnique: mockOrganizationFindUnique,
    },
    user: {
        count: mockUserCount,
        findUnique: mockUserFindUnique,
        create: mockUserCreate,
        findFirst: mockUserFindFirst,
        update: mockUserUpdate,
    },
    auditEvent: {
        create: mockAuditEventCreate,
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: {
        organization: mockPrisma.organization,
        user: mockPrisma.user,
        auditEvent: mockPrisma.auditEvent,
        $transaction: jest.fn(async (callback: (tx: any) => Promise<any>) => callback({
            organization: mockPrisma.organization,
            user: mockPrisma.user,
            auditEvent: mockPrisma.auditEvent,
        })),
    },
}));

import {
    createOrganizationInitialUser,
    updateOrganizationUserActive,
} from "../lib/repositories/organizationUserRepository";

describe("organizationUserRepository", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("creates the initial organization user with an audit event", async () => {
        mockOrganizationFindUnique.mockResolvedValue({
            id: "org-1",
            name: "Acme",
            maxUsers: 5,
        });
        mockUserCount.mockResolvedValue(0);
        mockUserFindUnique.mockResolvedValue(null);
        mockUserCreate.mockResolvedValue({
            id: "user-1",
            name: "Admin Acme",
            email: "admin@acme.com",
            role: "owner",
            active: true,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            lastAccessAt: null,
        });
        mockAuditEventCreate.mockResolvedValue({
            id: "audit-1",
        });

        const result = await createOrganizationInitialUser({
            organizationId: "org-1",
            name: "Admin Acme",
            email: "Admin@Acme.com",
            password: "initial-pass",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected success");
        expect(result.user).toEqual(expect.objectContaining({
            name: "Admin Acme",
            email: "admin@acme.com",
            role: "owner",
            active: true,
        }));
        expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: "Admin Acme",
                email: "admin@acme.com",
                passwordHash: "hashed:initial-pass",
                role: "owner",
                organizationId: "org-1",
                active: true,
            }),
        }));
        expect(mockAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                action: "agencyOrganizationUser:created",
            }),
        }));
    });

    test("blocks initial user creation when the organization already has users", async () => {
        mockOrganizationFindUnique.mockResolvedValue({
            id: "org-1",
            name: "Acme",
            maxUsers: 5,
        });
        mockUserCount.mockResolvedValue(1);

        const result = await createOrganizationInitialUser({
            organizationId: "org-1",
            email: "admin@acme.com",
            password: "initial-pass",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result).toEqual({ ok: false, reason: "already_has_users" });
        expect(mockUserCreate).not.toHaveBeenCalled();
    });

    test("activates an organization user and records an audit event", async () => {
        mockUserFindFirst.mockResolvedValue({
            id: "user-1",
            name: "Owner Acme",
            email: "owner@acme.com",
            role: "owner",
            active: false,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            lastAccessAt: new Date("2026-03-22T11:00:00.000Z"),
            organization: {
                id: "org-1",
                name: "Acme",
            },
        });
        mockUserUpdate.mockResolvedValue({
            id: "user-1",
            name: "Owner Acme",
            email: "owner@acme.com",
            role: "owner",
            active: true,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            lastAccessAt: new Date("2026-03-22T11:00:00.000Z"),
            organization: {
                id: "org-1",
                name: "Acme",
            },
        });
        mockAuditEventCreate.mockResolvedValue({
            id: "audit-2",
        });

        const result = await updateOrganizationUserActive({
            organizationId: "org-1",
            userId: "user-1",
            nextActive: true,
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected success");
        expect(result.changed).toBe(true);
        expect(result.previousActive).toBe(false);
        expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "user-1" },
            data: { active: true },
        }));
        expect(mockAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: "agencyOrganizationUser:activated",
                organizationId: "org-1",
            }),
        }));
    });

    test("deactivates an organization user and records an audit event", async () => {
        mockUserFindFirst.mockResolvedValue({
            id: "user-1",
            name: "Owner Acme",
            email: "owner@acme.com",
            role: "owner",
            active: true,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            lastAccessAt: new Date("2026-03-22T11:00:00.000Z"),
            organization: {
                id: "org-1",
                name: "Acme",
            },
        });
        mockUserUpdate.mockResolvedValue({
            id: "user-1",
            email: "owner@acme.com",
            role: "owner",
            active: false,
            createdAt: new Date("2026-03-22T10:00:00.000Z"),
            organization: {
                id: "org-1",
                name: "Acme",
            },
        });
        mockAuditEventCreate.mockResolvedValue({
            id: "audit-3",
        });

        const result = await updateOrganizationUserActive({
            organizationId: "org-1",
            userId: "user-1",
            nextActive: false,
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        });

        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error("expected success");
        expect(result.changed).toBe(true);
        expect(result.previousActive).toBe(true);
        expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "user-1" },
            data: { active: false },
        }));
        expect(mockAuditEventCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                action: "agencyOrganizationUser:deactivated",
                organizationId: "org-1",
            }),
        }));
    });
});
