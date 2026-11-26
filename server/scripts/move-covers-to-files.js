// Switch where existing covers are stored.
//
//   node scripts/move-covers-to-files.js               # preview: covers inside books -> files in COVER_DIR
//   node scripts/move-covers-to-files.js --apply
//   node scripts/move-covers-to-files.js --to-db        # preview: cover files -> inside books (e.g. moving to Turso/Render)
//   node scripts/move-covers-to-files.js --to-db --apply
//
// Back up first (node scripts/backup.js). Each book is updated only after its cover is stored the new way.
// Afterwards set COVER_STORAGE to match (local for files, db for inside books).

const config = require('../config')
const db = require('../db')
const covers = require('../lib/covers')

const apply = process.argv.includes('--apply')
const toDb = process.argv.includes('--to-db')

async function main() {
    await db.init()
    const rows = await db.all(`SELECT id, title, cover FROM books WHERE cover ${toDb ? "LIKE 'file:%'" : "LIKE 'data:image/%'"}`)
    console.log(`${rows.length} cover(s) to move ${toDb ? 'from files into the database' : `into files in ${config.coverDir}`}. Mode: ${apply ? 'APPLY' : 'preview'}\n`)

    let bytes = 0
    for (const row of rows) {
        const image = await covers.read(row.cover)
        if (!image) { console.log(`  skipped (unreadable)  ${row.title}`); continue }
        bytes += image.buffer.length
        if (!apply) { console.log(`  would move  ${row.title} (${Math.round(image.buffer.length / 1024)} KB)`); continue }

        const next = toDb
            ? `data:${image.contentType};base64,${image.buffer.toString('base64')}`
            : await covers.writeFile(image, row.id)
        await db.run('UPDATE books SET cover = ? WHERE id = ?', [next, row.id])
        if (toDb) await covers.remove(row.cover)
        console.log(`  moved  ${row.title}`)
    }
    console.log(`\n${(bytes / 1024 / 1024).toFixed(1)} MB${apply ? ` moved. Set COVER_STORAGE=${toDb ? 'db' : 'local'}.` : '. Preview only; re-run with --apply.'}`)
    db.close()
}

main().catch((err) => {
    console.error('Failed:', err.message)
    process.exit(1)
})
