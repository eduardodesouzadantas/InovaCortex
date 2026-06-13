import { ZodError, type ZodType } from "zod";

const AI_DEPENDENCY_CODES = new Set([
    "AI_ENGINE_UNAVAILABLE",
    "FAILED_DEPENDENCY",
    "OPENAI_API_KEY_MISSING",
    "OPENAI_TIMEOUT",
    "OPENAI_RATE_LIMIT",
    "OPENAI_UPSTREAM_ERROR",
    "OPENAI_REQUEST_FAILED",
    "CONTENT_GENERATION_FAILED",
    "CONTENT_MODEL_GENERATION_FAILED",
]);

type RouteErrorOptions = {
    details?: unknown;
    cause?: unknown;
};

export class ApiRouteError extends Error {
    status: number;
    code: string;
    details?: unknown;

    constructor(status: number, code: string, message: string, options?: RouteErrorOptions) {
        super(message);
        this.name = "ApiRouteError";
        this.status = status;
        this.code = code;
        this.details = options?.details;
        if (options?.cause) {
            (this as Error & { cause?: unknown }).cause = options.cause;
        }
    }
}

export function isApiRouteError(error: unknown): error is ApiRouteError {
    return error instanceof ApiRouteError;
}

export function notFoundError(message = "NOT_FOUND", code = "NOT_FOUND", details?: unknown): ApiRouteError {
    return new ApiRouteError(404, code, message, { details });
}

export function invalidPayloadError(details: unknown, message = "INVALID_PAYLOAD"): ApiRouteError {
    return new ApiRouteError(422, "INVALID_PAYLOAD", message, { details });
}

export function failedDependencyError(message = "AI_ENGINE_UNAVAILABLE", details?: unknown): ApiRouteError {
    return new ApiRouteError(424, "FAILED_DEPENDENCY", message, { details });
}

export function badRequestError(message = "BAD_REQUEST", details?: unknown): ApiRouteError {
    return new ApiRouteError(400, "BAD_REQUEST", message, { details });
}

export function normalizeZodIssues(error: ZodError): Array<{ path: string; message: string; code: string }> {
    return error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
        code: issue.code,
    }));
}

export function fromZodError(error: ZodError): ApiRouteError {
    return invalidPayloadError(normalizeZodIssues(error));
}

export async function readValidatedJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
        throw fromZodError(parsed.error);
    }
    return parsed.data;
}

export function assertFound<T>(
    value: T | null | undefined,
    message = "NOT_FOUND",
    code = "NOT_FOUND",
): T {
    if (value == null) {
        throw notFoundError(message, code);
    }
    return value;
}

export function isAIUnavailableError(error: unknown): boolean {
    if (isApiRouteError(error)) {
        return error.status === 424 || error.code === "FAILED_DEPENDENCY" || error.message === "AI_ENGINE_UNAVAILABLE";
    }

    if (error && typeof error === "object") {
        const value = error as { code?: unknown; message?: unknown };
        if (typeof value.code === "string" && AI_DEPENDENCY_CODES.has(value.code)) {
            return true;
        }
        if (typeof value.message === "string") {
            const normalized = value.message.toLowerCase();
            return normalized.includes("openai")
                || normalized.includes("ai engine unavailable")
                || normalized.includes("content generation failed");
        }
    }

    if (error instanceof Error) {
        const normalized = error.message.toLowerCase();
        return normalized.includes("openai")
            || normalized.includes("ai engine unavailable")
            || normalized.includes("content generation failed");
    }

    return false;
}

export function assertAIEngineAvailable(): void {
    if (!process.env.OPENAI_API_KEY?.trim()) {
        throw failedDependencyError();
    }
}

export function toAIUnavailableError(error: unknown): ApiRouteError {
    if (isApiRouteError(error) && error.status === 424) {
        return error;
    }

    return failedDependencyError("AI_ENGINE_UNAVAILABLE", {
        cause: error instanceof Error ? error.message : String(error),
    });
}
