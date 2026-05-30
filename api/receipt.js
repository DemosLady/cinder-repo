// GET /api/receipt?token=...
// Looked up by the sender-only receipt token (separate from the secret id),
// so a recipient who has the link can't see the receipt.
import { loadJson } from './_lib.js';

export default async function handler(req, res) {
  try {
    const token = (req.query.token || '').toString();
    if (!token) return res.status(400).json({ error: 'missing token' });
    const r = await loadJson('r:' + token);
    if (!r) return res.status(404).json({ error: 'notfound' });
    res.status(200).json(r);
  } catch (e) {
    res.status(500).json({ error: 'server' });
  }
}
