# Authentication

The InovaCortex public platform uses bearer authentication for the public API.

## Public API Keys

Send the key with:

```http
Authorization: Bearer <API_KEY>
```

Keys are tenant-scoped and stored hashed at rest. The raw key should be treated like a secret:

- store it in your secret manager
- never log it
- never expose it to browsers or client-side code

## Key Provisioning

The repository exposes key provisioning as a backend helper:

- `provisionPublicApiKey()` in `lib/public-api/v1-auth.ts`

In production, connect that helper to your tenant admin or ops workflow. The raw key is only available at creation time.

Example:

```ts
import { provisionPublicApiKey } from "@/lib/public-api/v1-auth";

const { rawKey, key } = await provisionPublicApiKey({
  organizationId: "org_123",
  name: "Zapier integration",
});

console.log(rawKey);
console.log(key.id);
```

## Operational Headers

The platform accepts and/or returns these headers when applicable:

- `Authorization`
- `X-Request-Id`
- `X-Correlation-Id`
- `Idempotency-Key`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Authentication Failure

Invalid or missing keys return a safe `401 unauthorized` response with the standard envelope.

Example:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_...",
    "timestamp": "2026-03-18T12:00:00.000Z",
    "version": "v1"
  },
  "error": {
    "code": "unauthorized",
    "message": "API key is required."
  }
}
```

