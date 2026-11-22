# Library

A personal book catalog: find any book fast, track what you're reading, and keep notes, shelves, loans and a wishlist. Anyone can browse; only the signed-in owner can change things.

- `client/`: React 19 + Vite, React Router 7, TanStack Query. CSS Modules with design tokens (`src/styles/tokens.css`), light and dark.
- `server/`: Express 5, Mongoose 8, MongoDB.
- Hosting today: client on Netlify, API on Render. Later: one Docker container on a NAS ([DOCKER.md](DOCKER.md)).

## Features

| Area | What you get |
| --- | --- |
| Find | Search by title, author, series or ISBN (press `/`), status chips, format/genre/shelf filters, sort, grid or list, browse by author, series, genre, format |
| Catalog | Add from Google Books (search or **scan the barcode** on phones), or enter by hand; duplicate check; covers resized before upload; "Fill missing details" from Google Books |
| Reading | Status in one click, page progress, start/finish dates (filled in automatically), 1–5 star rating, yearly goal and a Reading page with books per month |
| Your copy | Shelves (tags), wishlist (books you want but don't own), loans (who has it, since when), private notes |
| Data | Export CSV or JSON, import a Goodreads export (with a preview), backup and restore scripts |
| Access | Owner sign-in protects every change; visitors see the catalog but not notes or loans |

## Run it locally

Needs Node 18+.

```
npm install            # in project/ (dev tools)
npm run install-all    # server + client packages
npm run dev            # API on :5000, site on http://localhost:3000
```

`server/.env` must exist (see [ENV_SETUP.md](ENV_SETUP.md)). Locally it points at **`library_dev`**, a copy of the live database, so testing never touches your real books.

**First time:** create the owner account for the database you're using:

```
cd server
node scripts/create-owner.js you@example.com
```

## Commands (from `project/`)

| Command | What it does |
| --- | --- |
| `npm run install-all` | Install server and client packages |
| `npm run dev` | API (5000) and site (3000) together |
| `npm run server-dev` | API only, restarts on changes |
| `npm run build` | Client production build (`client/build`) |

## Server scripts (from `server/`)

All read `server/.env` (`MONGO_URI` + `MONGO_DB_NAME`). Anything that writes has a dry run by default.

| Script | Purpose |
| --- | --- |
| `create-owner.js <email>` | Create the owner account, or reset its password |
| `backup.js [db]` | JSON backup of a database into `project/backups/` (read-only) |
| `restore-backup.js <folder>` | Load a backup into an **empty** database (moving to the NAS) |
| `copy-database.js <from> <to>` | Copy one database to a new, empty one (e.g. a fresh dev copy) |
| `backfill-owner.js <email> [--apply]` | Set `owner` on records made before sign-in existed |
| `move-covers-to-files.js [--apply]` | Move covers out of the database into files (`COVER_STORAGE=local`) |
| `migrate-isbn-to-string.js`, `merge-old-database.js` | One-off migrations (already applied to live, 2026-11-21) |

## API

All under `/api`. Reads are public; writes need `Authorization: Bearer <token>` from the owner.

| Route | Notes |
| --- | --- |
| `POST /auth/login`, `GET /auth/me`, `GET /auth/status`, `POST /auth/password`, `POST /auth/logout-everywhere` | Owner sign-in |
| `GET /books?view=list&q=&status=&format=&genre=&shelf=&owned=&loaned=&authorId=&seriesId=&sort=&page=&limit=` | Light, paged list (no cover bytes); `GET /books` without `view` is the legacy full list |
| `GET /books/:id`, `GET /books/:id/cover` | One book; its cover image (cached) |
| `POST /books`, `PUT`/`PATCH /books/:id`, `DELETE /books/:id` | Changes are partial: only the fields you send change |
| `POST /books/:id/refresh` | Fill empty fields (and a missing cover) from Google Books |
| `GET /books/facets`, `/books/counts`, `/books/summary`, `/books/lookup` | Filter menus, per-author/series counts, light list, duplicate check |
| `GET/POST/PUT/DELETE /authors`, `/series` | Renames update the copies on every book |
| `GET /lookup?q=` or `?isbn=` | Google Books search through the server (owner) |
| `GET /stats?year=`, `GET/PUT /settings` | Reading numbers; yearly goal |
| `GET /export?format=csv\|json`, `POST /import` | Export; Goodreads/CSV import (`dryRun` by default) |
| `GET /health` | For Docker / uptime checks |
