// Keeps the catalog in step with a Calibre library. One-way and read-only towards Calibre.
//   sync()          read every Calibre book, link it to a library book (ISBN, then title + author),
//                   add "eBook" to newly linked books and fill a missing cover. Never creates or deletes books.
//   addToLibrary()  create catalog entries for Calibre books you choose that aren't in the library yet.
// Books that disappear from Calibre are flagged "missing", never deleted.
const { all, get, batch, newId, now } = require('../db')
const Books = require('../db/books')
const { settings: Settings, authors: Authors, series: Series } = require('../db/repos')
const covers = require('./covers')
const calibre = require('./calibre')

const SYNC_EVERY_MS = 6 * 60 * 60 * 1000
const EBOOK = 'eBook'

// ---------- settings ----------

async function getConfig() {
    const c = (await Settings.integrations()).calibre || {}
    return {
        enabled: Boolean(c.enabled),
        path: c.path || calibre.DEFAULT_PATH,
        webUrl: c.webUrl || '',
        lastSync: c.lastSync || null,
        lastResult: c.lastResult || null,
        lastError: c.lastError || null,
    }
}

// Calibre-Web deep link, e.g. http://nas:8083/book/12 (only when an address is set)
const linkFor = (webUrl, calibreId) => (webUrl ? `${webUrl.replace(/\/+$/, '')}/book/${calibreId}` : null)

// ---------- matching (shared with the Goodreads import) ----------

const { libraryIndex } = require('./match')
const asItem = (item) => ({ title: item.title, isbn: item.isbn, author: item.authors?.[0] })

// ---------- sync ----------

const UPSERT = `INSERT INTO calibre_books
    (calibre_id, uuid, title, authors, series, series_index, isbn, formats, has_cover, last_modified, book_id, matched_by, missing, synced_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)
    ON CONFLICT(calibre_id) DO UPDATE SET uuid = excluded.uuid, title = excluded.title, authors = excluded.authors,
        series = excluded.series, series_index = excluded.series_index, isbn = excluded.isbn, formats = excluded.formats,
        has_cover = excluded.has_cover, last_modified = excluded.last_modified, book_id = excluded.book_id,
        matched_by = excluded.matched_by, missing = 0, synced_at = excluded.synced_at`

async function inChunks(statements, size = 200) {
    for (let i = 0; i < statements.length; i += size) await batch(statements.slice(i, i + size))
}

// Add "eBook" and (if the book has none) Calibre's cover to a book that was just linked
async function enrich(bookId, item, folder) {
    const book = await Books.byId(bookId, { cover: true })
    if (!book) return
    let changed = false
    if (!(book.format || []).some((f) => String(f).toLowerCase() === 'ebook')) {
        book.format = [...(book.format || []), EBOOK]
        changed = true
    }
    if (!book.coverImagePath && item.hasCover) {
        const image = await calibre.readCover(folder, item.path)
        if (image) {
            try { book.coverImagePath = await covers.store(image, book._id); changed = true } catch { /* too large or unreadable: skip */ }
        }
    }
    if (changed) await Books.save(book)
}

let running = null

async function runSync() {
    const cfg = await getConfig()
    if (!cfg.enabled) throw new calibre.CalibreError('Calibre is turned off in Settings.')
    try {
        const items = calibre.readBooks(cfg.path)
        const existing = new Map((await all('SELECT calibre_id, uuid, book_id, matched_by FROM calibre_books')).map((r) => [Number(r.calibre_id), r]))
        const index = libraryIndex(await Books.summary())
        const stamp = now()
        const statements = []
        const newlyLinked = []

        for (const item of items) {
            if (!item.title) continue
            let prev = existing.get(item.calibreId)
            if (prev && prev.uuid && item.uuid && prev.uuid !== item.uuid) prev = null // a different library reused the id
            let bookId = prev?.book_id || null
            let by = prev?.matched_by || null
            if (!bookId) {
                const m = index.match(asItem(item))
                if (m) { bookId = m.bookId; by = m.by; newlyLinked.push({ bookId, item }) }
            }
            statements.push({
                sql: UPSERT,
                args: [item.calibreId, item.uuid ?? null, item.title, JSON.stringify(item.authors), item.series ?? null, item.seriesIndex ?? null,
                    item.isbn ?? null, JSON.stringify(item.formats), item.hasCover ? 1 : 0, item.lastModified ?? null, bookId, by, stamp],
            })
        }
        const seen = new Set(items.map((i) => i.calibreId))
        for (const id of existing.keys()) {
            if (!seen.has(id)) statements.push({ sql: 'UPDATE calibre_books SET missing = 1 WHERE calibre_id = ?', args: [id] })
        }
        await inChunks(statements)

        for (const { bookId, item } of newlyLinked) await enrich(bookId, item, cfg.path)

        const totals = await get(`SELECT COUNT(*) total, SUM(missing = 0) present, SUM(book_id IS NOT NULL AND missing = 0) linked,
            SUM(book_id IS NULL AND missing = 0) unlinked, SUM(missing = 1) missing FROM calibre_books`)
        const result = {
            books: Number(totals.present) || 0,
            linked: Number(totals.linked) || 0,
            newlyLinked: newlyLinked.length,
            notInLibrary: Number(totals.unlinked) || 0,
            missing: Number(totals.missing) || 0,
        }
        await Settings.setIntegration('calibre', { lastSync: stamp, lastResult: result, lastError: null })
        return result
    } catch (err) {
        await Settings.setIntegration('calibre', { lastError: { at: now(), message: err.message } })
        throw err
    }
}

