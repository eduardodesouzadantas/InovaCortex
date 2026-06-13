# Webhook Signature Verification

Webhook payloads are signed with HMAC SHA-256.

## Signature Format

The signature header is:

```text
X-InovaCortex-Signature: v1=<hex_signature>
```

The signature is computed from:

```text
timestamp + "." + raw_body
```

Using the endpoint secret as the HMAC key.

## Headers

The consumer should read:

- `X-InovaCortex-Event`
- `X-InovaCortex-Event-Id`
- `X-InovaCortex-Timestamp`
- `X-InovaCortex-Signature`

## Verification Example

```ts
import crypto from "crypto";

function signWebhookPayload(secret: string, timestamp: string, payload: string): string {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  return `v1=${digest}`;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWebhookSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signatureHeader: string | null;
}): boolean {
  if (!input.signatureHeader) return false;

  const [version, signature] = input.signatureHeader.split("=", 2);
  if (version !== "v1" || !signature) return false;

  const expected = signWebhookPayload(input.secret, input.timestamp, input.rawBody).slice(3);
  return timingSafeEqual(signature, expected);
}
```

## Replay Protection

The platform signs the timestamp together with the body, but consumers should still reject stale timestamps on their side.

A practical approach is to accept only a short freshness window, such as 5 minutes, using the event timestamp.

## Failure Handling

If signature verification fails:

- return `401` or `400`
- do not process the event
- log the event id and request id only
- never log the secret or full raw payload

