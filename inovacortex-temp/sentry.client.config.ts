/**
 * sentry.client.config.ts
 * Sentry initialization for the browser.
 * Only activates when NEXT_PUBLIC_SENTRY_DSN is configured.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        debug: false,
        release: process.env.NEXT_PUBLIC_APP_VERSION ?? "v11",
        beforeSend(event) {
            // Never send PII
            if (event.request?.cookies) delete event.request.cookies;
            if (event.user?.email) event.user.email = "[redacted]";
            return event;
        },
    });
}
