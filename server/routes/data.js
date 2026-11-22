const express = require('express')
const Book = require('../models/book')
const Author = require('../models/author')
const csv = require('../lib/csv')
const { requireOwner } = require('../lib/auth')
const { toDate, toList } = require('./books').helpers

const router = express.Router()

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase()
const normIsbn = (v) => String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase()
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

const COLUMNS = ['Title', 'Author', 'Series', 'Series #', 'ISBN', 'Format', 'Genres', 'Publisher', 'Published',
    'Pages', 'Status', 'Started', 'Finished', 'Current Page', 'Rating', 'Shelves', 'Owned', 'Loaned To', 'Notes', 'Added']

// GET /api/export?format=json|csv (owner) -> download of the whole library (covers not included)
router.get('/export', requireOwner, async (req, res) => {
    try {
        const books = await Book.find({}, { coverImagePath: 0 }).sort({ title: 1 }).lean()
        const stamp = new Date().toISOString().slice(0, 10)
        if (req.query.format === 'csv') {
            const rows = books.map((b) => ({
                Title: b.title,
                Author: [b.author?.firstName, b.author?.lastName].filter(Boolean).join(' '),
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
        const authors = await Author.find({}).lean()
        res.set('Content-Disposition', `attachment; filename="library-${stamp}.json"`)
        res.json({ exportedAt: new Date().toISOString(), books, authors })
    } catch (err) {
        console.error('Export failed:', err)
        res.status(500).json({ message: 'Export failed' })
    }
})

// Map one CSV row (Goodreads export, or this app's own CSV export) to book fields
function mapRow(r) {
    const goodreads = 'Exclusive Shelf' in r || 'My Rating' in r
    if (goodreads) {
        const shelf = r['Exclusive Shelf']
        const status = { read: 'Read', 'currently-reading': 'Currently Reading', 'to-read': 'Want To Read' }[shelf] || ''
        const shelves = toList(r.Bookshelves).filter((s) => !['read', 'currently-reading', 'to-read'].includes(s))
        return {
            title: r.Title,
            author: r.Author,
            isbn: normIsbn(r.ISBN13) || normIsbn(r.ISBN),
            publisher: r.Publisher,
            pageCount: Number(r['Number of Pages']) || undefined,
            publishDate: toDate(r['Original Publication Year'] || r['Year Published']),
            format: r.Binding ? [r.Binding] : [],
            readingStatus: status,
            rating: Number(r['My Rating']) || undefined,
            finishedAt: status === 'Read' ? toDate((r['Date Read'] || '').replace(/\//g, '-')) : undefined,
            createdAt: toDate((r['Date Added'] || '').replace(/\//g, '-')),
            shelves,
            notes: r['Private Notes'] || undefined,
            owned: true,
        }
    }
    return {
        title: r.Title,
        author: r.Author,
        isbn: normIsbn(r.ISBN),
        publisher: r.Publisher,
        pageCount: Number(r.Pages) || undefined,
        publishDate: toDate(r.Published),
        format: toList((r.Format || '').replace(/;/g, ',')),
        genres: toList((r.Genres || '').replace(/;/g, ',')),
        readingStatus: Book.READING_STATUSES.includes(r.Status) ? r.Status : '',
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

// POST /api/import { csv, dryRun } (owner) -> { created, skipped, wouldCreate }
// Accepts a Goodreads "Export Library" CSV or this app's CSV export. Never changes existing books.
router.post('/import', requireOwner, express.json({ limit: '5mb' }), async (req, res) => {
    try {
        const rows = csv.parse(req.body?.csv || '')
        if (!rows.length) return res.status(400).json({ message: 'That file has no rows.' })
        if (!('Title' in rows[0])) return res.status(400).json({ message: 'That doesn’t look like a Goodreads or library CSV (no "Title" column).' })

        const dryRun = req.body?.dryRun !== false
        const existing = await Book.find({}, { title: 1, isbn: 1, 'author.lastName': 1 }).lean()
        const seenIsbn = new Set(existing.map((b) => normIsbn(b.isbn)).filter(Boolean))
        const seenTitle = new Set(existing.map((b) => `${norm(b.title)}|${norm(b.author?.lastName)}`))
        const authors = await Author.find({}).lean()
        const authorKey = (first, last) => `${norm(first).replace(/\./g, '')}|${norm(last)}`
        const authorMap = new Map(authors.map((a) => [authorKey(a.firstName, a.lastName), a]))

        const created = []
        const skipped = []
        for (const row of rows) {
            const b = mapRow(row)
            if (!b.title) { skipped.push({ title: '(no title)', reason: 'No title' }); continue }
            const parts = String(b.author || '').trim().split(/\s+/).filter(Boolean)
            const first = parts.slice(0, -1).join(' ') || (parts.length ? '-' : '')
            const last = parts.slice(-1)[0] || ''
            const titleKey = `${norm(b.title)}|${norm(last)}`
            if ((b.isbn && seenIsbn.has(b.isbn)) || seenTitle.has(titleKey)) {
                skipped.push({ title: b.title, reason: 'Already in your library' })
                continue
            }
            seenTitle.add(titleKey)
            if (b.isbn) seenIsbn.add(b.isbn)

            if (dryRun) { created.push({ title: b.title, author: b.author }); continue }

            let author = null
            if (last) {
                author = authorMap.get(authorKey(first, last))
                if (!author) {
                    author = (await Author.create({ firstName: first, lastName: last, owner: req.user.id })).toObject()
                    authorMap.set(authorKey(first, last), author)
                }
            }
            const { author: _name, ...fields } = b
            Object.keys(fields).forEach((k) => (fields[k] === undefined || fields[k] === '') && delete fields[k])
            const book = await Book.create({
                ...fields,
                author: author ? { id: author._id, firstName: author.firstName, lastName: author.lastName } : undefined,
                createdAt: fields.createdAt || new Date(),
                owner: req.user.id,
            })
            created.push({ id: book._id, title: book.title })
        }
        res.json({ dryRun, created: created.length, skipped, items: created.slice(0, 50) })
    } catch (err) {
        console.error('Import failed:', err)
        res.status(500).json({ message: 'Import failed. Nothing after the error was added.' })
    }
})

module.exports = router
