# Errors And Troubleshooting

## Error Envelope

Public API errors use the standard envelope:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_...",
    "timestamp": "2026-03-18T12:00:00.000Z",
    "version": "v1"
  },
  "error": {
    "code": "invalid_request",
    "message": "Human-readable safe message",
    "details": {}
  }
}
```

## Standard Error Codes

- `unauthorized`
- `forbidden`
- `rate_limited`
- `invalid_request`
- `not_found`
- `conflict`
- `internal_error`

## Rate Limit Headers

When rate limiting applies, responses include:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on throttled responses

## Troubleshooting Public API Calls

### 401 Unauthorized

Check:

- `Authorization: Bearer <API_KEY>`
- the key is active
- the key belongs to the tenant you expect

### 409 Conflict On POST

This usually means:

- the same `Idempotency-Key` was reused with a different payload
- or a duplicate logical write was attempted intentionally

Reuse the same key only for the same body and tenant.

### 429 Rate Limited

Check the rate limit headers and retry after the reset window.

### Pagination Looks Wrong

Use one pagination style consistently:

- `limit` plus `cursor` preferred
- `page` accepted for compatibility

Do not mix cursor and page in the same client flow.

### Webhook Delivery Fails

Check:

- destination URL is reachable
- endpoint is active
- subscribed event includes the event type
- signature is verified with the correct secret
- the endpoint returned a transient or permanent failure

Delivery attempts are limited, so persistent failures should be investigated on the consumer side.

### Signature Verification Fails

Check:

- raw body is used exactly as received
- the timestamp header matches the payload that was signed
- the endpoint secret is current
- the consumer is using HMAC SHA-256 with `timestamp + "." + body`

## Support Workflow

Include these values when investigating an issue:

- `requestId`
- tenant slug
- API key prefix
- endpoint id for webhooks
- event id for webhook deliveries

Do not include raw secrets in support tickets or logs.

