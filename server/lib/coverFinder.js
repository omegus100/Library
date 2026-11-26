// Finds a cover for a book that has none. Sources, in order:
//   1. Calibre: the cover.jpg of the linked ebook (local, when the Calibre integration is on)
//   2. Open Library by ISBN, then by title + author (free, no key)
//   3. Google Books (often rate-limited without GOOGLE_BOOKS_API_KEY; skipped once it refuses)
// Only the ISBN, title and author are sent to Open Library / Google.
const axios = require('axios')
const { all, get } = require('../db')
const Books = require('../db/books')
const covers = require('./covers')
const google = require('./google')
const calibre = require('./calibre')
const { mainKey, surname, isbn13 } = require('./match')

const UA = 'LibraryApp/1.0 (self-hosted book catalog)'
const OL_SEARCH = 'https://openlibrary.org/search.json'
const isOpenLibraryHost = (h) => h === 'covers.openlibrary.org' || h === 'archive.org' || h.endsWith('.archive.org')
const MIN_BYTES = 2000 // smaller "images" are blank placeholders

async function download(url, allowed) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
        maxRedirects: 5,
        headers: { 'User-Agent': UA },
        beforeRedirect: (options) => { if (!allowed(options.hostname)) throw new Error(`Redirect to ${options.hostname} not allowed`) },
    })
    const contentType = String(res.headers['content-type'] || '').split(';')[0]
    const buffer = Buffer.from(res.data)
    if (!contentType.startsWith('image/') || buffer.length < MIN_BYTES) return null
    return { buffer, contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType }
}

// ---------- Open Library ----------

async function olSearch(params) {
    const { data } = await axios.get(OL_SEARCH, {
        params: { ...params, fields: 'title,author_name,cover_i', limit: 10 },
        timeout: 15000,
        headers: { 'User-Agent': UA },
    })
    return data.docs || []
}

async function openLibrary(book) {
    const author = [book.author?.firstName, book.author?.lastName].filter((x) => x && x !== '-').join(' ')
    const who = surname(book.author?.lastName)
    const want = mainKey(book.title)
    const sameBook = (d) => mainKey(d.title) === want && (!who || (d.author_name || []).some((a) => surname(a) === who))

    let doc = null
    const isbn = isbn13(book.isbn)
    if (isbn) doc = (await olSearch({ isbn })).find((d) => d.cover_i)
    // Search by the main title only: long subtitles make Open Library miss ("Atomic Habits: An Easy & Proven Way…")
    const mainTitle = String(book.title).split(/[:([]/)[0].trim()
    if (!doc && want) doc = (await olSearch({ title: mainTitle, ...(author ? { author } : {}) })).find((d) => d.cover_i && sameBook(d))
    if (!doc) return null
    return download(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`, isOpenLibraryHost)
}

// ---------- Google Books ----------

async function googleBooks(book) {
    let results = book.isbn ? await google.byIsbn(book.isbn) : []
    if (!results.length) {
        const who = [book.author?.firstName, book.author?.lastName].filter((x) => x && x !== '-').join(' ')
        results = await google.search(`intitle:"${book.title}"${who ? ` inauthor:"${who}"` : ''}`)
    }
    const want = mainKey(book.title)
    const hit = results.find((r) => r.coverUrl && mainKey(r.title) === want) || (book.isbn ? results.find((r) => r.coverUrl) : null)
    return hit ? google.fetchCover(hit.coverUrl) : null
}

// ---------- Calibre ----------

async function fromCalibre(bookId) {
    const row = await get('SELECT calibre_id FROM calibre_books WHERE book_id = ? AND has_cover = 1 AND missing = 0 LIMIT 1', [bookId])
    if (!row) return null
    const cfg = (await require('../db/repos').settings.integrations()).calibre
    if (!cfg?.enabled) return null
    try { return await calibre.readCoverById(cfg.path, Number(row.calibre_id)) } catch { return null }
}

// ---------- finding ----------

// -> { image, source } or null. state.googleBlocked is set when Google refuses, so later books skip it.
async function find(book, state = {}) {
    const calibreImage = await fromCalibre(book._id)
    if (calibreImage) return { image: calibreImage, source: 'Calibre' }
    try {
        const image = await openLibrary(book)
        if (image) return { image, source: 'Open Library' }
    } catch { /* Open Library down or slow: try the next source */ }
    if (!state.googleBlocked) {
        try {
            const image = await googleBooks(book)
            if (image) return { image, source: 'Google Books' }
        } catch (err) {
            if (err instanceof google.LookupError && err.status === 429) state.googleBlocked = true
        }
    }
    return null
}

// Find and save a cover for one book (no-op if it already has one) -> source name or null
async function fill(bookId, state = {}) {
    const book = await Books.byId(bookId, { cover: true })
    if (!book || book.coverImagePath) return null
    const found = await find(book, state)
    if (!found) return null
    book.coverImagePath = await covers.store(found.image, book._id)
    await Books.save(book)
    return found.source
}

const missingCount = async () => Number((await get(`SELECT COUNT(*) n FROM books WHERE cover IS NULL OR cover = ''`)).n)

// A batch of books without covers, after `after` (an id), in id order
const missingBatch = (after, limit) =>
    all(`SELECT id, title FROM books WHERE (cover IS NULL OR cover = '') AND id > ? ORDER BY id LIMIT ?`, [after || '', limit])

module.exports = { find, fill, missingCount, missingBatch }
