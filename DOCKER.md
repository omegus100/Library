# Self-hosting with Docker (NAS)

One container runs the site and the API; a second runs MongoDB. Covers are files on a volume.

## First start

On the NAS (Synology: Container Manager → Project → Create, pointing at this folder), or any Docker host:

```
cp .env.docker.example .env        # then edit .env: set SESSION_SECRET
docker compose up -d --build
docker compose exec app node scripts/create-owner.js you@example.com
```

Open `http://<nas-ip>:8080` (change `APP_PORT` in `.env` to use another port).

## Moving your library from Atlas to the NAS

1. On your computer, back up the live database (from `server/`):
   `node scripts/backup.js test` → creates `project/backups/test-<date>/`
2. Copy that folder into the app container and restore it into the (empty) NAS database:
   ```
   docker compose cp ./backups/test-<date> app:/tmp/restore
   docker compose exec app node scripts/restore-backup.js /tmp/restore
   ```
3. Move covers out of the database into files (the container already has `COVER_STORAGE=local`):
   ```
   docker compose exec app node scripts/move-covers-to-files.js          # preview
   docker compose exec app node scripts/move-covers-to-files.js --apply
   ```
4. Create your owner account (step above) if the backup didn't include one.

## Backups on the NAS

The `mongo` container mounts `./backups`. A dated, compressed dump:

```
docker compose exec mongo sh -c 'mongodump --db library --gzip --archive=/backups/library-$(date +%F).gz'
```

Schedule that with the NAS's task scheduler (Synology: Control Panel → Task Scheduler → user-defined script), and also back up the `covers` volume folder.

Restore a dump:

```
docker compose exec mongo sh -c 'mongorestore --gzip --archive=/backups/library-YYYY-MM-DD.gz --drop'
```

## Health

`GET /api/health` returns `{ ok: true, db: "up" }`. Both containers have health checks; `docker compose ps` shows their state.

## Updating

```
docker compose up -d --build
```

Data (database and covers) lives in named volumes and survives rebuilds.
