# InovaCortex Platform Docs

This is the landing page for the InovaCortex platform docs.

It covers the public API and tenant webhooks in a single, consistent integration story:

- Public API v1
- Public API v1.1 hardening
- Webhooks v1

## What The Platform Exposes

- Tenant-scoped CRM resources
- Unified conversations
- Executive Pulse
- Signed webhook delivery

## Core Rules

- Versioned routes
- Tenant isolation on every request
- Consistent JSON envelopes
- Safe errors and request tracing
- Idempotent writes where supported
- Lightweight webhook retries

## Docs Map

- [Platform Quickstart](./platform-quickstart.md)
- [Authentication](./platform-authentication.md)
- [API Reference](./platform-api-reference.md)
- [Webhooks](./platform-webhooks.md)
- [Webhook Signature Verification](./platform-webhook-signature.md)
- [Errors and Troubleshooting](./platform-errors.md)

## Reference Pages

The compact reference pages remain available for quick lookup:

- [Public API v1 reference](./api-public-v1.md)
- [Webhooks v1 reference](./api-webhooks-v1.md)

## Operational Notes

- Public API keys are stored hashed at rest.
- Webhook secrets are shown only at creation or rotation time.
- Public API responses include `requestId`, `timestamp`, `version`, and pagination metadata when applicable.
- Webhook payloads are signed with HMAC SHA-256.

