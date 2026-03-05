/**
 * sentry.server.config.ts
 * Sentry initialization for Node.js server-side (API routes, server components).
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.05,
        debug: false,
        release: process.env.NEXT_PUBLIC_APP_VERSION ?? "v11",
    });
}
