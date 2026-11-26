// Books in SQLite. The API shape stays what the client already uses:
// { _id, title, author: { id, firstName, lastName }, series: { id, title, volume }, format: [], ... }
const { all, get, run, newId, now } = require('./index')

const LIGHT_COLUMNS = `b.id, b.title, b.publish_date, b.page_count, b.created_at, b.updated_at, b.author_id, b.series_id,
    b.series_volume, b.format, b.genres, b.shelves, b.publisher, b.isbn, b.reading_status, b.started_at, b.finished_at,
    b.current_page, b.rating, b.notes, b.owned, b.loaned_to, b.loaned_at, b.owner,
    (b.cover IS NOT NULL AND b.cover <> '') AS has_cover,
    a.first_name, a.last_name, s.title AS series_title`
const FROM = `FROM books b LEFT JOIN authors a ON a.id = b.author_id LEFT JOIN series s ON s.id = b.series_id`

const parseList = (v) => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : [] } catch { return [] } }
const num = (v) => (v === null || v === undefined || v === '' ? undefined : Number(v))

// Row -> API object (undefined fields are dropped)
function toBook(r) {
    if (!r) return null
    const book = {
        _id: r.id,
        title: r.title,
        description: r.description ?? undefined,
        publishDate: r.publish_date || undefined,
        pageCount: num(r.page_count),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        author: r.author_id ? { id: r.author_id, firstName: r.first_name, lastName: r.last_name } : undefined,
        series: r.series_id ? { id: r.series_id, title: r.series_title, volume: num(r.series_volume) } : undefined,
        format: parseList(r.format),
        genres: parseList(r.genres),
        shelves: parseList(r.shelves),
        publisher: r.publisher || undefined,
        isbn: r.isbn || undefined,
        readingStatus: r.reading_status || undefined,
        startedAt: r.started_at || undefined,
        finishedAt: r.finished_at || undefined,
        currentPage: num(r.current_page),
        rating: num(r.rating),
        notes: r.notes || undefined,
        owned: Number(r.owned) !== 0,
        loanedTo: r.loaned_to || undefined,
        loanedAt: r.loaned_at || undefined,
        owner: r.owner || undefined,
        hasCover: r.has_cover !== undefined ? Boolean(Number(r.has_cover)) : Boolean(r.cover),
        coverImagePath: r.cover !== undefined ? r.cover || undefined : undefined,
    }
    Object.keys(book).forEach((k) => book[k] === undefined && delete book[k])
    return book
}

// API object -> column values
function toRow(b) {
    return {
        title: b.title,
        description: b.description ?? null,
        publish_date: b.publishDate ?? null,
        page_count: b.pageCount ?? null,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
        author_id: b.author?.id ?? null,
        series_id: b.series?.id ?? null,
        series_volume: b.series?.id ? b.series.volume ?? null : null,
        format: JSON.stringify(b.format || []),
        genres: JSON.stringify(b.genres || []),
        shelves: JSON.stringify(b.shelves || []),
        publisher: b.publisher ?? null,
        isbn: b.isbn ?? null,
        cover: b.coverImagePath ?? null,
        reading_status: b.readingStatus ?? null,
        started_at: b.startedAt ?? null,
        finished_at: b.finishedAt ?? null,
        current_page: b.currentPage ?? null,
        rating: b.rating ?? null,
        notes: b.notes ?? null,
        owned: b.owned === false ? 0 : 1,
        loaned_to: b.loanedTo ?? null,
        loaned_at: b.loanedAt ?? null,
        owner: b.owner ?? null,
    }
}

// ---------- reads ----------

// Full book, optionally with the cover value (data URL or file reference)
async function byId(id, { cover = false } = {}) {
    const cols = `${LIGHT_COLUMNS}, b.description${cover ? ', b.cover' : ''}`
    return toBook(await get(`SELECT ${cols} ${FROM} WHERE b.id = ?`, [id]))
}

async function coverOf(id) {
    return get('SELECT cover, updated_at FROM books WHERE id = ?', [id])
}

// Light list with filters. q searches title, author, series, publisher, ISBN.
async function list(q = {}, { signedIn = false } = {}) {
    const where = []
    const args = []
    if (q.q) {
        const like = `%${String(q.q).trim()}%`
        const isbn = `%${String(q.q).replace(/[\s-]/g, '')}%`
        where.push(`(b.title LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ? OR (a.first_name || ' ' || a.last_name) LIKE ?
            OR s.title LIKE ? OR b.publisher LIKE ? OR b.isbn LIKE ?)`)
        args.push(like, like, like, like, like, like, isbn)
    }
    if (q.status) {
        if (q.status === 'none') where.push(`(b.reading_status IS NULL OR b.reading_status = '')`)
        else { where.push('b.reading_status = ?'); args.push(q.status) }
    }
    for (const [param, column] of [['format', 'format'], ['genre', 'genres'], ['shelf', 'shelves']]) {
        if (q[param]) {
            where.push(`EXISTS (SELECT 1 FROM json_each(b.${column}) WHERE lower(value) = lower(?))`)
            args.push(String(q[param]))
        }
    }
    if (q.authorId) { where.push('b.author_id = ?'); args.push(String(q.authorId)) }
    if (q.seriesId) { where.push('b.series_id = ?'); args.push(String(q.seriesId)) }
    if (q.owned === 'true') where.push('b.owned <> 0')
    if (q.owned === 'false') where.push('b.owned = 0')
    if (q.loaned === 'true' && signedIn) where.push(`(b.loaned_to IS NOT NULL AND b.loaned_to <> '')`)

    const sql = `SELECT ${LIGHT_COLUMNS} ${FROM}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`
    return (await all(sql, args)).map(toBook)
}

