const express = require('express')
const Books = require('../db/books')
const { authors: Authors, series: Series } = require('../db/repos')
const covers = require('../lib/covers')
const google = require('../lib/google')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const READING_STATUSES = ['Want To Read', 'Currently Reading', 'Read', 'Did Not Finish']
const PRIVATE_FIELDS = ['notes', 'loanedTo', 'loanedAt']
const normIsbn = (v) => String(v || '').replace(/[\s-]/g, '').toUpperCase()

// ---------- shaping responses ----------

function coverUrlFor(book) {
    if (!book.hasCover && !book.coverImagePath) return ''
    const v = new Date(book.updatedAt || book.createdAt || 0).getTime()
    return `/api/books/${book._id}/cover?v=${v}`
}

// Never send the cover bytes in JSON; hide private fields from visitors
function present(book, req) {
    const out = { ...book, coverUrl: coverUrlFor(book) }
    delete out.coverImagePath
    delete out.hasCover
    delete out.owner
    if (!req.user) PRIVATE_FIELDS.forEach((f) => delete out[f])
    return out
}

// Full book for the book page: plus Calibre ebook info when linked
async function withEbook(book, req) {
    const ebook = await require('../lib/calibreSync').ebookFor(book._id)
    return { ...present(book, req), ...(ebook ? { ebook } : {}) }
}

// ---------- sorting ----------

const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true })
const titleKey = (t) => String(t || '').replace(/^(the|a|an)\s+/i, '')
const time = (d) => { const t = d ? new Date(d).getTime() : NaN; return Number.isNaN(t) ? null : t }
const byTitle = (a, b) => compareText(titleKey(a.title), titleKey(b.title))
const newestFirst = (field) => (a, b) => {
    const ta = time(a[field]); const tb = time(b[field])
    if (ta === tb) return byTitle(a, b)
    if (ta === null) return 1
    if (tb === null) return -1
    return tb - ta
}
const SORTS = {
    title: byTitle,
    author: (a, b) => compareText(a.author?.lastName, b.author?.lastName) || compareText(a.author?.firstName, b.author?.firstName) || byTitle(a, b),
    series: (a, b) => {
        const sa = a.series?.title; const sb = b.series?.title
        if (!sa !== !sb) return sa ? -1 : 1
        return compareText(sa, sb) || (a.series?.volume || 0) - (b.series?.volume || 0) || byTitle(a, b)
    },
    recent: newestFirst('createdAt'),
    published: newestFirst('publishDate'),
    finished: newestFirst('finishedAt'),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || byTitle(a, b),
}

// ---------- reading input ----------

const toStr = (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim())
const toNum = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v))
const toDate = (v) => {
    if (!v) return undefined
    const s = String(v)
    const d = /^\d{4}$/.test(s) ? new Date(`${s}-01-01T00:00:00Z`) : /^\d{4}-\d{2}$/.test(s) ? new Date(`${s}-01T00:00:00Z`) : new Date(s)
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}
const toList = (v) => {
    if (v === undefined || v === null || v === '') return []
    const arr = Array.isArray(v) ? v : String(v).split(',')
    return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))]
}
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key)
const badRequest = (message) => Object.assign(new Error(message), { status: 400 })

// Apply only the fields present in the request body (partial update) to a plain book object
async function applyFields(book, body) {
    for (const key of ['title', 'description', 'publisher', 'notes', 'loanedTo']) {
        if (has(body, key)) book[key] = toStr(body[key])
    }
    if (has(body, 'isbn')) book.isbn = toStr(body.isbn) ? normIsbn(body.isbn) : undefined
    for (const key of ['pageCount', 'currentPage', 'rating']) {
        if (has(body, key)) book[key] = toNum(body[key])
    }
    if (book.rating !== undefined && (book.rating < 0 || book.rating > 5)) throw badRequest('Rating must be 0–5')
    for (const key of ['publishDate', 'startedAt', 'finishedAt', 'loanedAt']) {
        if (has(body, key)) book[key] = toDate(body[key])
    }
    for (const key of ['format', 'genres', 'shelves']) {
        if (has(body, key)) book[key] = toList(body[key])
    }
    if (has(body, 'owned')) book.owned = !(body.owned === false || body.owned === 'false')

    // Author / series by id (names come from the database), or author by plain name
    if (has(body, 'authorId')) {
        const author = body.authorId ? await Authors.byId(body.authorId) : null
        book.author = author ? { id: author._id } : undefined
    } else if (toStr(body.authorName)) {
        const author = await Authors.findOrCreateByName(body.authorName, book.owner)
        book.author = author ? { id: author._id } : undefined
    }
    if (has(body, 'seriesId')) {
        const series = body.seriesId ? await Series.byId(body.seriesId) : null
        book.series = series ? { id: series._id, volume: toNum(body.seriesVolume) } : undefined
    } else if (has(body, 'seriesVolume') && book.series?.id) {
        book.series = { ...book.series, volume: toNum(body.seriesVolume) }
    }

    // Reading status, with sensible automatic dates
    if (has(body, 'readingStatus')) {
        const status = toStr(body.readingStatus)
        if (status && !READING_STATUSES.includes(status)) throw badRequest('Unknown reading status')
        const changed = status !== book.readingStatus
        book.readingStatus = status
        if (changed && status === 'Currently Reading' && !book.startedAt && !has(body, 'startedAt')) book.startedAt = new Date().toISOString()
        if (changed && status === 'Read') {
            if (!book.finishedAt && !has(body, 'finishedAt')) book.finishedAt = new Date().toISOString()
            if (book.pageCount && !has(body, 'currentPage')) book.currentPage = book.pageCount
        }
    }
    if (book.pageCount && book.currentPage > book.pageCount) book.currentPage = book.pageCount
    if (book.currentPage !== undefined && book.currentPage < 0) book.currentPage = 0

    // Loans: date follows the name
    if (has(body, 'loanedTo')) {
        if (book.loanedTo && !book.loanedAt && !has(body, 'loanedAt')) book.loanedAt = new Date().toISOString()
        if (!book.loanedTo) book.loanedAt = undefined
    }
    if (!toStr(book.title)) throw badRequest('Title is required')
}

