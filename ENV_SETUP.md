# Environment setup

## Server (`server/.env`, never committed)

| Variable | Required | What it does |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB_NAME` | No | Database to use on that cluster, overriding the one in the URI. Locally: `library_dev` (a copy). Live data is `test`. |
| `SESSION_SECRET` | **Yes in production** | Long random string that signs sign-in tokens. If missing, a random one is used and everyone is signed out on restart. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `PORT` | No | Default `5000` (Render sets it) |
| `CLIENT_ORIGIN` | In production | Site address(es) allowed to call the API from a browser, comma-separated, no trailing slash |
| `COVER_STORAGE` | No | `db` (default; covers inside each book) or `local` (files in `COVER_DIR`, for Docker/NAS) |
| `COVER_DIR` | With `local` | Folder for cover files (Docker: `/data/covers`) |
| `GOOGLE_BOOKS_API_KEY` | No | Avoids Google's shared "too many requests" limit. Free from Google Cloud Console → APIs → Books API |
| `SESSION_DAYS` | No | How long a sign-in lasts (default 30) |
| `CLIENT_DIST` | Docker only | Folder of the built client for Express to serve |

### Render (production API) — needed before deploying this version

Render → *Library App Data* → Environment:

1. `MONGO_URI` (already set)
2. `CLIENT_ORIGIN` = `https://fancy-cascaron-1538a9.netlify.app` (already set, 2026-11-21)
3. **`SESSION_SECRET`** = a new long random string (see above). Not set yet.
4. Optional: `GOOGLE_BOOKS_API_KEY`

Then create the owner in the **live** database (once), from `server/` on your computer:

```
MONGO_DB_NAME=test node scripts/create-owner.js you@example.com
```

(PowerShell: `$env:MONGO_DB_NAME='test'; node scripts/create-owner.js you@example.com`)

Without an owner account, nobody can add or edit books on the live site.

## Client

| File | Used by | Value |
| --- | --- | --- |
| `client/.env.development` | `npm run dev` | `VITE_API_BASE_URL=` (empty: relative `/api`, proxied to :5000) |
| `client/.env.production` | `npm run build` (Netlify) | `VITE_API_BASE_URL=https://react-rebuild.onrender.com` |
| `client/.env.docker` | Docker build | `VITE_API_BASE_URL=` (same server) |

Read only in `client/src/config.js`. Anything starting with `VITE_` ends up in the browser, so never put secrets there.

### Netlify

Builds `client/` with `npm run build`, publishes `client/build`. `client/public/_redirects` sends every path to `index.html` so refreshing any page works.
