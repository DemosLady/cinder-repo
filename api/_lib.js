// Shared helpers for Cinder serverless functions.
// Files starting with "_" are NOT exposed as routes by Vercel.
import { Redis } from '@upstash/redis';

// Reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN from the environment.
export const redis = Redis.fromEnv();

export const DAY = 60 * 60 * 24;
export const MAX_CT_CHARS = 90 * 1024;   // ~64KB of plaintext once base64'd
export const MAX_VIEWS = 10;
export const MAX_TTL = 30 * DAY;
export const MAX_PASS_ATTEMPTS = 30;

// URL-safe random token. 9 bytes -> 12 chars (ids), 18 bytes -> 24 chars (receipts).
export function tok(bytes = 18) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Buffer.from(b).toString('base64url');
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

// seconds of life left for a record, or a safe default if it never expires
export function remainingTtl(expiresAt) {
  if (!expiresAt) return MAX_TTL;
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

export async function loadJson(key) {
  const raw = await redis.get(key);
  if (raw == null) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

// Patch the sender's receipt record. Never throws.
export async function markReceipt(token, patch = {}) {
  if (!token) return;
  try {
    const r = await loadJson('r:' + token);
    if (!r) return;
    if (patch.opened) { r.opened = true; r.openCount = patch.openCount; r.lastOpenedAt = Date.now(); }
    if (patch.expired) r.expired = true;
    if (patch.burned) r.burnedAt = Date.now();
    await redis.set('r:' + token, JSON.stringify(r), { ex: 31 * DAY });
  } catch { /* receipts are best-effort */ }
}