// Cover from the request: data URL (upload), Google URL (fetched here), or removal
async function applyCover(book, body) {
    const dataUrl = covers.isDataUrl(body.coverImage) ? body.coverImage
        : covers.isDataUrl(body.coverImagePath) ? body.coverImagePath : null
    const remoteUrl = typeof body.coverUrl === 'string' && google.isCoverUrl(body.coverUrl) ? body.coverUrl : null

    let next
    if (dataUrl) next = await covers.storeDataUrl(dataUrl, book._id)
    else if (remoteUrl) {
        try { next = await covers.store(await google.fetchCover(remoteUrl), book._id) } catch (err) {
            console.warn('Cover download failed:', err.message) // the book is still saved, just without a cover
        }
    } else if (body.removeCover === true || body.removeCover === 'true') next = ''

    if (next !== undefined) {
        const old = book.coverImagePath
        book.coverImagePath = next || undefined
        if (old && old !== next) await covers.remove(old)
    }
}

const sendError = (res, err, fallback) => {
    if (err.status === 400) return res.status(400).json({ message: err.message })
    console.error(fallback, err)
    res.status(500).json({ message: fallback })
}

// ---------- routes ----------

// GET /api/books?view=list -> { items, total, page, pages } (light items: no cover bytes, no description)
//   search q, filters (status, format, genre, shelf, owned, loaned, authorId, seriesId), sort, page, limit
// GET /api/books (no view) -> the same light items as a plain array
router.get('/', async (req, res) => {
    try {
        const books = await Books.list(req.query, { signedIn: Boolean(req.user) })
        books.sort(SORTS[req.query.sort] || SORTS.title)
        if (req.query.view !== 'list') return res.json(books.map((b) => present(b, req)))
        const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 500)
        const page = Math.max(Number(req.query.page) || 1, 1)
        const items = books.slice((page - 1) * limit, page * limit).map((b) => present(b, req))
        res.json({ items, total: books.length, page, pages: Math.max(Math.ceil(books.length / limit), 1) })
    } catch (err) {
        sendError(res, err, 'Failed to list books')
    }
})

// GET /api/books/facets -> values and counts for the filter menus
router.get('/facets', async (req, res) => {
    try {
        const f = await Books.facets()
        if (!req.user) delete f.loaned
        res.json(f)
    } catch (err) {
        sendError(res, err, 'Failed to load filters')
    }
})

router.get('/summary', async (req, res) => {
    try { res.json(await Books.summary()) } catch (err) { sendError(res, err, 'Failed to list books') }
})

router.get('/counts', async (req, res) => {
    try { res.json(await Books.counts()) } catch (err) { sendError(res, err, 'Failed to count books') }
})

// GET /api/books/lookup?isbn=&title= -> possible duplicates
router.get('/lookup', async (req, res) => {
    try {
        res.json(await Books.duplicates({
            isbn: normIsbn(req.query.isbn) || undefined,
            title: typeof req.query.title === 'string' ? req.query.title.trim() || undefined : undefined,
        }))
    } catch (err) {
        sendError(res, err, 'Failed to look up books')
    }
})

