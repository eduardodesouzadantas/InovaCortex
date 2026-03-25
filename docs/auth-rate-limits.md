# Auth Rate Limits

## Store strategy

- Production uses a shared Postgres-backed store through Prisma so rate limits are consistent across workers and instances.
- Local development and test runs use in-memory storage by default.
- If the shared store fails at runtime, the limiter falls back to in-memory so auth flows keep working in a degraded but safe mode.
- The fallback path emits a structured warning with `operation=auth_rate_limit_store_fallback`, `fallbackMode=memory`, `sharedStore=prisma`, and a non-sensitive scope label.

## Thresholds

| Surface | Identifier bucket | IP bucket | Window | Rationale |
| --- | ---: | ---: | --- | --- |
| Login | 5 | 25 | 10 minutes | Protect password guessing and credential stuffing without blocking normal retry patterns. |
| Password reset request | 5 | 25 | 10 minutes | Limit repeated reset requests for the same user or source IP while keeping legitimate admin support flows usable. |
| Invite creation | 5 | 25 | 10 minutes | Prevent invite spam and repeated reissue loops while allowing normal onboarding activity. |

## Keying rules

- Login keys are isolated by endpoint so `/api/auth/login`, `/api/agency/auth/login`, and the legacy admin adapter do not share counters.
- Password reset and invite keys are isolated by organization to preserve tenant separation.
- Subject values and IP buckets are hashed before storage; logs keep only the minimal context needed for debugging.
- Client IP resolution prefers proxy-aware headers and falls back to `unknown-ip` only when no valid IP header is available.

## Cleanup

- The Postgres store runs a lightweight cleanup pass at most once every 15 minutes per process.
- Cleanup deletes rows whose `reset_at` has already elapsed, which keeps the table bounded without changing blocking behavior.
- The `reset_at` index is sufficient for the cleanup query and for point reads during upsert.

## Operational checklist

- Confirm the migration `20260324220000_auth_rate_limit_buckets` exists in the target database.
- Confirm the application is using `AUTH_RATE_LIMIT_STORE=database` or `AUTH_RATE_LIMIT_SHARED=true` in preview/staging.
- Validate a repeated login, reset request, and invite creation from the same IP against two workers.
- Watch for the fallback warning above; if it appears, global rate limiting is temporarily degraded to per-instance memory.
