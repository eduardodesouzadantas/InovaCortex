# Launch Candidate Checklist

Use this checklist for a staging dress rehearsal before launch.

## 1. Environment

- [ ] `DATABASE_URL` configured
- [ ] `DIRECT_URL` configured
- [ ] `APP_ENCRYPTION_KEY` configured
- [ ] `NEXT_PUBLIC_BASE_URL` configured
- [ ] `CRON_SECRET` configured
- [ ] `GOOGLE_CLIENT_ID` configured
- [ ] `GOOGLE_CLIENT_SECRET` configured
- [ ] `STRIPE_SECRET_KEY` configured if billing flows are enabled

## 2. Tenant Pilot

- [ ] Tenant provisioned
- [ ] Onboarding started
- [ ] Email integration connected
- [ ] Pipeline configured
- [ ] At least one `Contact` exists
- [ ] At least one `Deal` exists
- [ ] Inbox has WhatsApp or email signals
- [ ] CEO Pulse has at least one actionable signal

## 3. Critical Flows

- [ ] Onboarding readiness reflects current tenant state
- [ ] Go-live blocks `suspended` accounts
- [ ] Go-live blocks tenants that are not ready
- [ ] CRM flow creates and links `Contact` / `Deal`
- [ ] Inbox sync and refresh remain consistent
- [ ] CEO Pulse action loop persists state
- [ ] Public API authenticates and paginates
- [ ] Webhooks emit, sign, and retry correctly
- [ ] Mobile surface loads and performs at least one action

## 4. Observability

- [ ] `requestId` present in responses and logs
- [ ] Structured logs include tenant context
- [ ] `/api/health` returns a stable status
- [ ] Metrics update during requests
- [ ] Failures are diagnosable without sensitive leakage

## 5. Decision

- [ ] Launch candidate: pass
- [ ] Launch candidate: warning acceptable
- [ ] Launch candidate: blocker present

