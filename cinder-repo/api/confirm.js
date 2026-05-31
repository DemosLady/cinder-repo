// POST /api/confirm  Body: { id }
// Called by the client AFTER a successful passphrase-mode decryption, so a
// wrong passphrase never consumes a read or burns the secret.
import { db, loadJson, markReceipt, remainingTtl, readBody } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { id } = readBody(req);
    if (!id) return res.status(400).json({ error: 'missing id' });

    const rec = await loadJson('s:' + id);
    if (!rec) return res.status(200).json({ burned: true, remaining: 0 });

    rec.views = (rec.views || 0) + 1;
    const burned = rec.views >= rec.maxViews;
    await markReceipt(rec.receiptToken, { opened: true, openCount: rec.views, burned });
    if (burned) await db().del('s:' + id);
    else await db().set('s:' + id, JSON.stringify(rec), { ex: remainingTtl(rec.expiresAt) });

    res.status(200).json({ burned, remaining: Math.max(0, rec.maxViews - rec.views) });
  } catch (e) {
    res.status(500).json({ error: 'server', detail: String((e && e.message) || e) });
  }
}
