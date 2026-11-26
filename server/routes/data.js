const express = require('express')
const Books = require('../db/books')
const { authors: Authors, series: Series } = require('../db/repos')
const csv = require('../lib/csv')
const { requireOwner } = require('../lib/auth')
const { toDate, toList, READING_STATUSES } = require('./books').helpers
const { splitSeries, libraryIndex } = require('../lib/match')

const router = express.Router()

const normIsbn = (v) => String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase()
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

const COLUMNS = ['Title', 'Author', 'Series', 'Series #', 'ISBN', 'Format', 'Genres', 'Publisher', 'Published',
    'Pages', 'Status', 'Started', 'Finished', 'Current Page', 'Rating', 'Shelves', 'Owned', 'Loaned To', 'Notes', 'Added']

// GET /api/export?format=json|csv (owner) -> download of the whole library (covers not included)
router.get('/export', requireOwner, async (req, res) => {
    try {
        const books = await Books.allBooks()
        const stamp = new Date().toISOString().slice(0, 10)
        if (req.query.format === 'csv') {
            const rows = books.map((b) => ({
                Title: b.title,
                Author: [b.author?.firstName, b.author?.lastName].filter((x) => x && x !== '-').join(' '),
                Series: b.series?.title || '',
                'Series #': b.series?.volume ?? '',
                ISBN: b.isbn || '',
                Format: (b.format || []).join('; '),
                Genres: (b.genres || []).join('; '),
                Publisher: b.publisher || '',
                Published: day(b.publishDate),
                Pages: b.pageCount ?? '',
                Status: b.readingStatus || '',
                Started: day(b.startedAt),
                Finished: day(b.finishedAt),
                'Current Page': b.currentPage ?? '',
                Rating: b.rating || '',
                Shelves: (b.shelves || []).join('; '),
                Owned: b.owned === false ? 'no' : 'yes',
                'Loaned To': b.loanedTo || '',
                Notes: b.notes || '',
                Added: day(b.createdAt),
            }))
            res.set('Content-Disposition', `attachment; filename="library-${stamp}.csv"`)
            return res.type('text/csv').send(csv.stringify(rows, COLUMNS))
        }
        res.set('Content-Disposition', `attachment; filename="library-${stamp}.json"`)
        res.json({ exportedAt: new Date().toISOString(), books, authors: await Authors.list(), series: await Series.list() })
    } catch (err) {
        console.error('Export failed:', err)
        res.status(500).json({ message: 'Export failed' })
    }
})

// ---------- Goodreads / CSV import ----------

// Goodreads shelves that mean "I don't have this yet": those books go to the wishlist
const WISHLIST_SHELVES = ['to-read', 'want-to-buy', 'potential-reads']
const STATUS_SHELVES = ['read', 'currently-reading']