// One sync at a time; a second request waits for the running one
function sync() {
    if (!running) running = runSync().finally(() => { running = null })
    return running
}

// ---------- adding Calibre books to the library ----------

async function notInLibrary() {
    const rows = await all(`SELECT calibre_id, title, authors, series, series_index, formats FROM calibre_books
        WHERE book_id IS NULL AND missing = 0 ORDER BY title COLLATE NOCASE`)
    const parse = (v) => { try { return JSON.parse(v || '[]') } catch { return [] } }
    return rows.map((r) => ({
        calibreId: Number(r.calibre_id),
        title: r.title,
        authors: parse(r.authors),
        series: r.series || undefined,
        seriesIndex: r.series_index ?? undefined,
        formats: parse(r.formats),
    }))
}

async function addToLibrary(ids, owner) {
    if (running) await running.catch(() => {})
    const cfg = await getConfig()
    if (!cfg.enabled) throw new calibre.CalibreError('Calibre is turned off in Settings.')
    const wanted = new Set((ids || []).map(Number).filter(Number.isInteger))
    if (!wanted.size) throw new calibre.CalibreError('Pick at least one book.')

    const open = new Set((await notInLibrary()).map((r) => r.calibreId))
    const items = calibre.readBooks(cfg.path).filter((i) => wanted.has(i.calibreId) && open.has(i.calibreId))
    const index = libraryIndex(await Books.summary())
    let added = 0
    let linked = 0

    for (const item of items) {
        const existing = index.match(asItem(item)) // added by hand since the last sync? link instead of duplicating
        if (existing) {
            await batch([{ sql: 'UPDATE calibre_books SET book_id = ?, matched_by = ? WHERE calibre_id = ?', args: [existing.bookId, existing.by, item.calibreId] }])
            await enrich(existing.bookId, item, cfg.path)
            linked++
            continue
        }

        const author = item.authors[0] ? await Authors.findOrCreateByName(item.authors[0], owner) : null
        const seriesId = item.series ? (await Series.findOrCreate(item.series, author?._id, owner))._id : null

        const book = {
            _id: newId(),
            title: item.title,
            description: item.description,
            publisher: item.publisher,
            isbn: item.isbn,
            publishDate: item.publishDate,
            format: [EBOOK],
            genres: [],
            shelves: [],
            owned: true,
            owner,
            author: author ? { id: author._id } : undefined,
            series: seriesId ? { id: seriesId, volume: item.seriesIndex } : undefined,
        }
        if (item.hasCover) {
            const image = await calibre.readCover(cfg.path, item.path)
            if (image) { try { book.coverImagePath = await covers.store(image, book._id) } catch { /* skip */ } }
        }
        await Books.insert(book)
        await batch([{ sql: `UPDATE calibre_books SET book_id = ?, matched_by = 'added' WHERE calibre_id = ?`, args: [book._id, item.calibreId] }])
        index.add({ _id: book._id, title: book.title, isbn: book.isbn, author: author ? { lastName: author.lastName } : undefined })
        added++
    }
    const result = await get('SELECT SUM(book_id IS NULL AND missing = 0) n FROM calibre_books')
    const cfgNow = await getConfig()
    if (cfgNow.lastResult) await Settings.setIntegration('calibre', { lastResult: { ...cfgNow.lastResult, notInLibrary: Number(result.n) || 0 } })
    return { added, linked }
}

// ---------- per-book info for the book page ----------

async function ebookFor(bookId) {
    const rows = await all('SELECT calibre_id, formats, missing FROM calibre_books WHERE book_id = ? ORDER BY missing, calibre_id', [bookId])
    if (!rows.length) return null
    const { webUrl } = await getConfig()
    const formats = [...new Set(rows.flatMap((r) => { try { return JSON.parse(r.formats) } catch { return [] } }))]
    const present = rows.find((r) => Number(r.missing) === 0)
    return {
        formats,
        missing: !present,
        link: present ? linkFor(webUrl, present.calibre_id) : null,
    }
}

// ---------- schedule ----------

function startSchedule() {
    const tick = async () => {
        try {
            if ((await getConfig()).enabled) {
                const r = await sync()
                console.log(`Calibre sync: ${r.books} ebooks, ${r.linked} linked (${r.newlyLinked} new), ${r.notInLibrary} not in the library`)
            }
        } catch (err) {
            console.warn('Calibre sync failed:', err.message)
        }
    }
    setTimeout(tick, 60 * 1000).unref()
    setInterval(tick, SYNC_EVERY_MS).unref()
}

module.exports = { getConfig, linkFor, sync, notInLibrary, addToLibrary, ebookFor, startSchedule }
