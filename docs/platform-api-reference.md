# Public API Reference

Base URL:

```text
/api/public/v1
```

## Response Contract

Successful responses use:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_...",
    "timestamp": "2026-03-18T12:00:00.000Z",
    "version": "v1"
  },
  "error": null
}
```

When the endpoint is listable, `meta.pagination` is included:

```json
{
  "limit": 20,
  "total": 42,
  "returnedCount": 20,
  "hasNextPage": true,
  "nextCursor": "eyJvZmZzZXQiOjIwfQ"
}
```

## Pagination

List endpoints accept:

- `limit`
- `cursor`
- `page` for compatibility

`cursor` is preferred. It is an opaque base64url token that carries the next offset.

Supported list endpoints:

- `GET /contacts`
- `GET /deals`
- `GET /activities`
- `GET /conversations`

## Idempotency

Write endpoints accept `Idempotency-Key`:

- `POST /contacts`
- `POST /deals`
- `POST /activities`

Reuse the same key for safe retries of the same request body inside the same tenant.

If the same key is reused with a different body, the API returns a conflict.

## Resources

### Contacts

- `GET /contacts`
- `POST /contacts`

Create body:

```json
{
  "phoneNumberE164": "+15551234567",
  "name": "Aline Costa",
  "email": "aline@acme.com",
  "lifecycle": "lead",
  "tags": ["vip", "demo"]
}
```

### Deals

- `GET /deals`
- `POST /deals`

Create body:

```json
{
  "contactId": "con_123",
  "stageId": "stage_456",
  "value": 12500,
  "status": "open"
}
```

### Activities

- `GET /activities`
- `POST /activities`

Create body:

```json
{
  "dealId": "deal_123",
  "type": "follow_up_call",
  "note": "Spoke with the contact and scheduled the next step."
}
```

### Conversations

- `GET /conversations`

Read-only in v1.

The response includes:

- `items`
- `summary.total`
- `summary.whatsapp`
- `summary.email`

### Executive Pulse

- `GET /executive/pulse`

Read-only in v1.

The response includes:

- org context
- generation time
- summary narrative
- prioritized alerts
- operating warnings

## Example Success Envelope

```json
{
  "data": [
    {
      "id": "con_123",
      "name": "Aline Costa",
      "email": "aline@acme.com",
      "phoneNumberE164": "+15551234567",
      "lifecycle": "lead",
      "tags": ["vip", "demo"],
      "lastMessageAt": null,
      "createdAt": "2026-03-18T12:00:00.000Z",
      "updatedAt": "2026-03-18T12:00:00.000Z"
    }
  ],
  "meta": {
    "requestId": "req_contacts_001",
    "timestamp": "2026-03-18T12:00:00.000Z",
    "version": "v1",
    "pagination": {
      "limit": 20,
      "total": 1,
      "returnedCount": 1,
      "hasNextPage": false,
      "nextCursor": null
    }
  },
  "error": null
}
```

## Example Error Envelope

```json
{
  "data": null,
  "meta": {
    "requestId": "req_contacts_002",
    "timestamp": "2026-03-18T12:00:00.000Z",
    "version": "v1"
  },
  "error": {
    "code": "invalid_request",
    "message": "phoneNumberE164 is required."
  }
}
```

