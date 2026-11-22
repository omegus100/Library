// Shared filter / sort / subtitle logic for book list pages (Library, genre and format pages).
// Sort keys used by the Library page: title, author, series, pageCount, publishDate, createdAt, recent.

const compareText = (a, b) => (a || '').localeCompare(b || '', undefined, { sensitivity: 'base', numeric: true })

// "The Hobbit" sorts under H
const titleKey = (title) => (title || '').replace(/^(the|a|an)\s+/i, '')

const authorName = (book) => `${book.author?.firstName || ''} ${book.author?.lastName || ''}`.trim()

// Missing or invalid dates sort after real ones
const dateValue = (value) => {
    const time = value ? new Date(value).getTime() : NaN
    return Number.isNaN(time) ? Infinity : time
}

const byTitle = (a, b) => compareText(titleKey(a.title), titleKey(b.title))

const comparators = {
    title: byTitle,
    // Surname first, then first name, then title
    author: (a, b) =>
        compareText(a.author?.lastName, b.author?.lastName) ||
        compareText(a.author?.firstName, b.author?.firstName) ||
        byTitle(a, b),
    // Books without a series go last; within a series, by volume
    series: (a, b) => {
        const sa = a.series?.title
        const sb = b.series?.title
        if (!sa !== !sb) return sa ? -1 : 1
        return compareText(sa, sb) || (a.series?.volume || 0) - (b.series?.volume || 0) || byTitle(a, b)
    },
    pageCount: (a, b) => (a.pageCount || 0) - (b.pageCount || 0) || byTitle(a, b),
    publishDate: (a, b) => {
        const da = dateValue(a.publishDate)
        const db = dateValue(b.publishDate)
        return da === db ? byTitle(a, b) : da < db ? -1 : 1
    },
    createdAt: (a, b) => {
        const da = dateValue(a.createdAt)
        const db = dateValue(b.createdAt)
        return da === db ? byTitle(a, b) : da < db ? -1 : 1
    },
    // Newest first; books with no date go last
    recent: (a, b) => {
        const da = dateValue(a.createdAt)
        const db = dateValue(b.createdAt)
        if (da === db) return byTitle(a, b)
        if (da === Infinity) return 1
        if (db === Infinity) return -1
        return db - da
    },
}

// Returns a new sorted array; never mutates the input
export const sortBooks = (books = [], sortBy = 'title') => [...books].sort(comparators[sortBy] || byTitle)

// Case-insensitive match on title, series title, author name, or ISBN (hyphens and spaces ignored)
export const filterBooks = (books = [], query = '') => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    const qIsbn = q.replace(/[\s-]/g, '')
    return books.filter((book) =>
        [book.title, book.series?.title, book.author?.firstName, book.author?.lastName, authorName(book)]
            .some((value) => value?.toLowerCase().includes(q)) ||
        (qIsbn.length >= 3 && String(book.isbn || '').toLowerCase().includes(qIsbn))
    )
}

// "Mistborn" -> one of the placeholder cover colors, always the same one for the same title
export const coverColor = (title = '') => {
    let hash = 0
    for (const ch of title) hash = (hash * 31 + ch.codePointAt(0)) >>> 0
    return `var(--cover-${(hash % 6) + 1})`
}

export const seriesLabel = (book) =>
    book.series?.title ? `${book.series.title}${book.series.volume ? ` · Book ${book.series.volume}` : ''}` : ''

export { authorName }

// Subtitle under each cover, based on the current sort
export const bookSubtitle = (sortBy) => (book) => {
    switch (sortBy) {
        case 'series':
            return book.series?.title ? `${book.series.title} ${book.series.volume || ''}`.trim() : ''
        case 'pageCount':
            return `${book.pageCount || 0} pages`
        case 'publishDate':
            return book.publishDate ? new Date(book.publishDate).toLocaleDateString() : 'No Publish Date'
        case 'createdAt':
            return book.createdAt ? new Date(book.createdAt).toLocaleDateString() : ''
        default:
            return authorName(book)
    }
}
