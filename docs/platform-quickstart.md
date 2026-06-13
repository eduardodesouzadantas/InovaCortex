# Quickstart

This quickstart shows the smallest safe path from a tenant API key to a working integration.

## 1. Provision A Public API Key

Use your tenant admin flow or backend ops tool to provision the key.

If you are working directly in this repository, call:

```ts
import { provisionPublicApiKey } from "@/lib/public-api/v1-auth";
```

The raw key is shown once. Store it securely.

## 2. Read Contacts

```bash
curl -sS \
  -H "Authorization: Bearer $ICX_PUBLIC_API_KEY" \
  -H "X-Request-Id: req_quickstart_001" \
  "https://your-domain.com/api/public/v1/contacts?limit=20"
```

Example response:

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
    "requestId": "req_quickstart_001",
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

## 3. Create A Contact

Use `Idempotency-Key` to protect retries:

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $ICX_PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 2d9d1f1f-8f4f-4b2a-b8e4-5d0b7d8f9d2a" \
  "https://your-domain.com/api/public/v1/contacts" \
  -d '{
    "phoneNumberE164": "+15551234567",
    "name": "Aline Costa",
    "email": "aline@acme.com",
    "lifecycle": "lead",
    "tags": ["vip", "demo"]
  }'
```

If the network retries the same request with the same `Idempotency-Key` and the same body, the API returns the same logical result instead of creating duplicates.

## 4. Create A Webhook Endpoint

Create a tenant webhook endpoint in the admin screen:

- `/org/:slug/admin/webhooks`

Subscribe to:

- `contact.created`
- `deal.created`
- `deal.updated`
- `activity.created`
- `message.received`

The secret is shown only once.

## 5. Verify The Webhook Signature

Use the shared verification guide:

- [Webhook Signature Verification](./platform-webhook-signature.md)

## 6. Diagnose Problems

If something fails:

- check `requestId`
- check rate-limit headers
- check the standard error code
- check webhook delivery status and the last error summary

