## OPT-1 Unified Inbox - Feature Readiness & Implementation Status

**Last Updated:** March 18, 2026  
**Status:** READY FOR MERGE (with honest scope)  
**Stable:** ✅ YES | **Production-Ready:** ⚠️ PARTIAL

---

## Executive Summary

OPT-1 Unified Inbox introduces email channel integration into the Operator CRM Workspace, enabling a single view of customer conversations across WhatsApp and Email. The feature is **architecturally complete and database-ready**, and the connection layer now uses **real OAuth for Gmail** with a provider-ready path for Microsoft.

### Operational Update
- Google email sync now runs as an incremental scheduled pull for connected integrations.
- The callback still performs the first sync immediately after OAuth completion.
- Microsoft remains wired in the OAuth surface but is not enabled for scheduled sync in this phase.
- Production cron is wired through [`.github/workflows/email-sync-cron.yml`](.github/workflows/email-sync-cron.yml) on a 15-minute schedule.
- Required environment variables for cron:
  - `CRON_SECRET`
  - `NEXT_PUBLIC_BASE_URL`
- The admin email panel now exposes freshness metadata and a manual refresh action at `POST /api/org/[slug]/email/refresh`.
- The email panel also revalidates lightly on focus/visibility so recent syncs can show up without polling or realtime.
- Rollback: disable the workflow schedule or remove the workflow file, then keep the route available for manual/internal triggering.
- Local/staging validation: call `GET /api/cron/email-sync` manually with `Authorization: Bearer <CRON_SECRET>` against the target base URL.

---

## What's READY & FUNCTIONAL ✅

### 1. Database Layer
- **Email Models:** `EmailIntegration`, `EmailThread`, `EmailMessage` fully defined in schema
- **Migrations:** Applied successfully (see `20260318200709_opt1_unified_inbox`)
- **Schema Integrity:** All foreign keys, cascading deletes, and tenant isolation constraints in place
- **Indexes:** Optimized for query performance (status, SLA, assignment queries)
- **Tenant Isolation:** Complete (`organizationId` boundaries enforced across all models)

**Validation:**
```bash
npx prisma migrate status  # ✅ All 7 migrations applied
npx prisma generate        # ✅ Client generated
```

### 2. API Routes
- **POST `/api/org/[slug]/email/connect`**
  - Creates/updates `EmailIntegration` record
  - Currently: Real OAuth start + callback flow for Gmail, with encrypted token storage
  - UI shows: "Conectar Google Workspace" / "Conectar Outlook"
  - Behavior: Exchanges authorization code, stores encrypted tokens, sets status to "connected"

- **POST `/api/org/[slug]/email/disconnect`**
  - Sets `EmailIntegration.status` to "disconnected"
  - Does NOT delete data (preserves conversation history)
  - Safe for repeated on/off cycles

### 3. Admin Email Panel UI
- **Location:** `/app/org/[slug]/admin/email/page.tsx`
- **Component:** `EmailIntegrationsClient` (client-side state + API calls)
- **States:**
  - **Offline:** No integration → shows connect buttons for Google/Outlook
  - **Connected:** Integration exists → shows provider + email + disconnect button
- **UI/UX:** Properly styled, no console errors, responsive

### 4. Operator CRM Workspace Integration
- **Latest Conversation Resolution:**
  - Prioritizes chronologically between Email threads + WhatsApp conversations
  - Picks newer conversation channel (email if lastMessageAt > WhatsApp)
  - Fallback: WhatsApp only if email integration absent
- **Omnichannel Feed:**
  - Merges WhatsApp + Email messages chronologically (descending)
  - Maps both sources to unified message format (source, direction, text, timestamp)
  - Respects 12-message fetch limit per channel
- **Owner Assignment:**
  - `EmailThread.assignedUserId` correctly linked to `User`
  - Falls back to "Sem responsavel" if unassigned
- **Unread Tracking:**
  - Pulled from `EmailThread.unreadCount` (analogous to WhatsApp)
  - Factored into CRM priority/attention signals

