import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { PublicApiError } from "@/lib/public-api/v1-auth";
import { logger } from "@/lib/logger";

export type PublicApiIdempotencyReplaySuccess = {
    kind: "success";
    responseStatus: number;
    data: unknown;
};

export type PublicApiIdempotencyReplayError = {
    kind: "error";
    responseStatus: number;
    code: string;
    message: string;
    details?: unknown;
};

export type PublicApiIdempotencyBeginResult =
    | { kind: "claimed"; recordId: string; requestHash: string }
    | { kind: "replay"; replay: PublicApiIdempotencyReplaySuccess | PublicApiIdempotencyReplayError }
    | { kind: "skipped" };

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => canonicalize(item));
    }

    if (value && typeof value === "object") {
        if (value instanceof Date) {
            return value.toISOString();
        }

        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, item]) => [key, canonicalize(item)] as const);

        return Object.fromEntries(entries);
    }

    return value;
}

export function hashPublicApiIdempotencyPayload(payload: unknown): string {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(canonicalize(payload)) ?? "null")
        .digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

function parseJson<T>(value: string | null | undefined): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

export function resolvePublicApiIdempotencyKey(request: Request): string | null {
    const value = request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || null;
}

export async function beginPublicApiIdempotency(input: {
    organizationId: string;
    routeKey: string;
    idempotencyKey: string;
    payload: unknown;
}): Promise<PublicApiIdempotencyBeginResult> {
    const requestHash = hashPublicApiIdempotencyPayload(input.payload);
    const key = input.idempotencyKey.trim();

    if (!key) {
        return { kind: "skipped" };
    }

    try {
        const record = await prisma.publicApiIdempotencyRecord.create({
            data: {
                organizationId: input.organizationId,
                routeKey: input.routeKey,
                idempotencyKey: key,
                requestHash,
                status: "processing",
            },
            select: {
                id: true,
            },
        });

        return {
            kind: "claimed",
            recordId: record.id,
            requestHash,
        };
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }

        const existing = await prisma.publicApiIdempotencyRecord.findUnique({
            where: {
                organizationId_routeKey_idempotencyKey: {
                    organizationId: input.organizationId,
                    routeKey: input.routeKey,
                    idempotencyKey: key,
                },
            },
        });

        if (!existing) {
            throw error;
        }

        if (existing.requestHash !== requestHash) {
            throw new PublicApiError("Idempotency-Key already used with a different request body.", 409, "CONFLICT");
        }

        if (existing.status === "completed" && existing.responseBodyJson) {
            const data = parseJson<unknown>(existing.responseBodyJson);
            return {
                kind: "replay",
                replay: {
                    kind: "success",
                    responseStatus: existing.responseStatus ?? 200,
                    data,
                },
            };
        }

        if (existing.status === "failed" && existing.errorCode && existing.errorMessage) {
            return {
                kind: "replay",
                replay: {
                    kind: "error",
                    responseStatus: existing.responseStatus ?? 400,
                    code: existing.errorCode,
                    message: existing.errorMessage,
                    details: parseJson(existing.errorDetailsJson),
                },
            };
        }

        throw new PublicApiError("Request is already being processed.", 409, "CONFLICT");
    }
}

export async function finalizePublicApiIdempotencySuccess(input: {
    recordId: string;
    responseStatus: number;
    data: unknown;
}): Promise<void> {
    await prisma.publicApiIdempotencyRecord.update({
        where: {
            id: input.recordId,
        },
        data: {
            status: "completed",
            responseStatus: input.responseStatus,
            responseBodyJson: JSON.stringify(input.data),
            errorCode: null,
            errorMessage: null,
            errorDetailsJson: null,
            completedAt: new Date(),
        },
    }).catch((error: unknown) => {
        logger.warn("Failed to finalize public API idempotency success", {
            recordId: input.recordId,
            error: error instanceof Error ? error.message : String(error),
        });
    });
}

export async function finalizePublicApiIdempotencyError(input: {
    recordId: string;
    responseStatus: number;
    code: string;
    message: string;
    details?: unknown;
}): Promise<void> {
    await prisma.publicApiIdempotencyRecord.update({
        where: {
            id: input.recordId,
        },
        data: {
            status: "failed",
            responseStatus: input.responseStatus,
            responseBodyJson: null,
            errorCode: input.code,
            errorMessage: input.message,
            errorDetailsJson: typeof input.details === "undefined" ? null : JSON.stringify(input.details),
            completedAt: new Date(),
        },
    }).catch((error: unknown) => {
        logger.warn("Failed to finalize public API idempotency error", {
            recordId: input.recordId,
            error: error instanceof Error ? error.message : String(error),
        });
    });
}
