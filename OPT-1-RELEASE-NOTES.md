# OPT-1 Unified Inbox - Release Notes

**Version:** 1.0.0-beta  
**Release Date:** March 18, 2026  
**Status:** Ready for Merge & Deploy  

---

## What's Being Released

### Feature: Email Channel Integration into Operator CRM

Unified Inbox brings email as a first-class channel alongside WhatsApp in the Operator Workspace, enabling teams to manage all customer conversations from a single inbox without creating parallel workflows.

> Operational update: Google email ingestion now uses a scheduled incremental pull so connected inboxes keep hydrating after OAuth, while Microsoft remains deferred for this phase.

### Cron Setup
- Production cron is scheduled via [`.github/workflows/email-sync-cron.yml`](.github/workflows/email-sync-cron.yml).
- Frequency: every 15 minutes.
- Required secrets:
  - `CRON_SECRET`
  - `NEXT_PUBLIC_BASE_URL`
- The workflow calls `GET /api/cron/email-sync` with `Authorization: Bearer <CRON_SECRET>`.
- Rollback: disable the workflow or remove the schedule entry; no schema rollback is needed.

---

## What's New in This Release

### Data Model
- ✅ Three new Prisma models: `EmailIntegration`, `EmailThread`, `EmailMessage`
- ✅ Full schema migration applied and validated
- ✅ All foreign key relationships established with cascading deletes
- ✅ Tenant isolation enforced across all email tables

### Admin Panel
- ✅ New page: `/org/[slug]/admin/email`
- ✅ Shows integration status (connected/offline)
- ✅ Buttons to connect Google Workspace or Outlook (OAuth start flow)
- ✅ Disconnect option preserves conversation history

### Operator CRM Workspace
- ✅ Email threads appear alongside WhatsApp conversations
- ✅ Unified feed merges messages chronologically across channels
- ✅ Latest conversation logic picks the newer channel (email vs WhatsApp)
- ✅ Owner assignment works for both email and WhatsApp threads
- ✅ Unread count from email threads feeds into priority/attention signals

### API Endpoints
- ✅ **POST** `/api/org/[slug]/email/connect` – Start OAuth and persist the provider callback
- ✅ **POST** `/api/org/[slug]/email/disconnect` – Pause integration, keep history

### Testing & Validation
- ✅ UI component tests for connect/disconnect flows
- ✅ Integration tests for database schema and relationships
- ✅ Omnichannel logic tests (feed ordering, latestConversation)
- ✅ Tenant isolation verification
- ✅ Edge case handling (null timestamps, empty feeds, fallback)

---

## What's NOT in This Release (Honest Scope)

### OAuth Integration
- ✅ **Real Gmail OAuth** – Authorization code flow with encrypted token storage
- ✅ **Real Outlook/M365 OAuth** – Provider path wired and ready when env config is present
- ⏳ **Token Refresh** – Background refresh worker not added yet
- ⏳ **When?** Follow-up sprint after internal review

### Email Sync
- ✅ **Email Fetch** – Google connected inboxes are pulled by an internal scheduled sync
- ✅ **New Message Detection** – New messages are hydrated into `EmailThread` / `EmailMessage`
- ⏳ **Push Notifications** – No webhook handling for real-time updates
- ⏳ **When?** Microsoft enablement and realtime remain deferred

### Email-Specific Features
- ❌ **Attachments** – Not synced or displayed
- ❌ **CC/BCC Recipients** – Not tracked
- ❌ **Email Signatures** – Not preserved in display
- ❌ **Rich Formatting** – HTML stored but not styled in UI
- ⏳ **When?** Post-launch enhancement phase

### Contact Management
- ✅ **Contact Matching** – Email addresses are matched to existing Contacts by address
- ✅ **Email Deduplication** – External message IDs prevent duplicate inserts
- ⏳ **When?** Auto-contact creation and alias expansion are future enhancements

### Workflow & SLA
- ❌ **Email-Aware SLA** – SLA due dates not tailored for email channel
- ❌ **Auto-Assignment** – No logic to assign email threads to users
- ⏳ **When?** Q2 roadmap

---

## How to Use

### For End Users

1. **Enable Email Integration:**
   - Go to Organization → Admin → Unified Inbox (BETA)
   - Click "Conectar Google Workspace" or "Conectar Outlook"
   - *Note: Gmail OAuth is now real; Outlook path is wired for the next enablement step*

