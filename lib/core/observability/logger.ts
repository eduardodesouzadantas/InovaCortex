import { logger } from "@/lib/observability/logger";

export {
    logger,
    log,
    type LogContext,
    type LogLevel,
} from "@/lib/observability/logger";
export {
    createRequestId,
    getRequestContext,
    resolveRequestIdFromHeaders,
    runWithRequestContext,
    setRequestContext,
} from "@/lib/observability/request-context";

export type ObservabilityContext = {
    requestId?: string | null;
    organizationId?: string | null;
    organizationSlug?: string | null;
    userId?: string | null;
    route?: string;
    module?: string;
    event?: string;
    timestamp?: string;
    [key: string]: unknown;
};

export function logInfo(event: string, context: ObservabilityContext = {}): void {
    logger.info(event, context);
}

export function logWarn(event: string, context: ObservabilityContext = {}): void {
    logger.warn(event, context);
}

export function logError(event: string, context: ObservabilityContext = {}): void {
    logger.error(event, context);
}

export function logMetric(metricName: string, value: number, context: ObservabilityContext = {}): void {
    logger.info("metric_observed", {
        ...context,
        metric: metricName,
        value,
    });
}

