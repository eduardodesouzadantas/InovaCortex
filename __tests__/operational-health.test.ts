const mockVerifyDatabaseConnection = jest.fn();

jest.mock("@/lib/system/db-check", () => ({
    verifyDatabaseConnection: mockVerifyDatabaseConnection,
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        emailIntegration: {
            count: jest.fn(),
            findFirst: jest.fn(),
        },
        webhookEndpoint: {
            count: jest.fn(),
            findFirst: jest.fn(),
        },
    },
}));

import { prisma } from "@/lib/prisma";
import { resetObservabilityMetrics } from "@/lib/observability/metrics";
import { clearOperationalHealthCache, getOperationalHealthReport } from "@/lib/system/operational-health";

const mockEmailCount = (prisma as any).emailIntegration.count as jest.MockedFunction<any>;
const mockEmailFindFirst = (prisma as any).emailIntegration.findFirst as jest.MockedFunction<any>;
const mockWebhookCount = (prisma as any).webhookEndpoint.count as jest.MockedFunction<any>;
const mockWebhookFindFirst = (prisma as any).webhookEndpoint.findFirst as jest.MockedFunction<any>;

describe("operational health report", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearOperationalHealthCache();
        resetObservabilityMetrics();
        mockVerifyDatabaseConnection.mockResolvedValue({
            ok: true,
            status: "connected",
            error: null,
            code: null,
            configuration: {
                databaseUrl: { configured: true, mode: "pooled", port: "6543" },
                directUrl: { configured: true, mode: "direct", port: "5432" },
                warnings: [],
            },
        });
    });

    it("reports ok when db, email sync, and webhooks are healthy", async () => {
        mockEmailCount.mockResolvedValue(1);
        mockEmailFindFirst.mockResolvedValue({
            provider: "google",
            status: "connected",
            lastSyncAt: new Date(Date.now() - 10 * 60 * 1000),
            lastSyncStatus: "success",
            lastSyncDurationMs: 1234,
            lastError: null,
            updatedAt: new Date(),
        });
        mockWebhookCount.mockResolvedValue(2);
        mockWebhookFindFirst.mockResolvedValue({
            url: "https://example.com/webhook",
            isActive: true,
            subscribedEvents: ["deal.updated"],
            lastDeliveryAt: new Date(Date.now() - 5 * 60 * 1000),
            lastDeliveryStatus: "delivered",
            lastDeliveryError: null,
            deliveryAttemptCount: 4,
            updatedAt: new Date(),
        });

        const report = await getOperationalHealthReport();

        expect(report.status).toBe("ok");
        expect(report.subsystems.db.status).toBe("ok");
        expect(report.subsystems.emailSync.status).toBe("ok");
        expect(report.subsystems.webhooks.status).toBe("ok");
        expect(report.subsystems.emailSync.details).not.toHaveProperty("lastError");
        expect(report.subsystems.webhooks.details).not.toHaveProperty("url");
        expect(report.subsystems.webhooks.details).not.toHaveProperty("lastDeliveryError");
        expect(report.metrics.summary.totalRequests).toBeGreaterThanOrEqual(0);
    });

    it("degrades when email sync is stale or failing", async () => {
        mockEmailCount.mockResolvedValue(1);
        mockEmailFindFirst.mockResolvedValue({
            provider: "google",
            status: "connected",
            lastSyncAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
            lastSyncStatus: "failed",
            lastSyncDurationMs: 987,
            lastError: "Sync failed",
            updatedAt: new Date(),
        });
        mockWebhookCount.mockResolvedValue(0);
        mockWebhookFindFirst.mockResolvedValue(null);

        const report = await getOperationalHealthReport();

        expect(report.status).toBe("degraded");
        expect(report.subsystems.emailSync.status).toBe("degraded");
        expect(report.subsystems.webhooks.status).toBe("degraded");
    });

    it("returns down when the database is unavailable", async () => {
        mockVerifyDatabaseConnection.mockResolvedValue({
            ok: false,
            status: "disconnected",
            error: "DATABASE_UNAVAILABLE",
            code: "SERVICE_UNAVAILABLE",
            details: {
                message: "connection refused",
            },
            configuration: {
                databaseUrl: { configured: true, mode: "pooled", port: "6543" },
                directUrl: { configured: true, mode: "direct", port: "5432" },
                warnings: ["DATABASE_URL warning"],
            },
        });

        const report = await getOperationalHealthReport();

        expect(report.status).toBe("down");
        expect(report.subsystems.db.status).toBe("down");
        expect(report.subsystems.emailSync.status).toBe("down");
        expect(report.subsystems.webhooks.status).toBe("down");
        expect(mockEmailCount).not.toHaveBeenCalled();
        expect(mockWebhookCount).not.toHaveBeenCalled();
    });
});