2. **View Unified Conversations:**
   - Open any lead/contact in Operator Workspace
   - See all WhatsApp + Email messages in one chronological feed
   - Latest conversation (email or WhatsApp) shown as primary

3. **Pause Email:**
   - Click "Desconectar Inbox" to disconnect
   - All history preserved; can reconnect anytime

### For Developers

**Access the API:**
```bash
# Create/update integration (real OAuth start)
POST /api/org/my-org/email/connect
Content-Type: application/json
{
  "provider": "google",
  "email": "admin@company.com"
}

# Response: 200 OK
{
  "success": true,
  "integration": {
    "id": "...",
    "status": "connected",
    "provider": "google",
    "ownerEmail": "admin@company.com"
  }
}

# Disconnect (keeps history)
POST /api/org/my-org/email/disconnect
# Response: 200 OK
{
  "success": true,
  "integration": { "status": "disconnected" }
}
```

**Query Email Data:**
```typescript
import { prisma } from '@/lib/prisma';

// Get integration status
const integration = await prisma.emailIntegration.findUnique({
  where: { organizationId: "org-id" }
});

// List email threads for a contact
const threads = await prisma.emailThread.findMany({
  where: {
    organizationId: "org-id",
    contactId: "contact-id"
  },
  orderBy: { lastMessageAt: "desc" }
});

// Fetch messages in a thread
const messages = await prisma.emailMessage.findMany({
  where: {
    organizationId: "org-id",
    threadId: "thread-id"
  },
  orderBy: { createdAt: "desc" }
});
```

---

## Technical Details

### Database Schema
```sql
-- Integration info (one per organization)
CREATE TABLE email_integrations (
  id TEXT PRIMARY KEY,
  organizationId TEXT UNIQUE NOT NULL,
  provider TEXT DEFAULT 'google',
  status TEXT DEFAULT 'disconnected',
  ownerEmail TEXT NOT NULL,
  accessTokenEncrypted TEXT NOT NULL,
  refreshTokenEncrypted TEXT NOT NULL,
  expiryAt TIMESTAMP,
  lastSyncAt TIMESTAMP,
  lastError TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Per-contact email threads
CREATE TABLE email_threads (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  assignedUserId TEXT,
  externalThreadId TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'open',
  slaDueAt TIMESTAMP,
  lastMessageAt TIMESTAMP,
  lastMessagePreview TEXT,
  unreadCount INT DEFAULT 0,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  UNIQUE (organizationId, externalThreadId),
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (assignedUserId) REFERENCES users(id) ON DELETE SET NULL
);

-- Email messages in threads
CREATE TABLE email_messages (
  id TEXT PRIMARY KEY,
  organizationId TEXT NOT NULL,
  threadId TEXT NOT NULL,
  contactId TEXT NOT NULL,
  externalMessageId TEXT UNIQUE NOT NULL,
  direction TEXT NOT NULL,
  fromAddress TEXT NOT NULL,
  toAddress TEXT NOT NULL,
  subject TEXT,
  bodyText TEXT,
  bodyHtml TEXT,
  status TEXT DEFAULT 'sent',
  sentAt TIMESTAMP,
  receivedAt TIMESTAMP,
  createdAt TIMESTAMP,
  FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (threadId) REFERENCES email_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (contactId) REFERENCES contacts(id) ON DELETE CASCADE
);
```

**Indexes:**
- `email_integrations(organizationId)` – Unique
- `email_threads(organizationId, status, slaDueAt)` – SLA queries
- `email_threads(organizationId, assignedUserId)` – Assignment queries
- `email_threads(organizationId, externalThreadId)` – Idempotent sync
- `email_messages(threadId, createdAt)` – Message ordering
- `email_messages(organizationId, contactId)` – Contact feed

### API Behavior (Current)

All endpoints require organization authentication and respect tenant boundaries via `organizationId`.

**Connect Route:**
- Takes `provider` (google/microsoft) and `email` address
- Creates or updates `EmailIntegration` record
- Sets status to "connected"
- **Currently:** Stores encrypted OAuth tokens from the provider callback
- **Does NOT:** Call Gmail/Microsoft inbox sync or create threads