// POST /api/books (owner)
router.post('/', requireOwner, async (req, res) => {
    try {
        const book = { _id: require('../db').newId(), owner: req.user.id, owned: true, format: [], genres: [], shelves: [] }
        await applyFields(book, req.body || {})
        await applyCover(book, req.body || {})
        const id = await Books.insert(book)
        res.status(201).json(present(await Books.byId(id), req))
    } catch (err) {
        sendError(res, err, 'Failed to create book')
    }
})

// GET /api/books/:id
router.get('/:id', async (req, res) => {
    try {
        const book = await Books.byId(req.params.id)
        if (!book) return res.status(404).json({ message: 'Book not found' })
        res.json(await withEbook(book, req))
    } catch (err) {
        sendError(res, err, 'Failed to fetch book')
    }
})

// GET /api/books/:id/cover -> the cover image (cached by the browser)
router.get('/:id/cover', async (req, res) => {
    try {
        const row = await Books.coverOf(req.params.id)
        const image = row && (await covers.read(row.cover))
        if (!image) return res.status(404).end()
        const etag = `"${new Date(row.updated_at || 0).getTime()}-${image.buffer.length}"`
        res.set('ETag', etag)
        res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
        if (req.get('if-none-match') === etag) return res.status(304).end()
        res.type(image.contentType).send(image.buffer)
    } catch {
        res.status(404).end()
    }
})

// PUT or PATCH /api/books/:id (owner): only the fields sent change
const update = async (req, res) => {
    try {
        const book = await Books.byId(req.params.id, { cover: true })
        if (!book) return res.status(404).json({ message: 'Book not found' })
        await applyFields(book, req.body || {})
        await applyCover(book, req.body || {})
        if (!book.owner) book.owner = req.user.id
        await Books.save(book)
        res.json(await withEbook(await Books.byId(book._id), req))
    } catch (err) {
        sendError(res, err, 'Failed to update book')
    }
}
router.put('/:id', requireOwner, update)
router.patch('/:id', requireOwner, update)

// POST /api/books/:id/refresh (owner): fill EMPTY fields (and a missing cover) from Google Books
router.post('/:id/refresh', requireOwner, async (req, res) => {
    try {
        const book = await Books.byId(req.params.id, { cover: true })
        if (!book) return res.status(404).json({ message: 'Book not found' })

        // Details from Google Books (may be rate-limited: then only the cover search below runs)
        let match = null
        let googleError = null
        try {
            let results = book.isbn ? await google.byIsbn(book.isbn) : []
            if (!results.length) {
                const who = [book.author?.firstName, book.author?.lastName].filter((x) => x && x !== '-').join(' ')
                results = await google.search(`intitle:"${book.title}"${who ? ` inauthor:"${who}"` : ''}`)
            }
            match = results[0] || null
        } catch (err) {
            if (!(err instanceof google.LookupError)) throw err
            googleError = err
        }

        const filled = []
        const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
        const fill = (field, value, transform = (x) => x) => {
            if (isEmpty(book[field]) && !isEmpty(value)) { book[field] = transform(value); filled.push(field) }
        }
        if (match) {
            fill('description', match.description)
            fill('publisher', match.publisher)
            fill('pageCount', match.pageCount)
            fill('isbn', match.isbn, normIsbn)
            fill('publishDate', match.publishDate, toDate)
            fill('genres', match.genres)
            if (!book.coverImagePath && match.coverUrl) {
                try { book.coverImagePath = await covers.store(await google.fetchCover(match.coverUrl), book._id); filled.push('cover') } catch { /* try the other sources */ }
            }
        }
        // No cover yet: Calibre, then Open Library (Google was already tried above)
        if (!book.coverImagePath) {
            const found = await require('../lib/coverFinder').find(book, { googleBlocked: true })
            if (found) { book.coverImagePath = await covers.store(found.image, book._id); filled.push('cover') }
        }
        if (!filled.length && googleError) return res.status(googleError.status).json({ message: googleError.message })
        if (!filled.length && !match) return res.status(404).json({ message: 'No match found on Google Books or Open Library.' })
        if (filled.length) await Books.save(book)
        res.json({ book: await withEbook(await Books.byId(book._id), req), filled })
    } catch (err) {
        if (err instanceof google.LookupError) return res.status(err.status).json({ message: err.message })
        sendError(res, err, 'Failed to refresh details')
    }
})

// DELETE /api/books/:id (owner)
router.delete('/:id', requireOwner, async (req, res) => {
    try {
        const book = await Books.byId(req.params.id, { cover: true })
        if (!book) return res.status(404).json({ message: 'Book not found' })
        await Books.remove(book._id)
        await covers.remove(book.coverImagePath)
        res.json({ message: 'Book deleted', id: req.params.id })
    } catch (err) {
        sendError(res, err, 'Failed to delete book')
    }
})

module.exports = router
module.exports.helpers = { applyFields, toDate, toList, normIsbn, READING_STATUSES, SORTS, present }
