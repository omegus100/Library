# Self-hosting with Docker (Portainer / Synology Container Manager)

**One container** (`library`) serves the website and the API. All data is in **`/data`**:

```
/data/library.db      the database (SQLite, one file)
/data/covers/         cover images
```

Back up that folder and you've backed up everything. The image is built by GitHub and published as `ghcr.io/omegus100/library` (Intel/AMD and ARM), so the NAS only downloads it.

## Deploy with Portainer

1. On the NAS, create a folder for the data, e.g. `/volume1/docker/library`.
   - *Bringing your existing books?* Copy `server/data/library.db` and the `server/data/covers` folder from your computer into it now (see "Your existing library" below).
2. Portainer → **Stacks → + Add stack**, name `library`.
3. Build method **Repository**: URL `https://github.com/omegus100/Library`, reference `refs/heads/main` (or the branch you're testing), compose path `docker-compose.yml`.
   Or **Web editor** and paste `docker-compose.yml`.
4. **Environment variables → Advanced mode**, paste and fill in:
   ```
   SESSION_SECRET=<a long random string>
   DATA_PATH=/volume1/docker/library
   PUID=1026
   PGID=100
   APP_PORT=8080
   ```
   `PUID`/`PGID` = the NAS user that should own the files (Synology: SSH in and run `id`, or use your admin user; 1026/100 is common). Leave `DATA_PATH` out to use a Docker volume instead of a folder.
5. **Deploy the stack.** The container turns *healthy* in under a minute.
6. Open `http://<nas-ip>:8080`.
   - Imported your library? Sign in with your existing email and password.
   - Starting fresh? Containers → **library** → **>_ Console** → Connect, run `node scripts/create-owner.js you@example.com`.

**Updating:** Stacks → library → **Pull and redeploy**. Pin a version with `IMAGE_TAG=2.0.0`.

## Your existing library

Your books, covers and account are already converted on your computer in `project/server/data/` (`library.db` + `covers/`). Copy both into the NAS folder **before the first start** (or stop the stack, copy, start again).

Other ways in:
- From a MongoDB backup (old version): copy the backup folder into `/data`, then in the container console:
  `node scripts/import-mongo-backup.js /data/<backup-folder> --apply`
- From a backup made by this version: `node scripts/restore-backup.js /data/backups/library-<date>`

## Backups

- **Simplest:** include the data folder in Hyper Backup / your NAS backup. (For a perfectly consistent copy, stop the container first, or use the script below.)
- **Script (safe while running):** Containers → library → Console:
  `node scripts/backup.js /data/backups` → `/data/backups/library-<date>/` (database tables as JSON + cover files).
  Schedule it from DSM Task Scheduler: `docker exec library node scripts/backup.js /data/backups`

## Synology Container Manager (without Portainer)

Container Manager → **Project → Create** → folder `/volume1/docker/library-stack` → *Create docker-compose.yml* → paste `docker-compose.yml`. Put the settings in a `.env` file in that folder (from `.env.docker.example`), then start.

## Plain Docker

```
docker run -d --name library -p 8080:5000 \
  -e SESSION_SECRET=change-me -e PUID=1000 -e PGID=1000 \
  -v /path/to/library-data:/data \
  ghcr.io/omegus100/library:latest
```

Build from source instead: `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `SESSION_SECRET` | (required) | Signs sign-ins. Keep it private and stable. |
| `DATA_PATH` | `library-data` volume | Where `/data` lives on the NAS |
| `PUID` / `PGID` | `1000` / `1000` | Owner of the files in the data folder |
| `APP_PORT` | `8080` | Port on the NAS |
| `IMAGE_TAG` | `latest` | Image version |
| `TZ` | `UTC` | Timezone |
| `GOOGLE_BOOKS_API_KEY` | — | Avoids Google's shared search limit |
| `CALIBRE_LIBRARY_PATH` | — | Calibre library folder, mounted read-only at `/calibre` |

## Calibre ebooks (optional)

The app can mark which books you also have as ebooks and add your Calibre ebooks to the catalog. It only reads the Calibre library (mounted read-only) and never changes it.

1. In the stack's environment variables, add your Calibre library folder (the one with `metadata.db`), e.g.
   `CALIBRE_LIBRARY_PATH=/volume1/Media/Books`. Then **Update the stack**.
2. In the app: **Settings → Calibre ebooks**. The folder is already `/calibre`. Optionally enter your Calibre-Web address (e.g. `http://your-nas:8083`) for "Read in Calibre-Web" links. Click **Turn on and sync**.
3. Books you already have get "eBook" added and a Calibre cover if they had none. The rest are listed under **Not in your library yet**, where you pick which to add.

It syncs again every 6 hours, or on **Sync now**. Ebooks removed from Calibre are flagged on the book page, never deleted. The address and folder are stored in the app's own settings, not in code.

## Health and outside access

`GET /api/health` → `{ "ok": true, "db": "up" }` (used by the container's health check).
For access outside your home, put it behind DSM's reverse proxy (Control Panel → Login Portal → Advanced → Reverse Proxy) or your existing proxy, with HTTPS.
