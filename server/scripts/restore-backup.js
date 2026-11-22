// Load a backup folder made by scripts/backup.js into an EMPTY database.
// Used to move your library onto the NAS (or anywhere new).
//
//   node scripts/restore-backup.js ../backups/test-2026-11-21T08-28-55-592Z
//
// Writes to the database in MONGO_URI (+ MONGO_DB_NAME). Refuses if it already has books,
// authors or series (never overwrites). In Docker:
//   docker compose cp ./backups/<folder> app:/tmp/restore
//   docker compose exec app node scripts/restore-backup.js /tmp/restore

const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const config = require('../config')

const { EJSON } = mongoose.mongo.BSON

async function main() {
    const dir = process.argv[2]
    if (!dir || !fs.existsSync(dir)) {
        console.error('Usage: node scripts/restore-backup.js <backup folder>')
        process.exit(1)
    }
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 15000 })
    const db = mongoose.connection.db

    for (const name of ['books', 'authors', 'series', 'users']) {
        if ((await db.collection(name).estimatedDocumentCount()) > 0) {
            console.error(`Database "${db.databaseName}" already has ${name}. Not overwriting. Aborting.`)
            await mongoose.disconnect()
            process.exit(1)
        }
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    for (const file of files) {
        const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'), { relaxed: false })
        const name = path.basename(file, '.json')
        if (docs.length) await db.collection(name).insertMany(docs)
        console.log(`  ${name}: ${docs.length} restored`)
    }
    console.log(`\nRestored into "${db.databaseName}". Next: node scripts/create-owner.js you@example.com`)
    await mongoose.disconnect()
}

main().catch(async (err) => {
    console.error('Restore failed:', err.message)
    await mongoose.disconnect()
    process.exit(1)
})