// "want-to-buy" -> "Want to buy"
const prettyShelf = (s) => {
    const t = String(s || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

// Goodreads "Binding" -> this app's formats; anything unknown is kept as written
const FORMATS = {
    hardcover: 'Hardback', hardback: 'Hardback', 'library binding': 'Hardback',
    paperback: 'Paperback', 'mass market paperback': 'Paperback', 'trade paperback': 'Paperback',
    'kindle edition': 'eBook', ebook: 'eBook', 'nook': 'eBook', 'kobo ebook': 'eBook',
    audiobook: 'Audiobook', 'audio cd': 'Audiobook', 'audible audio': 'Audiobook', 'mp3 cd': 'Audiobook', 'audio': 'Audiobook',
    'graphic novels': 'Graphic Novel', comics: 'Comic Book', comic: 'Comic Book',
}
const mapFormat = (binding) => {
    const b = String(binding || '').trim()
    return b ? FORMATS[b.toLowerCase()] || b : ''
}

const gdDate = (v) => toDate(String(v || '').replace(/\//g, '-'))

// One CSV row (Goodreads export, or this app's own CSV export) -> book fields + import hints
function mapRow(r) {
    const goodreads = 'Exclusive Shelf' in r || 'My Rating' in r
    if (goodreads) {
        const exclusive = String(r['Exclusive Shelf'] || '').trim().toLowerCase()
        const rating = Number(r['My Rating']) || undefined
        const { title, series, volume } = splitSeries(r.Title)
        // A rating means it was read. Without one, only "currently-reading" sets a status (and to-read on the wishlist).
        const readingStatus = rating ? 'Read'
            : exclusive === 'currently-reading' ? 'Currently Reading'
            : exclusive === 'to-read' ? 'Want To Read' : ''
        const wishlist = !rating && WISHLIST_SHELVES.includes(exclusive)
        const shelfNames = [...toList(r.Bookshelves), exclusive].map((s) => s.toLowerCase()).filter((s) => s && !STATUS_SHELVES.includes(s))
        return {
            title,
            author: String(r.Author || '').replace(/\s+/g, ' ').trim(),
            series,
            seriesVolume: volume,
            isbn: normIsbn(r.ISBN13) || normIsbn(r.ISBN),
            publisher: r.Publisher,
            pageCount: Number(r['Number of Pages']) || undefined,
            publishDate: toDate(r['Original Publication Year'] || r['Year Published']),
            format: mapFormat(r.Binding) ? [mapFormat(r.Binding)] : [],
            readingStatus,
            rating,
            finishedAt: readingStatus === 'Read' ? gdDate(r['Date Read']) : undefined,
            createdAt: gdDate(r['Date Added']),
            shelves: [...new Set(shelfNames.map(prettyShelf))],
            notes: r['Private Notes'] || undefined,
            owned: !wishlist,
            // hints for the preview: unrated books that aren't on a wishlist shelf can be sent there by hand
            shelf: exclusive,
            unrated: !rating && !wishlist && readingStatus !== 'Currently Reading',
        }
    }
    const { title, series, volume } = splitSeries(r.Title)
    return {
        title,
        author: r.Author,
        series: r.Series || series,
        seriesVolume: Number(r['Series #']) || volume,
        isbn: normIsbn(r.ISBN),
        publisher: r.Publisher,
        pageCount: Number(r.Pages) || undefined,
        publishDate: toDate(r.Published),
        format: toList((r.Format || '').replace(/;/g, ',')),
        genres: toList((r.Genres || '').replace(/;/g, ',')),
        readingStatus: READING_STATUSES.includes(r.Status) ? r.Status : '',
        startedAt: toDate(r.Started),
        finishedAt: toDate(r.Finished),
        currentPage: Number(r['Current Page']) || undefined,
        rating: Number(r.Rating) || undefined,
        shelves: toList((r.Shelves || '').replace(/;/g, ',')),
        owned: String(r.Owned).toLowerCase() !== 'no',
        loanedTo: r['Loaned To'] || undefined,
        notes: r.Notes || undefined,
        createdAt: toDate(r.Added),
    }
}

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)

// Empty fields on an existing book that this row can fill (nothing already entered is overwritten)
function fillable(book, b) {
    const fields = []
    if (!book.series?.id && b.series) fields.push('series')
    for (const f of ['rating', 'readingStatus', 'finishedAt', 'pageCount', 'publisher', 'isbn', 'publishDate', 'notes']) {
        if (isEmpty(book[f]) && !isEmpty(b[f])) fields.push(f)
    }
    if (isEmpty(book.shelves) && !isEmpty(b.shelves)) fields.push('shelves')
    return fields
}

const short = (b) => ({ title: b.title, author: b.author, series: b.series, seriesVolume: b.seriesVolume, owned: b.owned, readingStatus: b.readingStatus })

// POST /api/import { csv, dryRun, wishlist: [row], fillExisting } (owner)
//   Preview (dryRun) -> { created, items, wishlistCount, unrated: [{ row, ... }], fill: { count, items }, skipped }
//   Import            -> same counts, done
// New books are added; books already in the library are skipped, or (fillExisting) get their EMPTY fields filled.
// Unrated books are never marked read. Rows listed in `wishlist` go to the wishlist (by row number).
router.post('/import', requireOwner, express.json({ limit: '5mb' }), async (req, res) => {
    try {
        const rows = csv.parse(req.body?.csv || '')
        if (!rows.length) return res.status(400).json({ message: 'That file has no rows.' })
        if (!('Title' in rows[0])) return res.status(400).json({ message: 'That doesn’t look like a Goodreads or library CSV (no "Title" column).' })

        const dryRun = req.body?.dryRun !== false
        const fillExisting = req.body?.fillExisting !== false
        const toWishlist = new Set((req.body?.wishlist || []).map(Number))
        const index = libraryIndex(await Books.summary())

        const created = []
        const unrated = []
        const fills = []
        const skipped = []
        for (const [row, raw] of rows.entries()) {
            const b = mapRow(raw)
            if (!b.title) { skipped.push({ title: '(no title)', reason: 'No title' }); continue }
            if (toWishlist.has(row) && b.unrated) b.owned = false

            const match = index.match(b)
            if (match) {
                const book = match.bookId.startsWith('new:') ? null : await Books.byId(match.bookId)
                const fields = book ? fillable(book, b) : []
                if (!fields.length || !fillExisting) {
                    skipped.push({ title: b.title, reason: book ? 'Already in your library' : 'Listed twice in the file' })
                    continue
                }
                fills.push({ title: book.title, fields })
                if (!dryRun) {
                    if (fields.includes('series')) {
                        const s = await Series.findOrCreate(b.series, book.author?.id, req.user.id)
                        book.series = { id: s._id, volume: b.seriesVolume }
                    }
                    for (const f of fields) if (f !== 'series') book[f] = b[f]
                    await Books.save(book)
                }
                continue
            }

            index.add({ _id: `new:${row}`, title: b.title, isbn: b.isbn, authorName: b.author })
            if (b.unrated) unrated.push({ row, ...short(b), shelf: prettyShelf(b.shelf) })
            if (dryRun) { created.push(short(b)); continue }

            const author = b.author ? await Authors.findOrCreateByName(b.author, req.user.id) : null
            const series = b.series ? await Series.findOrCreate(b.series, author?._id, req.user.id) : null
            const { author: _a, series: _s, seriesVolume, shelf: _sh, unrated: _u, ...fields } = b
            Object.keys(fields).forEach((k) => (fields[k] === undefined || fields[k] === '') && delete fields[k])
            await Books.insert({
                ...fields,
                author: author ? { id: author._id } : undefined,
                series: series ? { id: series._id, volume: seriesVolume } : undefined,
                owner: req.user.id,
            })
            created.push(short(b))
        }
        res.json({
            dryRun,
            created: created.length,
            wishlistCount: created.filter((b) => b.owned === false).length,
            readCount: created.filter((b) => b.readingStatus === 'Read').length,
            items: created,
            unrated,
            fill: { count: fills.length, items: fills },
            skipped,
        })
    } catch (err) {
        console.error('Import failed:', err)
        res.status(500).json({ message: 'Import failed. Nothing after the error was added.' })
    }
})

module.exports = router
