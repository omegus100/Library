const express = require('express')
const mongoose = require('mongoose')
const Book = require('../models/book')
const Author = require('../models/author')
const Series = require('../models/series')
const covers = require('../lib/covers')
const google = require('../lib/google')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normIsbn = (v) => String(v || '').replace(/[\s-]/g, '').toUpperCase()
const PRIVATE_FIELDS = ['notes', 'loanedTo', 'loanedAt']

// ---------- shaping responses ----------

function coverUrlFor(book) {
    if (!book.hasCover && !book.coverImagePath) return ''
    const v = new Date(book.updatedAt || book.createdAt || 0).getTime()
    return `/api/books/${book._id}/cover?v=${v}`
}

// Never send the cover bytes in JSON; hide private fields from visitors
function present(doc, req) {
    const book = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
    book.coverUrl = coverUrlFor(book)
    delete book.coverImagePath
    delete book.hasCover
    if (!req.user) PRIVATE_FIELDS.forEach((f) => delete book[f])
    return book
}

// ---------- sorting (same rules as the client used) ----------

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

const LIST_FIELDS = '-coverImagePath -description'

function buildFilter(q, req) {
    const filter = {}
    const and = []
    if (q.q) {
        const rx = { $regex: escapeRegex(String(q.q).trim()), $options: 'i' }
        const ors = [{ title: rx }, { 'author.firstName': rx }, { 'author.lastName': rx }, { 'series.title': rx }, { publisher: rx }]
        const isbn = normIsbn(q.q)
        if (/^[0-9X]{3,}$/.test(isbn)) ors.push({ isbn: { $regex: escapeRegex(isbn) } })
        // "brandon sanderson": match first + last name together
        const words = String(q.q).trim().split(/\s+/)
        if (words.length > 1) {
            ors.push({ $and: [
                { 'author.firstName': { $regex: escapeRegex(words.slice(0, -1).join(' ')), $options: 'i' } },
                { 'author.lastName': { $regex: escapeRegex(words[words.length - 1]), $options: 'i' } },
            ] })
        }
        and.push({ $or: ors })
    }
    if (q.status) filter.readingStatus = q.status === 'none' ? { $in: [null, ''] } : q.status
    if (q.format) filter.format = { $regex: `^${escapeRegex(q.format)}$`, $options: 'i' }
    if (q.genre) filter.genres = { $regex: `^${escapeRegex(q.genre)}$`, $options: 'i' }
    if (q.shelf) filter.shelves = { $regex: `^${escapeRegex(q.shelf)}$`, $options: 'i' }
    // Aggregations don't cast strings to ObjectIds, so do it here (bad ids match nothing)
    const oid = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : null)
    if (q.authorId) filter['author.id'] = oid(q.authorId)
    if (q.seriesId) filter['series.id'] = oid(q.seriesId)
    if (q.owned === 'true') and.push({ owned: { $ne: false } })
    if (q.owned === 'false') filter.owned = false
    if (q.loaned === 'true' && req.user) filter.loanedTo = { $nin: [null, ''] }
    if (and.length) filter.$and = and
    return filter
}

const toStr = (v) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim())
const toNum = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v))
const toDate = (v) => {
    if (!v) return undefined
    const s = String(v)
    const d = /^\d{4}$/.test(s) ? new Date(`${s}-01-01T00:00:00Z`) : /^\d{4}-\d{2}$/.test(s) ? new Date(`${s}-01T00:00:00Z`) : new Date(s)
    return Number.isNaN(d.getTime()) ? undefined : d
}
const toList = (v) => {
    if (v === undefined || v === null || v === '') return []
    const arr = Array.isArray(v) ? v : String(v).split(',')
    return [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))]
}
const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key)

