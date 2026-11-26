// Read-only backup of the whole library (SQLite file or Turso) to a folder of JSON files,
// plus a copy of the cover files when covers are stored as files.
//
//   node scripts/backup.js                 -> project/backups/library-<date>/
//   node scripts/backup.js /some/folder    -> /some/folder/library-<date>/
//   Docker: docker exec library node scripts/backup.js /data/backups
//
// Restore into an empty database with scripts/restore-backup.js.
// (A local SQLite file can also simply be copied while the app is stopped.)

const fs = require('fs')
const path = require('path')
const config = require('../config')
const db = require('../db')

const TABLES = ['users', 'authors', 'series', 'books', 'settings']

async function main() {
    await db.init()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const base = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', '..', 'backups')
    const outDir = path.join(base, `library-${stamp}`)
    fs.mkdirSync(outDir, { recursive: true })

    const summary = {}
    for (const table of TABLES) {
        const rows = await db.all(`SELECT * FROM ${table}`)
        fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2))
        summary[table] = rows.length
        console.log(`  ${table}: ${rows.length}`)
    }

    // Cover files (COVER_STORAGE=local)
    let files = 0
    if (fs.existsSync(config.coverDir)) {
        const target = path.join(outDir, 'covers')
        fs.mkdirSync(target, { recursive: true })
        for (const name of fs.readdirSync(config.coverDir)) {
            fs.copyFileSync(path.join(config.coverDir, name), path.join(target, name))
            files += 1
        }
        console.log(`  cover files: ${files}`)
    }

    fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify({
        createdAt: new Date().toISOString(),
        database: config.databaseUrl.replace(/\?.*$/, ''),
        tables: summary,
        coverFiles: files,
    }, null, 2))
    console.log(`\nBackup written to ${outDir}`)
    db.close()
}

main().catch((err) => {
    console.error('Backup failed:', err.message)
    process.exit(1)
})
