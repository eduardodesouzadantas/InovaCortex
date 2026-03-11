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

export interface WriteAuditEventInput {
    organizationId: string;
    action: string;
    assessmentId?: string | null;
    details?: unknown;
    strict?: boolean;
    context?: Record<string, unknown>;
}

function serializeDetails(details: unknown): string | null {
    if (details === undefined || details === null) {
        return null;
    }
    if (typeof details === "string") {
        return details;
    }
    try {
        return JSON.stringify(details);
    } catch {
        return String(details);
    }
}

function resolveOrganizationId(metadata?: Record<string, unknown>): string {
    const fromMetadata = metadata?.organizationId ?? metadata?.orgId;
    if (typeof fromMetadata === "string" && fromMetadata.trim().length > 0) {
        return fromMetadata.trim();
    }
    return "default-org-id";
}

export async function writeAuditEvent(input: WriteAuditEventInput): Promise<void> {
    const details = serializeDetails(input.details);

    try {
        await prisma.auditEvent.create({
            data: {
                organizationId: input.organizationId,
                assessmentId: input.assessmentId ?? null,
                action: input.action,
                details,
            },
        });
    } catch (error: any) {
        logger.error("Failed to persist audit event", {
            organizationId: input.organizationId,
            assessmentId: input.assessmentId ?? null,
            action: input.action,
            details,
            context: input.context,
            error: error?.message ?? String(error),
        });

        if (input.strict) {
            throw error;
        }
    }
}

export async function logAudit(
    entityType: AuditEntityType,
    entityId: string,
    action: string,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        // Map to the existing AuditEvent table (assessmentId = entityId for assessment-linked events)
        // For global events (token updates etc.), emit structured app log.
        const isAssessmentLinked = entityType === "assessment" ||
            entityType === "dossier" ||
            entityType === "pdf" ||
            entityType === "whatsapp" ||
            entityType === "presales" ||
            entityType === "status";

        if (isAssessmentLinked) {
            await writeAuditEvent({
                organizationId: resolveOrganizationId(metadata),
                assessmentId: entityId,
                action: `${entityType}:${action}`,
                details: metadata ?? null,
                strict: false,
                context: { entityType, entityId },
            });
            return;
        }

        logger.info(`[AUDIT] ${entityType}:${action}`, { entityId, ...metadata });
    } catch (err: any) {
        // Never let audit failures crash the main flow
        logger.warn("Failed to write audit event", {
            entityType,
            entityId,
            action,
            error: err?.message,
        });
    }
}