// Apply only the fields present in the request body (partial update)
async function applyFields(book, body) {
    for (const key of ['title', 'description', 'publisher', 'isbn', 'notes', 'loanedTo']) {
        if (has(body, key)) book[key] = toStr(body[key])
    }
    for (const key of ['pageCount', 'currentPage', 'rating']) {
        if (has(body, key)) book[key] = toNum(body[key])
    }
    for (const key of ['publishDate', 'startedAt', 'finishedAt', 'loanedAt']) {
        if (has(body, key)) book[key] = toDate(body[key])
    }
    for (const key of ['format', 'genres', 'shelves']) {
        if (has(body, key)) book[key] = toList(body[key])
    }
    if (has(body, 'owned')) book.owned = !(body.owned === false || body.owned === 'false')

    // Author / series: look the names up on the server from the IDs
    if (has(body, 'authorId')) {
        const author = body.authorId ? await Author.findById(body.authorId).lean() : null
        book.author = author ? { id: author._id, firstName: author.firstName, lastName: author.lastName } : undefined
    } else if (toStr(body.authorName)) {
        // Plain name (Add from Google Books, import): reuse a matching author or create one
        const parts = toStr(body.authorName).split(/\s+/)
        const lastName = parts.pop()
        const firstName = parts.join(' ') || '-'
        const key = (s) => String(s || '').trim().replace(/\./g, '').replace(/\s+/g, ' ').toLowerCase()
        const candidates = await Author.find({ lastName: { $regex: `^${escapeRegex(lastName)}$`, $options: 'i' } }).lean()
        let author = candidates.find((a) => key(a.firstName) === key(firstName))
        if (!author) author = (await Author.create({ firstName, lastName, owner: book.owner })).toObject()
        book.author = { id: author._id, firstName: author.firstName, lastName: author.lastName }
    }
    if (has(body, 'seriesId')) {
        const series = body.seriesId ? await Series.findById(body.seriesId).lean() : null
        book.series = series ? { id: series._id, title: series.title, volume: toNum(body.seriesVolume) } : undefined
    } else if (has(body, 'seriesVolume') && book.series?.id) {
        book.series = { ...book.series, volume: toNum(body.seriesVolume) }
    }

    // Reading status, with sensible automatic dates
    if (has(body, 'readingStatus')) {
        const status = toStr(body.readingStatus)
        if (status && !Book.READING_STATUSES.includes(status)) throw Object.assign(new Error('Unknown reading status'), { status: 400 })
        const changed = status !== book.readingStatus
        book.readingStatus = status
        if (changed && status === 'Currently Reading' && !book.startedAt && !has(body, 'startedAt')) book.startedAt = new Date()
        if (changed && status === 'Read') {
            if (!book.finishedAt && !has(body, 'finishedAt')) book.finishedAt = new Date()
            if (book.pageCount && !has(body, 'currentPage')) book.currentPage = book.pageCount
        }
    }
    if (book.pageCount && book.currentPage > book.pageCount) book.currentPage = book.pageCount

    // Loans: date follows the name
    if (has(body, 'loanedTo')) {
        if (book.loanedTo && !book.loanedAt && !has(body, 'loanedAt')) book.loanedAt = new Date()
        if (!book.loanedTo) book.loanedAt = undefined
    }
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
    if (err.name === 'ValidationError' || err.name === 'CastError' || err.status === 400) {
        return res.status(400).json({ message: err.message })
    }
    console.error(fallback, err)
    res.status(500).json({ message: fallback })
}

// ---------- routes ----------

// GET /api/books
//   ?view=list  -> { items, total, page, pages } light items (no cover bytes / description),
//                  with search (q), filters (status, format, genre, shelf, owned, loaned, authorId, seriesId),
//                  sort (title|author|series|recent|published|finished|rating), page, limit
//   (no view)   -> legacy: full array including covers (kept for older clients)
router.get('/', async (req, res) => {
    try {
        if (req.query.view !== 'list') {
            const books = await Book.find({}).lean()
            return res.json(books.map((b) => {
                const out = { ...b }
                if (!req.user) PRIVATE_FIELDS.forEach((f) => delete out[f])
                return out
            }))
        }
        const filter = buildFilter(req.query, req)
        const docs = await Book.aggregate([
            { $match: filter },
            { $addFields: { hasCover: { $gt: [{ $strLenCP: { $ifNull: ['$coverImagePath', ''] } }, 0] } } },
            { $project: { coverImagePath: 0, description: 0 } },
        ])
        docs.sort(SORTS[req.query.sort] || SORTS.title)
        const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 500)
        const page = Math.max(Number(req.query.page) || 1, 1)
        const items = docs.slice((page - 1) * limit, page * limit).map((d) => present(d, req))
        res.json({ items, total: docs.length, page, pages: Math.max(Math.ceil(docs.length / limit), 1) })
    } catch (err) {
        sendError(res, err, 'Failed to list books')
    }
})

