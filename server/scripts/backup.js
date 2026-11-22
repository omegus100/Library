// Read-only backup of the database in MONGO_URI to JSON files.
//
//   node scripts/backup.js                    # database named in MONGO_URI (default "test")
//   node scripts/backup.js myFirstDatabase    # another database on the same cluster
//
// Writes project/backups/<timestamp>/<collection>.json in Extended JSON (canonical),
// so ObjectIds, Dates and number-vs-string types survive exactly. Never writes to the database.
// Use this when mongodump isn't installed; mongodump works too.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { EJSON } = mongoose.mongo.BSON

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set (server/.env). Aborting.')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  // Database: the argument, else MONGO_DB_NAME (as the server uses), else the one in MONGO_URI
  const dbName = process.argv[2] || process.env.MONGO_DB_NAME
  const db = dbName ? mongoose.connection.client.db(dbName) : mongoose.connection.db
  console.log(`Connected. Database: "${db.databaseName}"`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = path.join(__dirname, '..', '..', 'backups', `${db.databaseName}-${stamp}`)
  fs.mkdirSync(outDir, { recursive: true })

  const collections = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort()

  const summary = {}
  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray()
    fs.writeFileSync(path.join(outDir, `${name}.json`), EJSON.stringify(docs, null, 2, { relaxed: false }))
    summary[name] = docs.length
    console.log(`  ${name}: ${docs.length} document(s)`)
  }

  fs.writeFileSync(
    path.join(outDir, '_summary.json'),
    JSON.stringify({ database: db.databaseName, createdAt: new Date().toISOString(), collections: summary }, null, 2)
  )
  console.log(`\nBackup written to ${outDir}`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('Backup failed:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
