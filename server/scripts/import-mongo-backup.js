// Load a MongoDB backup folder (made by the old scripts/backup.js, Extended JSON) into the SQLite/Turso
// database. One-time move off MongoDB. Keeps ids (so links still work), your owner account, covers.
//
//   node scripts/import-mongo-backup.js ../backups/test-2026-11-26T02-38-18-119Z            # preview
//   node scripts/import-mongo-backup.js ../backups/test-2026-11-26T02-38-18-119Z --apply    # import
//
// Writes to DATABASE_URL (default: local data/library.db). Refuses if it already has books (never overwrites).
// Covers: saved as files when COVER_STORAGE=local (default), or kept inside each book when COVER_STORAGE=db.

const fs = require('fs')
const path = require('path')
const config = require('../config')
const db = require('../db')
const Books = require('../db/books')
const { users: Users, authors: Authors, series: Series, settings: Settings } = require('../db/repos')
const covers = require('../lib/covers')

const apply = process.argv.includes('--apply')

// Canonical Extended JSON -> plain JS ({"$oid"} -> string, {"$date"} -> ISO string, numbers, binary)
function fromEJSON(v) {
    if (Array.isArray(v)) return v.map(fromEJSON)
    if (v && typeof v === 'object') {
        if ('$oid' in v) return v.$oid
        if ('$date' in v) {
            const d = v.$date
            const ms = typeof d === 'object' ? Number(d.$numberLong) : typeof d === 'number' ? d : Date.parse(d)
            return new Date(ms).toISOString()
        }
        if ('$numberInt' in v) return Number(v.$numberInt)
        if ('$numberLong' in v) return Number(v.$numberLong)
        if ('$numberDouble' in v) return Number(v.$numberDouble)
        if ('$numberDecimal' in v) return Number(v.$numberDecimal)
        if ('$binary' in v) return Buffer.from(v.$binary.base64 ?? v.$binary, 'base64')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromEJSON(x)]))
    }
    return v
}

const read = (dir, name) => {
    const file = path.join(dir, `${name}.json`)
    return fs.existsSync(file) ? fromEJSON(JSON.parse(fs.readFileSync(file, 'utf8'))) : []
}
const isoOrUndef = (d) => (d ? new Date(d).toISOString() : undefined)

async function main() {
    const dir = process.argv[2]
    if (!dir || !fs.existsSync(dir)) {
        console.error('Usage: node scripts/import-mongo-backup.js <backup folder> [--apply]')
        process.exit(1)
    }
    const [users, authors, series, books, settings] = ['users', 'authors', 'series', 'books', 'settings'].map((n) => read(dir, n))
    console.log(`Backup: ${books.length} books, ${authors.length} authors, ${series.length} series, ${users.length} user(s)`)
    console.log(`Target: ${config.databaseUrl.replace(/\?.*$/, '')} (covers: ${config.coverStorage}). Mode: ${apply ? 'APPLY' : 'preview'}\n`)

    await db.init()
    const existing = Number((await db.get('SELECT COUNT(*) n FROM books')).n)
    if (existing > 0) {
        console.error(`The target database already has ${existing} book(s). Not overwriting. Aborting.`)
        db.close()
        process.exit(1)
    }

    const authorIds = new Set(authors.map((a) => a._id))
    const seriesIds = new Set(series.map((s) => s._id))
    let coverCount = 0

    if (apply) {
        for (const u of users) {
            if (await Users.byEmail(u.email)) { console.log(`  user ${u.email}: already exists, kept`); continue }
            await Users.create({ id: u._id, email: u.email, name: u.name, passwordHash: u.passwordHash, role: u.role || 'owner', tokenVersion: u.tokenVersion || 0, createdAt: isoOrUndef(u.createdAt) })
            console.log(`  user ${u.email}: imported (same password)`)
        }
        for (const a of authors) await Authors.create({ id: a._id, firstName: a.firstName || '-', lastName: a.lastName || '-', owner: a.owner })
        for (const s of series) {
            const authorId = s.author?.id && authorIds.has(s.author.id) ? s.author.id : null
            await Series.create({ id: s._id, title: s.title, authorId, owner: s.owner })
        }
        if (settings[0]?.readingGoal) await Settings.setReadingGoal(settings[0].readingGoal)
    }

    for (const b of books) {
        let cover = typeof b.coverImagePath === 'string' && b.coverImagePath.startsWith('data:image/') ? b.coverImagePath : undefined
        if (!cover && Buffer.isBuffer(b.coverImage) && b.coverImage.length) {
            cover = `data:${b.coverImageType || 'image/jpeg'};base64,${b.coverImage.toString('base64')}`
        }
        if (cover) coverCount += 1
        console.log(`  book  ${b.title}${b.author?.lastName ? ` — ${b.author.firstName} ${b.author.lastName}` : ''}${cover ? ' [cover]' : ''}`)
        if (!apply) continue

        const stored = cover ? await covers.storeDataUrl(cover, b._id) : undefined
        await Books.insert({
            _id: b._id,
            title: b.title,
            description: b.description || undefined,
            publishDate: isoOrUndef(b.publishDate),
            pageCount: b.pageCount ?? undefined,
            createdAt: isoOrUndef(b.createdAt) || new Date().toISOString(),
            updatedAt: isoOrUndef(b.updatedAt) || isoOrUndef(b.createdAt) || new Date().toISOString(),
            author: b.author?.id && authorIds.has(b.author.id) ? { id: b.author.id } : undefined,
            series: b.series?.id && seriesIds.has(b.series.id) ? { id: b.series.id, volume: b.series.volume ?? undefined } : undefined,
            format: b.format || [],
            genres: b.genres || [],
            shelves: b.shelves || [],
            publisher: b.publisher || undefined,
            isbn: b.isbn ? String(b.isbn) : undefined,
            coverImagePath: stored,
            readingStatus: b.readingStatus || undefined,
            startedAt: isoOrUndef(b.startedAt),
            finishedAt: isoOrUndef(b.finishedAt),
            currentPage: b.currentPage ?? undefined,
            rating: b.rating ?? undefined,
            notes: b.notes || undefined,
            owned: b.owned !== false,
            loanedTo: b.loanedTo || undefined,
            loanedAt: isoOrUndef(b.loanedAt),
            owner: b.owner || undefined,
        })
    }

    console.log(`\n${books.length} book(s), ${coverCount} cover(s)${apply ? ' imported.' : '. Preview only; re-run with --apply.'}`)
    db.close()
}

main().catch((err) => {
    console.error('Import failed:', err.message)
    process.exit(1)
})
