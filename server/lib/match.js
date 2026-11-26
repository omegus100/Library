// "Is this the same book?" — shared by the Goodreads import and the Calibre sync.
// Same ISBN (10- and 13-digit forms count as equal), or same title + author surname, where titles
// ignore case, accents, punctuation, a leading The/A/An and "(Series, #1)" tails. A subtitle may be
// missing on one side ("Mistborn" = "Mistborn: The Final Empire"), but different subtitles never match
// ("Angel: After the Fall, Vol. 1" ≠ "Angel: After the Fall, Vol. 2").

const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
const squash = (s) => s.replace(/^\s*(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '')

// Full title without bracketed tails
const fullKey = (t) => squash(fold(t).split(/[([]/)[0])
// Main title: also without a subtitle
const mainKey = (t) => squash(fold(t).split(/[:([]/)[0])
const titleKey = fullKey

// "Sanderson, Brandon" or "Brandon Sanderson" -> "sanderson"
const surname = (name) => {
    const s = String(name || '').trim()
    const last = s.includes(',') ? s.split(',')[0] : s.split(/\s+/).pop()
    return fold(last).replace(/[^a-z0-9]/g, '')
}

function isbn13(v) {
    const s = String(v || '').replace(/[^0-9Xx]/g, '').toUpperCase()
    if (s.length === 13) return s
    if (s.length !== 10) return ''
    const core = `978${s.slice(0, 9)}`
    const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0)
    return core + ((10 - (sum % 10)) % 10)
}

// "The Way of Kings (The Stormlight Archive, #1)" -> { title: 'The Way of Kings', series: 'The Stormlight Archive', volume: 1 }
// Only the Goodreads pattern "(Name, #n)" / "(Name #n)" counts; anything else stays in the title.
function splitSeries(rawTitle) {
    const title = String(rawTitle || '').replace(/\s+/g, ' ').trim()
    const m = /^(.*\S)\s*\(([^()]+?),?\s*#\s*(\d+(?:\.\d+)?)(?:-\d+(?:\.\d+)?)?\)\s*$/.exec(title)
    if (!m) return { title }
    return { title: m[1].trim(), series: m[2].trim(), volume: Number(m[3]) }
}

// Index of library books. Each book: { _id, title, isbn, author: { lastName } } (or authorName)
function libraryIndex(books = []) {
    const byIsbn = new Map()
    const byFull = new Map()
    const byMain = new Map()
    const put = (map, key, id) => { if (key && !map.has(key)) map.set(key, id) }
    const index = {
        add(b) {
            const who = surname(b.author?.lastName ?? b.authorName)
            put(byIsbn, isbn13(b.isbn), b._id)
            if (!who) return
            put(byFull, `${fullKey(b.title)}|${who}`, b._id)
            put(byMain, `${mainKey(b.title)}|${who}`, b._id)
        },
        // item: { title, isbn, author } (author = full name) -> { bookId, by } or null
        match(item) {
            const i = isbn13(item.isbn)
            if (i && byIsbn.has(i)) return { bookId: byIsbn.get(i), by: 'isbn' }
            const who = surname(item.author)
            if (!who || !fullKey(item.title)) return null
            const full = `${fullKey(item.title)}|${who}`
            const main = `${mainKey(item.title)}|${who}`
            const id = byFull.get(full) || byFull.get(main) || byMain.get(full)
            return id ? { bookId: id, by: 'title' } : null
        },
    }
    books.forEach(index.add)
    return index
}

module.exports = { fold, titleKey, fullKey, mainKey, surname, isbn13, splitSeries, libraryIndex }
