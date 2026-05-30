// POST /api/seal
// Body: { iv, ct, maxViews, ttl, pass:bool, salt?, wIv?, wCt? }
// Stores ONLY ciphertext + metadata. The decryption key never reaches the server.
import { redis, tok, readBody, DAY, MAX_CT_CHARS, MAX_VIEWS, MAX_TTL } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { iv, ct, maxViews, ttl, pass, salt, wIv, wCt } = readBody(req);

    if (!iv || !ct) return res.status(400).json({ error: 'missing iv/ct' });
    if (typeof ct !== 'string' || ct.length > MAX_CT_CHARS) return res.status(413).json({ error: 'too large' });
    if (pass && (!salt || !wIv || !wCt)) return res.status(400).json({ error: 'missing wrapped key' });

    const mv = Math.min(Math.max(parseInt(maxViews) || 1, 1), MAX_VIEWS);
    const t = Math.min(Math.max(parseInt(ttl) || 0, 0), MAX_TTL);
    const exp = t || MAX_TTL;          // never-expiring secrets still get a 30d safety cap

    const id = tok(9);
    const receiptToken = tok(18);
    const now = Date.now();

    const rec = {
      iv, ct,
      maxViews: mv, views: 0,
      pass: !!pass,
      salt: salt || null, wIv: wIv || null, wCt: wCt || null,
      receiptToken, attempts: 0,
      createdAt: now,
      expiresAt: t ? now + t * 1000 : 0
    };

    await redis.set('s:' + id, JSON.stringify(rec), { ex: exp });
    await redis.set('r:' + receiptToken, JSON.stringify({
      createdAt: now, opened: false, openCount: 0, expiresAt: rec.expiresAt, maxViews: mv
    }), { ex: exp + DAY });

    res.status(200).json({ id, receiptToken });
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
}