// GET /api/books/facets -> values and counts for the filter menus
router.get('/facets', async (req, res) => {
    try {
        const count = (field) => Book.aggregate([
            { $unwind: `$${field}` },
            { $match: { [field]: { $nin: [null, ''] } } },
            { $group: { _id: { $toLower: `$${field}` }, label: { $first: `$${field}` }, n: { $sum: 1 } } },
            { $sort: { label: 1 } },
        ])
        const [formats, genres, shelves, statuses, wishlist, loaned, total] = await Promise.all([
            count('format'), count('genres'), count('shelves'),
            Book.aggregate([{ $group: { _id: '$readingStatus', n: { $sum: 1 } } }]),
            Book.countDocuments({ owned: false }),
            Book.countDocuments({ loanedTo: { $nin: [null, ''] } }),
            Book.estimatedDocumentCount(),
        ])
        const tidy = (rows) => rows.map((r) => ({ value: r.label, count: r.n }))
        res.json({
            total,
            formats: tidy(formats),
            genres: tidy(genres),
            shelves: tidy(shelves),
            statuses: Object.fromEntries(statuses.map((s) => [s._id || 'none', s.n])),
            wishlist,
            loaned: req.user ? loaned : undefined,
        })
    } catch (err) {
        sendError(res, err, 'Failed to load filters')
    }
})

// GET /api/books/summary -> [{ _id, title, isbn, author, owned }] for "already in your library" checks
router.get('/summary', async (req, res) => {
    try {
        res.json(await Book.find({}, { title: 1, isbn: 1, author: 1, owned: 1 }).lean())
    } catch (err) {
        sendError(res, err, 'Failed to list books')
    }
})

// GET /api/books/counts -> { byAuthor: { id: n }, bySeries: { id: n } }
router.get('/counts', async (req, res) => {
    try {
        const [byAuthor, bySeries] = await Promise.all([
            Book.aggregate([{ $match: { 'author.id': { $ne: null } } }, { $group: { _id: '$author.id', n: { $sum: 1 } } }]),
            Book.aggregate([{ $match: { 'series.id': { $ne: null } } }, { $group: { _id: '$series.id', n: { $sum: 1 } } }]),
        ])
        const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.n]))
        res.json({ byAuthor: toMap(byAuthor), bySeries: toMap(bySeries) })
    } catch (err) {
        sendError(res, err, 'Failed to count books')
    }
})

// GET /api/books/lookup?isbn=&title= -> possible duplicates (light records)
router.get('/lookup', async (req, res) => {
    const isbn = normIsbn(req.query.isbn)
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : ''
    const conditions = []
    if (isbn) conditions.push({ isbn })
    if (title) conditions.push({ title: { $regex: `^${escapeRegex(title)}$`, $options: 'i' } })
    if (!conditions.length) return res.json([])
    try {
        res.json(await Book.find({ $or: conditions }, { title: 1, isbn: 1, author: 1 }).limit(10).lean())
    } catch (err) {
        sendError(res, err, 'Failed to look up books')
    }
})

// POST /api/books (owner)
router.post('/', requireOwner, async (req, res) => {
    try {
        const book = new Book({ owner: req.user.id })
        await applyFields(book, req.body || {})
        await applyCover(book, req.body || {})
        await book.save()
        res.status(201).json(present(book, req))
    } catch (err) {
        sendError(res, err, 'Failed to create book')
    }
})

