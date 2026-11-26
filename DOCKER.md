# Self-hosting with Docker (Portainer / Synology Container Manager)

Two containers: **library-app** (website + API on one port) and **library-mongo** (the database).
The app image is built by GitHub and published as **`ghcr.io/omegus100/library`** (Intel/AMD and ARM), so the NAS only pulls it.

## One-time: make the image public

After the first successful run of the **Docker image** workflow (GitHub → repo → Actions):
GitHub → your profile → **Packages** → **library** → Package settings → *Change visibility* → **Public**.
(Or keep it private and add `ghcr.io` with a GitHub token under Portainer → Registries.)

## Deploy with Portainer

1. **Stacks → + Add stack**, name it `library`.
2. Build method, either:
   - **Repository:** URL `https://github.com/omegus100/Library`, reference `refs/heads/main`, compose path `docker-compose.yml`. Optionally turn on *GitOps updates* so Portainer redeploys when the repo changes.
   - **Web editor:** paste the contents of `docker-compose.yml`.
3. **Environment variables → Advanced mode**, paste the contents of `.env.docker.example` and fill in at least `SESSION_SECRET`. To keep data in a NAS share instead of Docker volumes, set e.g.
   `MONGO_DATA=/volume1/docker/library/db`, `COVERS_DATA=/volume1/docker/library/covers`, `BACKUP_DATA=/volume1/docker/library/backups` (create those folders first).
4. **Deploy the stack.** Both containers should turn *healthy* within a minute.
5. Create your owner account: Containers → **library-app** → **>_ Console** → Connect (`/bin/sh`), then run
   ```
   node scripts/create-owner.js you@example.com
   ```
6. Open `http://<nas-ip>:8080` and sign in.

**Database keeps restarting?** Older NAS processors (no AVX) can't run MongoDB 5 or newer. Set `MONGO_IMAGE=mongo:4.4` and redeploy (with a fresh/empty data volume).

**Updating:** Portainer → Stacks → library → *Pull and redeploy* (or let GitOps do it). Pin a release with `IMAGE_TAG=2.0.0`.

## Synology Container Manager (without Portainer)

Container Manager → **Project → Create** → choose a folder (e.g. `/volume1/docker/library`), *Create docker-compose.yml* → paste `docker-compose.yml`. Put the settings in a `.env` file in that folder (from `.env.docker.example`), then **Build**/start.

## Plain Docker

```
cp .env.docker.example .env        # fill in SESSION_SECRET
docker compose up -d
docker compose exec app node scripts/create-owner.js you@example.com
```

Build from source instead of pulling: `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build`

## Moving your library from Atlas to the NAS

1. On your computer, back up the live database (from `server/`):
   `node scripts/backup.js test` → creates `project/backups/test-<date>/`
2. Copy that folder into the app container and restore it into the (empty) NAS database:
   ```
   docker cp ./backups/test-<date> library-app:/tmp/restore
   docker exec library-app node scripts/restore-backup.js /tmp/restore
   ```
   (Portainer: copy the folder onto a NAS share mounted into the container, or use the console.)
3. Move covers out of the database into files (the container already has `COVER_STORAGE=local`):
   ```
   docker exec library-app node scripts/move-covers-to-files.js          # preview
   docker exec library-app node scripts/move-covers-to-files.js --apply
   ```
4. Create your owner account (step 5 above) if the backup didn't include one.

## Backups

The database container has a `/backups` folder (`BACKUP_DATA`). A dated, compressed dump:

```
docker exec library-mongo sh -c 'mongodump --db library --gzip --archive=/backups/library-$(date +%F).gz'
```

Schedule it in DSM → Control Panel → **Task Scheduler** (user-defined script, run as root), and include the backup and covers folders in Hyper Backup.

Restore a dump:

```
docker exec library-mongo sh -c 'mongorestore --gzip --archive=/backups/library-YYYY-MM-DD.gz --drop'
```

## Health

`GET /api/health` returns `{ "ok": true, "db": "up" }`. Both containers have health checks, shown in Portainer.

## Reaching it from outside your home

Put it behind DSM's reverse proxy (Control Panel → Login Portal → Advanced → Reverse Proxy) or your existing proxy, with HTTPS. The app needs no extra settings when the site and API share one address.
