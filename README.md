# KP-Cards

A small series of card games at one table. **Tiến Lên** is live. **Speed** is next.

- Same felt, same cards, pick a game on the home screen
- Next.js + Upstash Redis · deploy on Vercel
- No accounts — a display name and a browser id are enough

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Upstash env vars, rooms live **in memory** on that one `next dev` process (two browser tabs on the same machine work; two laptops do not).

```bash
npm test
npm run lint
```

### Multiplayer across devices

1. Create a Redis database at [console.upstash.com](https://console.upstash.com).
2. Copy the REST URL and token into `.env.local`:

```env
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxx
```

3. Restart `npm run dev`.

On Vercel, add the same two variables on the project, then redeploy.

## Games

| Path | Game |
|------|------|
| `/` | Home — pick a game |
| `/tienlen` | Tiến Lên (Thirteen) — solo bots or a shared table |
| `/speed` | Speed — placeholder |

Old Tiến Lên links `/game/:room` and `/solo` still redirect.

## License

MIT — play with friends.
