// Shared helpers for Cinder serverless functions.
// Files starting with "_" are NOT exposed as routes by Vercel.
import { Redis } from '@upstash/redis';

export const DAY = 60 * 60 * 24;
export const MAX_CT_CHARS = 90 * 1024;   // ~64KB of plaintext once base64'd
export const MAX_VIEWS = 10;
export const MAX_TTL = 30 * DAY;
export const MAX_PASS_ATTEMPTS = 30;

// Lazy Redis client. Accepts BOTH the Upstash-native and the Vercel-KV env names,
// so it works no matter which integration you connected in Vercel.
let _redis;
export function db() {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Redis is not configured. Connect Upstash in Vercel, or set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// URL-safe random token. 9 bytes -> 12 chars (ids), 18 bytes -> 24 chars (receipts).
export function tok(bytes = 18) {
  const b = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(b);
  return Buffer.from(b).toString('base64url');
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export function remainingTtl(expiresAt) {
  if (!expiresAt) return MAX_TTL;
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

export async function loadJson(key) {
  const raw = await db().get(key);
  if (raw == null) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function markReceipt(token, patch = {}) {
  if (!token) return;
  try {
    const r = await loadJson('r:' + token);
    if (!r) return;
    if (patch.opened) { r.opened = true; r.openCount = patch.openCount; r.lastOpenedAt = Date.now(); }
    if (patch.expired) r.expired = true;
    if (patch.burned) r.burnedAt = Date.now();
    await db().set('r:' + token, JSON.stringify(r), { ex: 31 * DAY });
  } catch { /* receipts are best-effort */ }
}
