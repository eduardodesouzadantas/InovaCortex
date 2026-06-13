export type RouteMetric = {
    route: string;
    method: string;
    requestCount: number;
    errorCount: number;
    totalResponseMs: number;
    maxResponseMs: number;
    lastStatus: number | null;
    lastObservedAt: string;
};

export type RouteMetricSnapshot = {
    route: string;
    method: string;
    requestCount: number;
    errorCount: number;
    averageResponseMs: number;
    maxResponseMs: number;
    lastStatus: number | null;
    lastObservedAt: string;
};

export type MetricsSnapshot = {
    summary: {
        totalRequests: number;
        totalErrors: number;
        averageResponseMs: number;
    };
    routes: RouteMetricSnapshot[];
};

const routeMetrics = new Map<string, RouteMetric>();

function routeKey(route: string, method: string): string {
    return `${method.toUpperCase()} ${route}`;
}

function ensureRouteMetric(route: string, method: string): RouteMetric {
    const key = routeKey(route, method);
    const existing = routeMetrics.get(key);
    if (existing) {
        return existing;
    }

    const created: RouteMetric = {
        route,
        method: method.toUpperCase(),
        requestCount: 0,
        errorCount: 0,
        totalResponseMs: 0,
        maxResponseMs: 0,
        lastStatus: null,
        lastObservedAt: new Date().toISOString(),
    };
    routeMetrics.set(key, created);
    return created;
}

export function recordRequestMetric(input: {
    route: string;
    method: string;
    status: number;
    durationMs: number;
}): void {
    const metric = ensureRouteMetric(input.route, input.method);
    metric.requestCount += 1;
    metric.totalResponseMs += Math.max(0, Math.round(input.durationMs));
    metric.maxResponseMs = Math.max(metric.maxResponseMs, Math.max(0, Math.round(input.durationMs)));
    metric.lastStatus = input.status;
    metric.lastObservedAt = new Date().toISOString();
    if (input.status >= 400) {
        metric.errorCount += 1;
    }
}

export function getObservabilityMetricsSnapshot(limit = 25): MetricsSnapshot {
    const routes = [...routeMetrics.values()]
        .map<RouteMetricSnapshot>((metric) => ({
            route: metric.route,
            method: metric.method,
            requestCount: metric.requestCount,
            errorCount: metric.errorCount,
            averageResponseMs: metric.requestCount > 0 ? metric.totalResponseMs / metric.requestCount : 0,
            maxResponseMs: metric.maxResponseMs,
            lastStatus: metric.lastStatus,
            lastObservedAt: metric.lastObservedAt,
        }))
        .sort((left, right) => {
            if (right.requestCount !== left.requestCount) {
                return right.requestCount - left.requestCount;
            }
            if (right.errorCount !== left.errorCount) {
                return right.errorCount - left.errorCount;
            }
            return `${left.method} ${left.route}`.localeCompare(`${right.method} ${right.route}`);
        })
        .slice(0, limit);

    const summary = routes.reduce((accumulator, route) => {
        accumulator.totalRequests += route.requestCount;
        accumulator.totalErrors += route.errorCount;
        accumulator.totalResponseMs += route.averageResponseMs * route.requestCount;
        return accumulator;
    }, {
        totalRequests: 0,
        totalErrors: 0,
        totalResponseMs: 0,
    });

    return {
        summary: {
            totalRequests: summary.totalRequests,
            totalErrors: summary.totalErrors,
            averageResponseMs: summary.totalRequests > 0 ? summary.totalResponseMs / summary.totalRequests : 0,
        },
        routes,
    };
}

export function resetObservabilityMetrics(): void {
    routeMetrics.clear();
}
