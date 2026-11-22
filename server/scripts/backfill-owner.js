// Set the "owner" field on existing books, authors, series and settings that don't have one
// (records made before sign-in existed). Needed for a future multi-user version; harmless now.
//
//   node scripts/backfill-owner.js you@example.com            # dry run: counts only
//   node scripts/backfill-owner.js you@example.com --apply    # sets owner where it's missing
//
// Only fills an empty field; never changes a record that already has an owner.

const mongoose = require('mongoose')
const config = require('../config')
const User = require('../models/user')

const apply = process.argv.includes('--apply')

async function main() {
    const email = String(process.argv[2] || '').toLowerCase()
    if (!email || email.startsWith('--')) { console.error('Usage: node scripts/backfill-owner.js you@example.com [--apply]'); process.exit(1) }
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 15000 })
    const user = await User.findOne({ email })
    if (!user) { console.error(`No account for ${email}. Create it first: node scripts/create-owner.js ${email}`); process.exit(1) }

    const db = mongoose.connection.db
    console.log(`Database "${db.databaseName}", owner ${email}. Mode: ${apply ? 'APPLY' : 'dry run'}`)
    for (const name of ['books', 'authors', 'series', 'settings']) {
        const filter = { owner: { $exists: false } }
        const n = await db.collection(name).countDocuments(filter)
        if (apply && n) await db.collection(name).updateMany(filter, { $set: { owner: user._id } })
        console.log(`  ${name}: ${n} ${apply ? 'updated' : 'without an owner'}`)
    }
    await mongoose.disconnect()
}

main().catch(async (err) => {
    console.error('Failed:', err.message)
    await mongoose.disconnect()
    process.exit(1)
})
