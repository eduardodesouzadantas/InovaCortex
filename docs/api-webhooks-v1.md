# InovaCortex Webhooks v1

This page is the compact reference for tenant webhook management and delivery.

For the premium integration docs, start here:

- [Platform Overview](./platform-overview.md)
- [Platform Quickstart](./platform-quickstart.md)
- [Webhooks](./platform-webhooks.md)
- [Webhook Signature Verification](./platform-webhook-signature.md)
- [Errors and Troubleshooting](./platform-errors.md)

Tenant admins can manage webhook endpoints in the operational screen at:

- `/org/:slug/admin/webhooks`

The backend supports:

- endpoint CRUD
- active/inactive toggle
- subscribed event selection
- secret rotation
- HMAC-signed deliveries
- bounded retry

Supported events:

- `contact.created`
- `deal.created`
- `deal.updated`
- `activity.created`
- `message.received`

Delivery and signature behavior is documented in the premium pages above.
