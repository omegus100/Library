// Load a backup folder made by scripts/backup.js into an EMPTY database (SQLite file or Turso),
// and copy its cover files into COVER_DIR.
//
//   node scripts/restore-backup.js ../backups/library-2026-11-26T03-00-00-000Z
//   Docker: docker exec library node scripts/restore-backup.js /data/backups/library-<date>
//
// Refuses if the database already has books, authors, series or users (never overwrites).
// For a MongoDB backup (from the old version), use scripts/import-mongo-backup.js instead.

const fs = require('fs')
const path = require('path')
const config = require('../config')
const db = require('../db')

const TABLES = ['users', 'authors', 'series', 'books', 'settings'] // parents before children

async function main() {
    const dir = process.argv[2]
    if (!dir || !fs.existsSync(path.join(dir, 'books.json'))) {
        console.error('Usage: node scripts/restore-backup.js <backup folder made by backup.js>')
        process.exit(1)
    }
    await db.init()
    for (const table of ['users', 'authors', 'series', 'books']) {
        if (Number((await db.get(`SELECT COUNT(*) n FROM ${table}`)).n) > 0) {
            console.error(`The database already has ${table}. Not overwriting. Aborting.`)
            db.close()
            process.exit(1)
        }
    }

    for (const table of TABLES) {
        const file = path.join(dir, `${table}.json`)
        if (!fs.existsSync(file)) continue
        const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
        for (const row of rows) {
            const cols = Object.keys(row)
            await db.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c]))
        }
        console.log(`  ${table}: ${rows.length} restored`)
    }

    const coverSrc = path.join(dir, 'covers')
    if (fs.existsSync(coverSrc)) {
        fs.mkdirSync(config.coverDir, { recursive: true })
        const names = fs.readdirSync(coverSrc)
        names.forEach((n) => fs.copyFileSync(path.join(coverSrc, n), path.join(config.coverDir, n)))
        console.log(`  cover files: ${names.length} copied to ${config.coverDir}`)
    }
    console.log('\nRestore complete.')
    db.close()
}

main().catch((err) => {
    console.error('Restore failed:', err.message)
    process.exit(1)
})
