// Move covers stored inside books (data URLs) into image files in COVER_DIR, for COVER_STORAGE=local.
// Use when switching to the NAS / Docker setup. Smaller documents = faster database.
//
//   node scripts/move-covers-to-files.js            # dry run: counts and sizes only
//   node scripts/move-covers-to-files.js --apply    # writes files, then points each book at its file
//
// Back up first (node scripts/backup.js). Each book is only updated after its file is written.
// Requires COVER_STORAGE=local (and COVER_DIR) in the environment.

const mongoose = require('mongoose')
const config = require('../config')
const covers = require('../lib/covers')
const Book = require('../models/book')

const apply = process.argv.includes('--apply')

async function main() {
    if (config.coverStorage !== 'local') {
        console.error('Set COVER_STORAGE=local (and COVER_DIR) first, so new files go to the right place.')
        process.exit(1)
    }
    await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName, serverSelectionTimeoutMS: 15000 })
    console.log(`Database "${mongoose.connection.db.databaseName}" -> ${config.coverDir}. Mode: ${apply ? 'APPLY' : 'dry run'}\n`)

    const books = await Book.find({ coverImagePath: /^data:image\// }, { title: 1, coverImagePath: 1 })
    let bytes = 0
    for (const book of books) {
        const parsed = covers.parseDataUrl(book.coverImagePath)
        if (!parsed) continue
        bytes += parsed.buffer.length
        if (apply) {
            const ref = await covers.store(parsed, book._id)
            await Book.updateOne({ _id: book._id }, { $set: { coverImagePath: ref } }, { timestamps: false })
            console.log(`  moved  ${book.title} -> ${ref}`)
        } else {
            console.log(`  would move  ${book.title} (${Math.round(parsed.buffer.length / 1024)} KB)`)
        }
    }
    console.log(`\n${books.length} cover(s), ${(bytes / 1024 / 1024).toFixed(1)} MB${apply ? ' moved.' : '. Dry run only; re-run with --apply.'}`)
    await mongoose.disconnect()
}

main().catch(async (err) => {
    console.error('Failed:', err.message)
    await mongoose.disconnect()
    process.exit(1)
})