// GET /api/books/:id
router.get('/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).lean()
        if (!book) return res.status(404).json({ message: 'Book not found' })
        res.json(present(book, req))
    } catch (err) {
        if (err.name === 'CastError') return res.status(404).json({ message: 'Book not found' })
        sendError(res, err, 'Failed to fetch book')
    }
})

// GET /api/books/:id/cover -> the cover image (cached by the browser)
router.get('/:id/cover', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id, { coverImagePath: 1, updatedAt: 1 }).lean()
        const image = book && (await covers.read(book.coverImagePath))
        if (!image) return res.status(404).end()
        const etag = `"${new Date(book.updatedAt || 0).getTime()}-${image.buffer.length}"`
        res.set('ETag', etag)
        res.set('Cache-Control', req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300')
        if (req.get('if-none-match') === etag) return res.status(304).end()
        res.type(image.contentType).send(image.buffer)
    } catch {
        res.status(404).end()
    }
})

// PUT or PATCH /api/books/:id (owner) — partial update: only the fields sent change
const update = async (req, res) => {
    try {
        const book = await Book.findById(req.params.id)
        if (!book) return res.status(404).json({ message: 'Book not found' })
        await applyFields(book, req.body || {})
        await applyCover(book, req.body || {})
        if (!book.owner) book.owner = req.user.id
        await book.save()
        res.json(present(book, req))
    } catch (err) {
        sendError(res, err, 'Failed to update book')
    }
}
router.put('/:id', requireOwner, update)
router.patch('/:id', requireOwner, update)

// POST /api/books/:id/refresh (owner) — fill EMPTY fields (and a missing cover) from Google Books
router.post('/:id/refresh', requireOwner, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id)
        if (!book) return res.status(404).json({ message: 'Book not found' })

        let results = book.isbn ? await google.byIsbn(book.isbn) : []
        if (!results.length) {
            const who = [book.author?.firstName, book.author?.lastName].filter(Boolean).join(' ')
            results = await google.search(`intitle:"${book.title}"${who ? ` inauthor:"${who}"` : ''}`)
        }
        const match = results[0]
        if (!match) return res.status(404).json({ message: 'No match found on Google Books.' })

        const filled = []
        const fill = (field, value) => {
            const empty = book[field] === undefined || book[field] === null || book[field] === '' || (Array.isArray(book[field]) && !book[field].length)
            if (empty && value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)) { filled.push(field) ; return true }
            return false
        }
        if (fill('description', match.description)) book.description = match.description
        if (fill('publisher', match.publisher)) book.publisher = match.publisher
        if (fill('pageCount', match.pageCount)) book.pageCount = match.pageCount
        if (fill('isbn', match.isbn)) book.isbn = match.isbn
        if (fill('publishDate', match.publishDate)) book.publishDate = toDate(match.publishDate)
        if (fill('genres', match.genres)) book.genres = match.genres
        if (!book.coverImagePath && match.coverUrl) {
            try { book.coverImagePath = await covers.store(await google.fetchCover(match.coverUrl), book._id); filled.push('cover') } catch { /* skip */ }
        }
        await book.save()
        res.json({ book: present(book, req), filled })
    } catch (err) {
        if (err instanceof google.LookupError) return res.status(err.status).json({ message: err.message })
        sendError(res, err, 'Failed to refresh details')
    }
})

// DELETE /api/books/:id (owner)
router.delete('/:id', requireOwner, async (req, res) => {
    try {
        const book = await Book.findByIdAndDelete(req.params.id)
        if (!book) return res.status(404).json({ message: 'Book not found' })
        await covers.remove(book.coverImagePath)
        res.json({ message: 'Book deleted', id: req.params.id })
    } catch (err) {
        sendError(res, err, 'Failed to delete book')
    }
})

module.exports = router
module.exports.helpers = { applyFields, toDate, toList, SORTS, present }
