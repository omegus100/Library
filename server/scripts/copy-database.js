// Copy every collection from one database to another on the same cluster (MONGO_URI).
// Used to make a dev copy so local testing never touches the live data.
//
//   node scripts/copy-database.js <from> <to>        e.g.  node scripts/copy-database.js test library_dev
//
// Reads <from>, writes only to <to>. Refuses if <to> already has documents (never overwrites).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const mongoose = require('mongoose')

const [from, to] = process.argv.slice(2)

async function main() {
  if (!from || !to || from === to) {
    console.error('Usage: node scripts/copy-database.js <from> <to>   (two different database names)')
    process.exit(1)
  }
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set (server/.env). Aborting.')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  const client = mongoose.connection.client
  const src = client.db(from)
  const dst = client.db(to)

  const existing = await dst.listCollections({}, { nameOnly: true }).toArray()
  for (const c of existing) {
    if ((await dst.collection(c.name).estimatedDocumentCount()) > 0) {
      console.error(`"${to}" already has data (collection "${c.name}"). Not overwriting. Aborting.`)
      await mongoose.disconnect()
      process.exit(1)
    }
  }

  const collections = (await src.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name).filter((n) => !n.startsWith('system.'))
  for (const name of collections) {
    const docs = await src.collection(name).find({}).toArray()
    if (docs.length) await dst.collection(name).insertMany(docs)
    console.log(`  ${name}: ${docs.length} copied`)
  }
  console.log(`\nCopied "${from}" -> "${to}".`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('Copy failed:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
