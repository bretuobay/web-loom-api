import { describe, it, expect } from 'vitest';
import { signPayload, verifySignature, SIGNATURE_HEADER } from '../signature';

describe('signPayload', () => {
  it('produces a hex string', () => {
    const sig = signPayload('hello', 'secret');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const a = signPayload('data', 'key');
    const b = signPayload('data', 'key');
    expect(a).toBe(b);
  });

  it('differs for different payloads', () => {
    const a = signPayload('payload-a', 'key');
    const b = signPayload('payload-b', 'key');
    expect(a).not.toBe(b);
  });

  it('differs for different secrets', () => {
    const a = signPayload('data', 'key-a');
    const b = signPayload('data', 'key-b');
    expect(a).not.toBe(b);
  });
});

describe('verifySignature', () => {
  it('returns true for a valid signature', () => {
    const sig = signPayload('hello', 'secret');
    expect(verifySignature('hello', 'secret', sig)).toBe(true);
  });

  it('returns false for a tampered payload', () => {
    const sig = signPayload('hello', 'secret');
    expect(verifySignature('tampered', 'secret', sig)).toBe(false);
  });

  it('returns false for a wrong secret', () => {
    const sig = signPayload('hello', 'secret');
    expect(verifySignature('hello', 'wrong', sig)).toBe(false);
  });

  it('returns false for a malformed signature', () => {
    expect(verifySignature('hello', 'secret', 'not-a-valid-hex')).toBe(false);
  });
});

describe('SIGNATURE_HEADER', () => {
  it('is X-Webhook-Signature', () => {
    expect(SIGNATURE_HEADER).toBe('X-Webhook-Signature');
  });
});
