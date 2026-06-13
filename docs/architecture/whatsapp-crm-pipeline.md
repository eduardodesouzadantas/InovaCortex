# WhatsApp CRM Pipeline

## Before

Before this phase, the WhatsApp CRM flow was split across:

- `lib/whatsapp/inbound-handler.ts` for webhook parsing, org resolution, contact/conversation/message persistence, deal creation, assignment, and copilot dispatch
- `app/api/org/[slug]/whatsapp/send/route.ts` for outbound permissions, provider dispatch, persistence, and audit
- `app/api/org/[slug]/whatsapp/conversations/[id]/route.ts` for conversation mutations

That left the canonical CRM path implicit instead of encoded as a single contract.

## Canonical Contract

The canonical pipeline now centers on:

- Tenant context: `WhatsAppPipelineTenantContext`
- Actor context: `WhatsAppPipelineActor`
- Session channel: `WhatsAppConversationSnapshot`
- Message record: `WhatsAppMessageSnapshot`
- CRM linkage: `WhatsAppDealLink`
- Side-effect classification: `WhatsAppSideEffectPlan`

Primary code entrypoints:

- `lib/commercial/canonical-flow.ts`
- `lib/whatsapp/inbound-pipeline.ts`
- `lib/whatsapp/outbound-service.ts`
- `lib/whatsapp/conversation-service.ts`
- `lib/whatsapp/context-service.ts`
- `lib/whatsapp/crm-service.ts`

## CRM Rules

### Contact

- Resolved by `organizationId + phoneNumberE164`
- Upserted on inbound
- Touched on outbound
- Stores `lastInboundAt`, `lastOutboundAt`, `lastMessageAt`, and `sessionWindowUntil`

### Conversation

- Resolved by `organizationId + contactId`
- Reopened automatically on inbound
- Updated with preview, unread count, SLA, and assignment state
- Ownership is enforced through `assignedUserId` for `closer`

### Message

- Persisted as the channel source of truth
- Inbound idempotency uses provider `messageId`
- Outbound persists only after provider success

### Deal

- A canonical open deal is resolved per `organizationId + contactId`
- If an open deal exists, it is reused
- If none exists, the pipeline ensures a default CRM pipeline/stage and creates one deal
- The deal creation/reuse rule is shared with the broader commercial domain through `lib/commercial/canonical-flow.ts`

### Activity

- `deal_created_from_whatsapp` is recorded when the canonical deal is created
- `whatsapp_inbound_message` is recorded for new inbound messages linked to the canonical deal
- `whatsapp_outbound_message` is recorded for successful outbound messages linked to the canonical deal

## Sync vs Async Side Effects

### Synchronous

- Contact resolution/upsert
- Conversation resolution/upsert
- Message persistence
- Canonical deal resolution/creation
- Activity creation
- Outbound audit event

### Async Candidates

- System event emission
- Assignment routing
- Copilot dispatch
- Provider delivery/read status callbacks
- Analytics rollup
- Delivery alerts
- SLA recalculation

These async candidates remain explicit side effects but are now separated from the canonical persistence path so they can migrate cleanly to workers later.

## Message Lifecycle

The post-send lifecycle is canonicalized through provider status reconciliation:

- Provider webhook stays thin in `app/api/webhooks/meta/route.ts`
- Parsing and batching live in `lib/whatsapp/meta-webhook-service.ts`
- Status normalization, deduplication, ordering, and failure classification live in `lib/whatsapp/message-status-service.ts`

Canonical lifecycle statuses:

- `queued`
- `accepted`
- `sent`
- `delivered`
- `read`
- `failed`

Lifecycle rules:

- Duplicate events for the same status and older-or-equal timestamp are ignored
- Lower-priority events arriving after a higher-priority state are ignored as out-of-order
- `failed` is classified as `retryable`, `terminal`, or `unknown`
- Retry policy is explicit in reconciliation output: retryable failures become real async work with a 300s default delay
- Message status reconciliation is synchronous
- Analytics, alerts, and secondary recalculations remain async candidates

## Operational Post-Send Pipeline

The post-send path is now operational, not only declarative:

- `lib/whatsapp/message-status-service.ts` reconciles provider status and emits `retryDecision`
- `lib/whatsapp/retry-service.ts` turns `retryDecision` into a canonical queue item in `ActionQueue`
- `workers/system-scheduler.ts` dispatches `whatsapp_retry_dispatch`
- `lib/whatsapp/retry-worker.ts` executes due retry queue items with tenant-safe reprocessing

### Retry Job Contract

Canonical retry queue payload:

- `jobType = "whatsapp_retry_message"`
- `organizationId`
- `messageRecordId`
- `sourceExternalMessageId`
- `sourceStatus`
- `failureClass`
- `queuedAt`
- `delaySeconds`
- `reason`

Operational guarantees:

- one pending retry queue item per `WhatsAppMessage`
- idempotent scheduling via `organizationId + relatedEntityId + pending status`
- retry execution tracked by `ActionQueue.attempts`
- transient execution failures are requeued on the same queue item with `nextRetryAt`
- terminal failures or exhausted retries end in `rejected`

## Message Ledger

`WhatsAppMessage` is now the operational source of truth for lifecycle and retry state:

- current status remains in first-class columns (`status`, `sentAt`, `deliveredAt`, `readAt`, `failedAt`)
- operational ledger lives in `errorJson.statusLedger`
- ledger stores:
  - current external provider id
  - known historical provider ids
  - lifecycle event history
  - retry decision
  - retry queue/job execution history

This removes semantic dependence on legacy message logs for canonical WhatsApp CRM traffic.

## Legacy Compatibility

`MessageLog` is no longer part of the canonical WhatsApp lifecycle. It remains only as a temporary compatibility bridge through `lib/whatsapp/legacy-message-log-adapter.ts` for older assessment/lead flows still outside the canonical CRM pipeline.