**Code References:**
- [lib/operator/crm-workspace.ts](lib/operator/crm-workspace.ts#L2770-L2790) – latestConversation logic
- [lib/operator/crm-workspace.ts](lib/operator/crm-workspace.ts#L3140-L3210) – feed merging

### 5. Test Coverage
- **UI Tests:** EmailIntegrationsClient connect/disconnect flows
- **Integration Tests:** Database schema, relationships, cascade deletes
- **Omnichannel Logic Tests:**
  - Last conversation resolution (email vs WhatsApp)
  - Chronological feed ordering
  - Edge cases (no integration, null timestamps, empty messages)
- **Test Files:**
  - `__tests__/email-integration.test.tsx`
  - `__tests__/email-unified.test.ts`
  - `__tests__/opt1-unified-inbox-integration.test.ts` (new, comprehensive)

**Run Tests:**
```bash
npm test -- email  # Runs OPT-1 unified inbox tests
```

---

## What's MOCKED (Not Real Implementation) ⚠️

### 1. OAuth Flow
- **Current:** Gmail OAuth 2.0 is real and persists encrypted tokens at rest
- **Current:** Microsoft OAuth support is wired through the same provider contract and can be enabled with env config
- **Next Steps:** Email sync worker, refresh scheduling, and provider-specific hardening

### 2. Email Sync
- **Current:** Google incremental sync is live for connected integrations
- **Current Behavior:**
  - `connect` route starts real OAuth and callback persists encrypted credentials
  - Callback triggers an initial pull sync
  - Scheduled job fetches incremental email changes for connected Google tenants
  - `EmailThread` / `EmailMessage` records are auto-created idempotently
- **Deferred Next Steps:**
  - Microsoft sync enablement
  - Webhook handlers for real-time email push
  - More advanced cursor/delta sync hardening

### 3. Email → Contact Mapping
- **Current:** Sync extracts sender and recipient email addresses and matches them to existing `Contact` records by email
- **Current Behavior:** Threads and messages are linked to `Contact` and optionally to the latest active `Deal` when a match exists
- **Deferred Next Steps:**
  - Auto-create new contacts from unmatched inbound mail
  - Better alias and plus-address handling

### 4. Message Sync Real-Time Updates
- **Current:** Manual page refresh required
- **Real Implementation Pending:** WebSocket or polling to reflect new email in unified view

---

## Tenant Isolation & Security ✅

All queries enforced with `organizationId` boundary:

```sql
-- EmailThread queries always include:
WHERE organizationId = $1

-- EmailMessage queries respect Contact → Organization chain:
WHERE organizationId = $1 AND contactId IN (
  SELECT id FROM contacts WHERE organizationId = $1
)
```

**Validated:** No cross-organization data leakage possible in current schema.

---

## API Route Specifications

### Connect Email Route
**Endpoint:** `POST /api/org/[slug]/email/connect`

**Request:**
```json
{
  "provider": "google",  // "google" | "microsoft"
  "email": "admin@company.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "integration": {
    "id": "int-uuid",
    "organizationId": "org-uuid",
    "provider": "google",
    "status": "connected",
    "ownerEmail": "admin@company.com",
    "accessTokenEncrypted": "<encrypted blob>",
    "lastSyncAt": "2026-03-18T10:00:00Z"
  }
}
```

**Current Limitations:**
- Tokens are encrypted and stored from the real provider callback
- NO email sync triggered
- NO real Gmail API calls made

### Disconnect Email Route
**Endpoint:** `POST /api/org/[slug]/email/disconnect`

**Response (Success):**
```json
{
  "success": true,
  "integration": {
    "status": "disconnected",
    "organizationId": "org-uuid"
  }
}
```

**Behavior:**
- Sets integration status to "disconnected"
- Does NOT delete historical threads/messages
- Can reconnect later without data loss

---

## Database Queries Reference

### Fetch Integration Status
```typescript
const integration = await prisma.emailIntegration.findUnique({
  where: { organizationId: "org-1" }
});
// Returns: { status, provider, ownerEmail, lastSyncAt, lastError? }
```

### Fetch Email Threads for Contact
```typescript
const threads = await prisma.emailThread.findMany({
  where: {
    organizationId: "org-1",
    contactId: "contact-1"
  },
  orderBy: { lastMessageAt: "desc" },
  take: 10
});
// Returns: Thread records with unreadCount, SLA, assignment info
```

### Fetch Latest Conversation (Email or WhatsApp)
```typescript
// In buildOperatorCrmRecordDetail():
const latestEmail = assessment.contact?.emailThreads?.[0] ?? null;
const latestWhatsApp = assessment.contact?.conversations?.[0] ?? null;

// Pick newer channel by lastMessageAt timestamp
if (latestEmail && latestWhatsApp) {
  const emailTime = latestEmail.lastMessageAt?.getTime() ?? 0;
  const waTime = latestWhatsApp.lastMessageAt?.getTime() ?? 0;
  latestConversation = emailTime > waTime ? latestEmail : latestWhatsApp;
}
```

---

## Known Limitations & Tech Debt

| Issue | Severity | Resolution |
|-------|----------|-----------|
| OAuth connection surface | Low | Gmail OAuth is live; finalize Microsoft rollout and refresh automation |
| No email sync from inbox | High | Add background sync worker |
| No real-time updates | Medium | Add WebSocket or polling layer |
| Manual contact mapping | Low | Implement automatic email→Contact resolution |
| No email attachments support | Low | Design attachment storage strategy (S3?) |
| SLA calculation not email-aware | Low | Update SLA logic to consider email channels |

---

## Migration Checklist

Before merging/releasing, verify:

- [x] Prisma schema includes Email models
- [x] Migration applied successfully (`prisma migrate status`)
- [x] Database schema validated (relationships, constraints)
- [x] API routes responding without errors
- [x] Admin UI rendering correctly
- [x] Operator CRM workspace shows unified feed
- [x] Tests passing (`npm test -- email`)
- [x] TypeScript compilation clean (`npx tsc --noEmit`)
- [x] Next.js build succeeds (`npm run build --silent`)
- [x] Tenant isolation verified (no cross-org data leaks)
- [x] Documentation updated (this file)

---

## Release Notes Template

Insert into PR description:

> **OPT-1 Unified Inbox - Data Model & Real OAuth**
>
> **What's New:**
> - Email channel now integrated into Operator CRM Workspace
> - Single view of WhatsApp + Email conversations (chronological feed)
> - Admin panel to connect/disconnect email provider
> - Database schema supports EmailIntegration, EmailThread, EmailMessage
>
> **What's Working:**
> - ✅ Data models & schema migration
> - ✅ API routes (connect/disconnect with real OAuth)
> - ✅ Admin UI for email integration panel
> - ✅ Omnichannel feed in CRM Record view
> - ✅ Tenant isolation verified
>
> **What's NOT Yet:**
> - ✅ Real OAuth (Gmail implemented, Microsoft path ready)
> - ⚠️ Email sync from inbox – no background worker yet
> - ⚠️ Real-time updates – manual refresh needed
> - ⚠️ Contact auto-mapping – manual entry for now
>
> **Next Steps:**
> - [Sprint N] Add token refresh automation and background email sync
> - [Sprint N+1] Add email sync background worker
> - [Sprint N+2] Real-time WebSocket updates
>
> **Testing:**
> - DB schema validated ✅
> - API routes functional ✅
> - UI tests passing ✅
> - Omnichannel logic tested ✅

---

## Questions & Troubleshooting

### Q: What is already real now?
**A:** Gmail OAuth is real, tokens are encrypted at rest, disconnect clears local credentials, and the UI reflects the true connection state. Microsoft is wired through the same provider contract for the next enablement step.

### Q: Will historical conversations be lost if I disconnect?
**A:** No. Disconnect only changes `status` to "disconnected". All `EmailThread` and `EmailMessage` records persist. Reconnect will still see history (but won't sync new emails until real sync is implemented).

### Q: Can I manually test email threads?
**A:** Yes! Use Prisma Studio:
```bash
npx prisma studio
# Navigate to email_threads table
# Manually create a test thread with contactId + organizationId
# It will appear in the Operator CRM unified feed
```

### Q: What if tenant isolation is broken?
**A:** All Email queries enforce `organizationId` boundary. If there's a data leak, it would be in Contact→Email relationship, not Email model itself. Verify Contact queries also check `organizationId` (they do).

---

**Created:** 2026-03-18  
**Feature Branch:** `feature/opt-1-unified-inbox`  
**Related Issues:** OPT-1, OPT-1-EMAIL-SYNC, OPT-1-OAUTH
