// GET /api/health — lets the client detect that a backend is present.
export default function handler(req, res) {
  res.status(200).json({ ok: true, service: 'cinder' });
}