**Disconnect Route:**
- Sets `EmailIntegration.status` to "disconnected"
- Preserves all existing `EmailThread` and `EmailMessage` records
- Safe to call repeatedly

### Feed Merging Logic

When loading a CRM record detail:

1. Fetch latest WhatsApp conversation and Email thread
2. Pick primary conversation:
   - If only one exists → use it
   - If both exist → use the one with newer `lastMessageAt`
3. Fetch messages from both channels (12 each)
4. Merge into single array sorted by `createdAt` (descending)
5. Display with channel badge ("WhatsApp" / "Email")

---

## Testing

### Run Tests
```bash
# All OPT-1 tests
npm test -- email

# Specific test file
npm test -- email-integration.test.tsx
npm test -- email-unified.test.ts
npm test -- opt1-unified-inbox-integration.test.ts

# With coverage
npm test -- --coverage email
```

### Test Coverage
- ✅ UI connect/disconnect flows
- ✅ Database schema integrity
- ✅ Tenant isolation
- ✅ Cascade deletes
- ✅ Feed chronological ordering
- ✅ Latest conversation resolution
- ✅ Edge cases (null, empty, no integration)

### Manual Testing Checklist
- [ ] Navigate to `/org/[slug]/admin/email`
- [ ] Click "Conectar Google Workspace" → verify Google OAuth redirect works
- [ ] See integration status changes to "Inbox Integrada"
- [ ] Open a contact in Operator CRM → see unified feed (currently WhatsApp only since no real sync)
- [ ] Manually create test thread in `prisma studio` → appears in CRM
- [ ] Click disconnect → integration status returns to "Inbox Offline"
- [ ] Reconnect → history preserved

---

## Rollback Plan

If issues arise:

1. **Quick Rollback:** 
   - Revert this commit
   - Run `npx prisma migrate resolve --rolled-back [migration-name]`
   - Deploy previous version

2. **Keep Data:**
   - Email data will remain in database after revert
   - Can re-enable feature later without data loss

3. **Hotfix:**
   - Email models can stay in schema indefinitely
   - If API route breaks, disable it via flag without DB changes

---

## Known Issues

| Issue | Impact | Status |
|-------|--------|--------|
| Sync is not in scope yet | Email inbox is not ingested historically | Planned next sprint |
| No email sync | Unified inbox empty for email channel | Will Fix (next sprint) |
| Manual refresh needed | Changes not real-time | Will Fix (post-sync) |
| No contact auto-mapping | Must pick contact manually (if needed) | Will Fix (with real sync) |

---

## Performance Considerations

- **Query Performance:**
  - `EmailThread.findMany` with index on `(organizationId, status)` → ms-scale
  - `EmailMessage.findMany` with index on `(threadId, createdAt)` → ms-scale
  - Feed merging (merge two 12-item arrays) → negligible

- **Data Volume:**
  - Per organization: assume 1 integration record
  - Per contact: assume 1-5 email threads (compared with 1 WhatsApp conversation)
  - Per thread: assume 5-50 messages
  - Total DB footprint: << WhatsApp messages table

- **Storage:**
  - Email body HTML stored as-is (not compressed)
  - Tokens encrypted (overhead ~2x size)
  - Recommend periodic message archive/purge for multi-year deployments

---

## Support & Next Steps

### For This Release
- Use at organization level (not customer-facing yet)
- Verify database stability in staging
- Collect feedback on UI/UX

### Immediate Next Steps (Next Sprint)
1. Add token refresh logic
2. Build email sync background worker (incremental, graceful retry)
3. Test in staging with real Gmail accounts
4. Validate Microsoft 365 rollout path
5. Update docs with sync setup

### Medium-Term Roadmap (Q2)
- Microsoft 365 OAuth support
- Real-time WebSocket updates
- Email attachment handling
- SLA automation for email
- Contact auto-mapping & deduplication

---

## Questions?

- **Technical Questions:** See [OPT-1-UNIFIED-INBOX-STATUS.md](OPT-1-UNIFIED-INBOX-STATUS.md)
- **Feature Questions:** Assignee: [Feature Owner]
- **Deployment Questions:** Assignee: [DevOps/Release Lead]

---

**Created:** 2026-03-18  
**Last Modified:** 2026-03-18  
**Approved By:** [Product/Engineering Lead]
