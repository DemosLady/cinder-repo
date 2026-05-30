# Cinder 🔥

Send a secret that self-destructs. One link, encrypted in the browser, gone the moment it's read — and you'll know when.

Cinder is **zero-knowledge**: the server only ever stores ciphertext. The decryption key lives in the link's `#fragment` (which browsers never send to a server) or is derived from a passphrase that travels through a separate channel. A database breach reveals nothing readable.

## How it works

- **Seal** — the secret is encrypted in your browser (AES-GCM). Only the ciphertext + rules are sent to the server, which returns a short `id` and a private `receipt` token.
- **Share** — you send the link (WhatsApp / email / QR). In passphrase mode the link is useless on its own; you send the passphrase through a *different* channel.
- **Open** — the recipient lands on the page, the secret is fetched and decrypted in their browser, then destroyed. Revealing is a button press (a `POST`), never a page load, so link-preview bots can't burn it by accident.
- **Receipt** — paste your receipt token to see if and when it was opened.

## Project layout

```
index.html        the whole app (works standalone in demo mode, or against /api)
api/_lib.js        shared Redis helpers (underscore = not a route)
api/health.js      GET  — backend presence check
api/seal.js        POST — store encrypted blob, return id + receipt token
api/open.js        POST — return blob; burns on read (link mode)
api/confirm.js     POST — register a successful passphrase-mode read & burn
api/receipt.js     GET  — sender-only status lookup
vercel.json        security headers + clean URLs
package.json       depends on @upstash/redis
```

If no backend is reachable, `index.html` falls back to a local demo (browser storage) so it still works as a single file.

## Deploy to Vercel

1. Push this folder to GitHub.
2. In Vercel: **Add New → Project → import the repo.** Framework preset: **Other**. No build command needed.
3. Add a Redis store: in the Vercel project go to **Storage → Marketplace → Upstash (Redis)**, create one, and **connect it** — it injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically. (Or set them by hand from upstash.com under **Settings → Environment Variables**.)
4. **Deploy.** Done.

## Local dev

```
npm i
npm i -g vercel
vercel dev          # runs the functions locally
```
Put your Upstash keys in `.env.local`.

## Limits (v1)

Text secrets only. Up to ~64KB, 1–10 reads, optional expiry up to 30 days. File/image support and rate limiting are next.
