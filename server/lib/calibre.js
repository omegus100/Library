// Reads a Calibre library (the folder that holds metadata.db). Strictly read-only: the database is
// opened with readOnly and nothing in the folder is ever written. Calibre-Web uses the same folder.
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

const DEFAULT_PATH = '/calibre' // where docker-compose mounts the library (read-only)

class CalibreError extends Error {
    constructor(message, status = 400) { super(message); this.status = status }
}

// node:sqlite is built into Node 22 but prints an "experimental" warning on first load; keep the log clean.
// Loaded lazily so the hosted version (no Calibre) never touches it.
let DatabaseSync
function sqlite() {
    if (!DatabaseSync) {
        const emit = process.emitWarning
        process.emitWarning = (warning, ...rest) => (/SQLite/i.test(String(warning)) ? undefined : emit.call(process, warning, ...rest))
        try { ({ DatabaseSync } = require('node:sqlite')) } finally { process.emitWarning = emit }
    }
    return DatabaseSync
}

function open(folder) {
    const dir = String(folder || '').trim() || DEFAULT_PATH
    const file = path.join(dir, 'metadata.db')
    if (!fs.existsSync(dir)) throw new CalibreError(`The folder ${dir} doesn’t exist inside the container. Check the Calibre library volume in your stack.`)
    if (!fs.existsSync(file)) throw new CalibreError(`No Calibre library in ${dir} (metadata.db is missing). Point it at the folder that contains metadata.db.`)
    try {
        const Database = sqlite()
        return new Database(file, { readOnly: true })
    } catch (err) {
        throw new CalibreError(`Couldn’t open ${file}: ${err.message}`)
    }
}

// Calibre stores 0101-01-01 for "no date"
const date = (v) => {
    if (!v) return undefined
    const d = new Date(String(v).replace(' ', 'T'))
    // stored like the rest of the app: the day at midnight UTC
    return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 1000 ? undefined : `${d.toISOString().slice(0, 10)}T00:00:00.000Z`
}

// Descriptions are HTML; keep plain text with paragraph breaks
function plainText(html) {
    if (!html) return undefined
    const text = String(html)
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/\s*(p|div|li|h\d)\s*>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
        .trim()
    return text || undefined
}

const SQL = `
SELECT b.id, b.uuid, b.title, b.path, b.has_cover, b.series_index, b.pubdate, b.last_modified,
    (SELECT group_concat(name, '|') FROM (SELECT a.name FROM books_authors_link l JOIN authors a ON a.id = l.author WHERE l.book = b.id ORDER BY l.id)) AS authors,
    (SELECT s.name FROM books_series_link l JOIN series s ON s.id = l.series WHERE l.book = b.id LIMIT 1) AS series,
    (SELECT p.name FROM books_publishers_link l JOIN publishers p ON p.id = l.publisher WHERE l.book = b.id LIMIT 1) AS publisher,
    (SELECT val FROM identifiers WHERE book = b.id AND type = 'isbn' LIMIT 1) AS isbn,
    (SELECT group_concat(format, ',') FROM data WHERE book = b.id) AS formats,
    (SELECT text FROM comments WHERE book = b.id) AS comments
FROM books b
ORDER BY b.id`

// Every book in the library as plain objects
function readBooks(folder) {
    const db = open(folder)
    try {
        return db.prepare(SQL).all().map((r) => ({
            calibreId: Number(r.id),
            uuid: r.uuid || undefined,
            title: String(r.title || '').trim(),
            authors: r.authors ? String(r.authors).split('|').map((a) => a.trim()).filter(Boolean) : [],
            series: r.series || undefined,
            seriesIndex: r.series ? Number(r.series_index) || undefined : undefined,
            publisher: r.publisher || undefined,
            isbn: r.isbn ? String(r.isbn).replace(/[^0-9Xx]/g, '').toUpperCase() || undefined : undefined,
            formats: r.formats ? [...new Set(String(r.formats).split(',').map((f) => f.trim().toUpperCase()).filter(Boolean))] : [],
            hasCover: Number(r.has_cover) === 1,
            publishDate: date(r.pubdate),
            lastModified: r.last_modified || undefined,
            description: plainText(r.comments),
            path: r.path,
        }))
    } catch (err) {
        throw new CalibreError(`Couldn’t read the Calibre library: ${err.message}`)
    } finally {
        db.close()
    }
}

// Quick check for Settings → "Test": how many books are there?
function test(folder) {
    const db = open(folder)
    try {
        const { n } = db.prepare('SELECT COUNT(*) AS n FROM books').get()
        return { books: Number(n) }
    } catch (err) {
        throw new CalibreError(`That metadata.db couldn’t be read: ${err.message}`)
    } finally {
        db.close()
    }
}

// The cover.jpg next to a book's files, or null. Never reads outside the library folder.
async function readCover(folder, bookPath) {
    const root = path.resolve(String(folder || '').trim() || DEFAULT_PATH)
    const file = path.resolve(root, String(bookPath || ''), 'cover.jpg')
    if (!file.startsWith(root + path.sep)) return null
    try {
        return { buffer: await fsp.readFile(file), contentType: 'image/jpeg' }
    } catch {
        return null
    }
}

module.exports = { DEFAULT_PATH, CalibreError, readBooks, test, readCover }
