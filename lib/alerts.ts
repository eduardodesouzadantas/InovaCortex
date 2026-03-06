/**
 * lib/alerts.ts
 * V11: Basic alert system for operational monitoring.
 *
 * Creates AlertEvents in the DB for:
 *  - Stripe webhook failures (3x in 10min)
 *  - AI generation failure rate exceeding threshold
 *  - Usage approaching 90% of plan limit (threshold alert)
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AlertType = "webhookFailure" | "aiFailureRate" | "usageThreshold" | "limitExceeded" | "systemError";
export type AlertSeverity = "info" | "warning" | "critical";

// ─── Create Alert ─────────────────────────────────────────────────────────────

export async function createAlert(
    orgId: string,
    type: AlertType,
    message: string,
    severity: AlertSeverity = "warning",
    metadata?: Record<string, unknown>
): Promise<void> {
    try {
        await (prisma as any).alertEvent.create({
            data: {
                organizationId: orgId,
                type,
                severity,
                message,
                metadata: metadata ? JSON.stringify(metadata) : null,
            }
        });
        logger.warn(`Alert created: ${type}`, { orgId, severity, message });
    } catch (err) {
        logger.error("Failed to create alert", { orgId, type, error: String(err) });
    }
}

// ─── Alert Auto-Triggers ──────────────────────────────────────────────────────

/**
 * Check if webhook has failed N times in the last windowMs ms.
 * If so, create a critical alert.
 */
export async function checkWebhookFailureAlert(
    orgId: string,
    failCount: number,
    windowMs: number = 10 * 60 * 1000, // 10 minutes
    threshold: number = 3
): Promise<void> {
    const since = new Date(Date.now() - windowMs);

    const recentFailures = await (prisma as any).alertEvent.count({
        where: {
            organizationId: orgId,
            type: "webhookFailure",
            createdAt: { gte: since },
        }
    });

    if (recentFailures + failCount >= threshold) {
        await createAlert(
            orgId,
            "webhookFailure",
            `Stripe webhook falhou ${recentFailures + failCount}x nos últimos 10 minutos.`,
            "critical",
            { failCount, recentFailures, windowMs }
        );
    }
}

/**
 * Check if AI failure rate for an org today exceeds the given threshold %.
 */
export async function checkAIFailureRateAlert(
    orgId: string,
    failureRatePct: number = 30   // Alert if >30% fail today
): Promise<void> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [total, failures] = await Promise.all([
        (prisma as any).aIInvocation.count({
            where: { organizationId: orgId, createdAt: { gte: startOfDay } }
        }),
        (prisma as any).aIInvocation.count({
            where: { organizationId: orgId, createdAt: { gte: startOfDay }, status: { not: "success" } }
        }),
    ]);

    if (total < 3) return; // Not enough samples

    const rate = Math.round((failures / total) * 100);
    if (rate >= failureRatePct) {
        await createAlert(
            orgId,
            "aiFailureRate",
            `Taxa de falha de IA: ${rate}% (${failures}/${total} chamadas hoje)`,
            rate >= 50 ? "critical" : "warning",
            { total, failures, rate }
        );
    }
}

/**
 * Check if any usage metric has crossed the 90% threshold and create an alert.
 */
export async function checkUsageThresholdAlert(
    orgId: string,
    plan: string,
): Promise<void> {
    const { PLAN_LIMITS, getMonthlyCount, currentMonth } = await import("@/lib/usage");
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const month = currentMonth();

    for (const [type, limit] of Object.entries(limits)) {
        if (limit >= 9999) continue; // Don't alert on unlimited plans

        const current = await getMonthlyCount(orgId, type as any);
        const pct = Math.round((current / limit) * 100);

        if (pct >= 90) {
            // Avoid duplicate alerts: check if we already sent one today
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const existing = await (prisma as any).alertEvent.findFirst({
                where: {
                    organizationId: orgId,
                    type: "usageThreshold",
                    createdAt: { gte: today },
                    metadata: { contains: type },
                }
            });

            if (!existing) {
                await createAlert(
                    orgId,
                    "usageThreshold",
                    `Uso de "${type}" atingiu ${pct}% do limite do plano (${current}/${limit}) — ${month}`,
                    pct >= 100 ? "critical" : "warning",
                    { type, current, limit, pct, month }
                );
            }
        }
    }
}

// ─── Active Alerts Query ──────────────────────────────────────────────────────

export async function getActiveAlerts(orgId: string): Promise<any[]> {
    return (prisma as any).alertEvent.findMany({
        where: { organizationId: orgId, resolved: false },
        orderBy: { createdAt: "desc" },
        take: 10,
    });
}
