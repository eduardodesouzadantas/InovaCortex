# Webhooks

Webhooks let external systems react to InovaCortex events without polling.

## Management Surface

Tenant admins manage endpoints in:

- `/org/:slug/admin/webhooks`

The backend management routes are tenant-scoped:

- `GET /api/org/:slug/webhooks`
- `POST /api/org/:slug/webhooks`
- `PATCH /api/org/:slug/webhooks/:id`
- `DELETE /api/org/:slug/webhooks/:id`

## Supported Events

v1 supports these event types:

- `contact.created`
- `deal.created`
- `deal.updated`
- `activity.created`
- `message.received`

## Delivery Model

- HTTP POST to the registered URL
- HMAC SHA-256 signature
- event timestamp header
- bounded retry
- delivery state persisted per endpoint

Retries are intentionally small and predictable:

- up to 2 delivery attempts
- transient failures are retried
- one endpoint failure does not affect other endpoints

## Endpoint Fields

Each endpoint stores:

- URL
- active/inactive state
- subscribed events
- last delivery timestamp
- last delivery status
- last delivery error summary
- delivery attempt count

## Create Or Update A Webhook

Create body:

```json
{
  "url": "https://hooks.example.com/inovacortex",
  "subscribedEvents": ["contact.created", "deal.updated"],
  "isActive": true
}
```

When a webhook is created or rotated, the secret is returned once.

## Webhook Event Envelope

Delivered payload example:

```json
{
  "id": "evt_123",
  "type": "deal.updated",
  "createdAt": "2026-03-18T12:00:00.000Z",
  "organizationId": "org_123",
  "data": {
    "dealId": "deal_456",
    "status": "open",
    "value": 12500
  }
}
```

The `data` object is event-specific and contains the canonical resource snapshot relevant to the event.

## Delivery Headers

InovaCortex sends:

- `X-InovaCortex-Event`
- `X-InovaCortex-Event-Id`
- `X-InovaCortex-Timestamp`
- `X-InovaCortex-Signature`

See the signature guide for verification details:

- [Webhook Signature Verification](./platform-webhook-signature.md)

## Operational Notes

- Webhook secrets are never shown again after creation or rotation.
- Delivery attempts and failure summaries are stored on the endpoint.
- Insecure destination URLs are rejected in production.

