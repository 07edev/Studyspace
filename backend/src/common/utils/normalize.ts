import { createHash, randomBytes } from 'crypto';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// E.164-like: strip spaces/dashes, keep leading +.
export const normalizePhone = (phone: string) => phone.replace(/[\s\-().]/g, '');

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

// Opaque high-entropy token for refresh tokens / reset grants. Store only sha256 of it.
export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

const SENSITIVE_KEY = /pass(word)?|token|otp|secret|hash|authorization|cookie|pin/i;

// Deep-redacts secrets before anything reaches audit logs or outbox payloads.
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => redact(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1),
    ]),
  );
}
