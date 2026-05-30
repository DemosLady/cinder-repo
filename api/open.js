// POST /api/open  Body: { id }
// Returns the encrypted blob. Burn accounting differs by mode:
//  - link mode: possessing the link == possessing the secret, so the read is
//    counted here and the record is deleted on the final read.
//  - passphrase mode: the blob is useless without the passphrase, so we DON'T
//    burn on fetch. We only count an attempt (to cap brute force). The real
//    burn happens in /api/confirm after the client decrypts successfully.
import { redis, loadJson, markReceipt, remainingTtl, readBody, MAX_PASS_ATTEMPTS } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { id } = readBody(req);
    if (!id) return res.status(400).json({ error: 'missing id' });

    const rec = await loadJson('s:' + id);
    if (!rec) return res.status(404).json({ error: 'gone' });

    if (rec.expiresAt && Date.now() > rec.expiresAt) {
      await redis.del('s:' + id);
      await markReceipt(rec.receiptToken, { expired: true });
      return res.status(410).json({ error: 'expired' });
    }

    if (!rec.pass) {
      rec.views += 1;
      const burned = rec.views >= rec.maxViews;
      await markReceipt(rec.receiptToken, { opened: true, openCount: rec.views, burned });
      if (burned) await redis.del('s:' + id);
      else await redis.set('s:' + id, JSON.stringify(rec), { ex: remainingTtl(rec.expiresAt) });
      return res.status(200).json({
        iv: rec.iv, ct: rec.ct, pass: false,
        remaining: Math.max(0, rec.maxViews - rec.views), burned
      });
    }

    // passphrase mode
    rec.attempts = (rec.attempts || 0) + 1;
    if (rec.attempts > MAX_PASS_ATTEMPTS) {
      await redis.del('s:' + id);
      await markReceipt(rec.receiptToken, { burned: true });
      return res.status(429).json({ error: 'too many attempts' });
    }
    await redis.set('s:' + id, JSON.stringify(rec), { ex: remainingTtl(rec.expiresAt) });
    return res.status(200).json({
      iv: rec.iv, ct: rec.ct, pass: true,
      salt: rec.salt, wIv: rec.wIv, wCt: rec.wCt
    });
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
}
