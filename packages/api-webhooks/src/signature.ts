/**
 * Webhook Signature
 *
 * HMAC-SHA256 signature generation and verification for webhook payloads.
 * The signature is sent in the X-Webhook-Signature header.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SIGNATURE_HEADER = 'X-Webhook-Signature';

/**
 * Generate an HMAC-SHA256 signature for a payload.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature against a payload.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}