async function facets() {
    const count = (column) => all(
        `SELECT lower(j.value) k, min(j.value) label, COUNT(*) n FROM books b, json_each(b.${column}) j
         WHERE j.value IS NOT NULL AND j.value <> '' GROUP BY lower(j.value) ORDER BY label COLLATE NOCASE`)
    const [formats, genres, shelves, statuses, totals] = await Promise.all([
        count('format'), count('genres'), count('shelves'),
        all(`SELECT COALESCE(NULLIF(reading_status, ''), 'none') k, COUNT(*) n FROM books GROUP BY 1`),
        get(`SELECT COUNT(*) total, SUM(owned = 0) wishlist, SUM(loaned_to IS NOT NULL AND loaned_to <> '') loaned FROM books`),
    ])
    const tidy = (rows) => rows.map((r) => ({ value: r.label, count: Number(r.n) }))
    return {
        total: Number(totals.total) || 0,
        formats: tidy(formats),
        genres: tidy(genres),
        shelves: tidy(shelves),
        statuses: Object.fromEntries(statuses.map((s) => [s.k, Number(s.n)])),
        wishlist: Number(totals.wishlist) || 0,
        loaned: Number(totals.loaned) || 0,
    }
}

async function counts() {
    const [byAuthor, bySeries] = await Promise.all([
        all('SELECT author_id k, COUNT(*) n FROM books WHERE author_id IS NOT NULL GROUP BY author_id'),
        all('SELECT series_id k, COUNT(*) n FROM books WHERE series_id IS NOT NULL GROUP BY series_id'),
    ])
    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r.k, Number(r.n)]))
    return { byAuthor: toMap(byAuthor), bySeries: toMap(bySeries) }
}

// Light list for "already in your library" checks
async function summary() {
    const rows = await all(`SELECT b.id, b.title, b.isbn, b.owned, b.author_id, a.first_name, a.last_name ${FROM}`)
    return rows.map((r) => ({
        _id: r.id,
        title: r.title,
        isbn: r.isbn || undefined,
        owned: Number(r.owned) !== 0,
        author: r.author_id ? { id: r.author_id, firstName: r.first_name, lastName: r.last_name } : undefined,
    }))
}

async function duplicates({ isbn, title }) {
    const where = []
    const args = []
    if (isbn) { where.push('b.isbn = ?'); args.push(isbn) }
    if (title) { where.push('b.title = ? COLLATE NOCASE'); args.push(title) }
    if (!where.length) return []
    const rows = await all(`SELECT b.id, b.title, b.isbn, b.author_id, a.first_name, a.last_name ${FROM} WHERE ${where.join(' OR ')} LIMIT 10`, args)
    return rows.map((r) => ({ _id: r.id, title: r.title, isbn: r.isbn || undefined, author: r.author_id ? { id: r.author_id, firstName: r.first_name, lastName: r.last_name } : undefined }))
}

// Everything except cover bytes (export, stats)
async function allBooks() {
    return (await all(`SELECT ${LIGHT_COLUMNS}, b.description ${FROM} ORDER BY b.title COLLATE NOCASE`)).map(toBook)
}

// ---------- writes ----------

const COLUMNS = Object.keys(toRow({ title: '' }))

async function insert(book) {
    const stamp = now()
    const b = { ...book, _id: book._id || newId(), createdAt: book.createdAt || stamp, updatedAt: book.updatedAt || stamp }
    const row = toRow(b)
    await run(`INSERT INTO books (id, ${COLUMNS.join(', ')}) VALUES (?, ${COLUMNS.map(() => '?').join(', ')})`, [b._id, ...COLUMNS.map((c) => row[c])])
    return b._id
}

// Replace a book's stored fields with the given object (routes load, change, then save)
async function save(book, { touch = true } = {}) {
    const b = { ...book, updatedAt: touch ? now() : book.updatedAt }
    const row = toRow(b)
    const cols = COLUMNS.filter((c) => c !== 'created_at')
    await run(`UPDATE books SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => row[c]), b._id])
    return b._id
}

const remove = (id) => run('DELETE FROM books WHERE id = ?', [id])

module.exports = { byId, coverOf, list, facets, counts, summary, duplicates, allBooks, insert, save, remove, toBook }
