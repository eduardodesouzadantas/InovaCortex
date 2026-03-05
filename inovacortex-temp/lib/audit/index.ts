/**
 * lib/audit/index.ts
 * Central audit logging helper. All significant system actions must go through here.
 *
 * Usage:
 *   await logAudit("assessment", assessmentId, "created", { name, email });
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AuditEntityType =
    | "assessment"
    | "dossier"
    | "pdf"
    | "presales"
    | "token"
    | "status"
    | "whatsapp"
    | "system";

export async function logAudit(
    entityType: AuditEntityType,
    entityId: string,
    action: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    try {
        // Map to the existing AuditEvent table (assessmentId = entityId for assessment-linked events)
        // For global events (token updates etc.), we'll use a special sentinel assessmentId
        const isAssessmentLinked = entityType === "assessment" ||
            entityType === "dossier" ||
            entityType === "pdf" ||
            entityType === "whatsapp" ||
            entityType === "presales" ||
            entityType === "status";

        if (isAssessmentLinked) {
            await (prisma as any).auditEvent.create({
                data: {
                    assessmentId: entityId,
                    action: `${entityType}:${action}`,
                    details: metadata ? JSON.stringify(metadata) : null,
                },
            });
        } else {
            // For system-level events (token changes, etc.) — store in SystemSetting as a special key
            // In a production system you'd have a separate GlobalAuditEvent model
            logger.info(`[AUDIT] ${entityType}:${action}`, { entityId, ...metadata });
        }
    } catch (err: any) {
        // Never let audit failures crash the main flow
        logger.warn("Failed to write audit event", {
            entityType, entityId, action,
            error: err?.message,
        });
    }
}
