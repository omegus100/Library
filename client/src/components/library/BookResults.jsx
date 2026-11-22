import React from 'react'
import { Link } from 'react-router-dom'
import Cover from './Cover'
import { authorName, seriesLabel } from '../../utils/bookSort'
import styles from './BookResults.module.css'

const progressOf = (book) =>
    book.readingStatus === 'Currently Reading' && book.pageCount > 0 && book.currentPage > 0
        ? Math.min(100, Math.round((book.currentPage / book.pageCount) * 100))
        : null

// Small facts that help you find a book at a glance (not decoration)
function Tags({ book }) {
    const tags = []
    if (book.owned === false) tags.push(['Wishlist', styles.tagWish])
    if (book.loanedTo) tags.push([`Lent to ${book.loanedTo}`, styles.tagLoan])
    if (!tags.length) return null
    return (
        <span className={styles.tags}>
            {tags.map(([label, cls]) => <span key={label} className={`${styles.tag} ${cls}`}>{label}</span>)}
        </span>
    )
}

function Progress({ book }) {
    const pct = progressOf(book)
    if (pct === null) return null
    return (
        <span className={styles.progress} title={`Page ${book.currentPage} of ${book.pageCount}`}>
            <span className={styles.progressBar} style={{ width: `${pct}%` }} />
            <span className="sr-only">{pct}% read</span>
        </span>
    )
}

// The books on the Library page, as a cover grid or a compact list
export default function BookResults({ books, view = 'grid' }) {
    if (view === 'list') {
        return (
            <ul className={styles.list}>
                {books.map((book) => (
                    <li key={book._id}>
                        <Link to={`/books/${book._id}`} className={styles.row}>
                            <Cover book={book} size="sm" />
                            <span className={styles.text}>
                                <span className={styles.title}>{book.title}</span>
                                <span className={styles.author}>{authorName(book)}</span>
                                {seriesLabel(book) && <span className={styles.series}>{seriesLabel(book)}</span>}
                                <Tags book={book} />
                            </span>
                            <span className={styles.rowMeta}>
                                {book.readingStatus && <span>{book.readingStatus}</span>}
                                {progressOf(book) !== null && <span>{progressOf(book)}%</span>}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <ul className={styles.grid}>
            {books.map((book) => (
                <li key={book._id}>
                    <Link to={`/books/${book._id}`} className={styles.card}>
                        <Cover book={book} />
                        <Progress book={book} />
                        <span className={styles.text}>
                            <span className={styles.title}>{book.title}</span>
                            <span className={styles.author}>{authorName(book)}</span>
                            {seriesLabel(book) && <span className={styles.series}>{seriesLabel(book)}</span>}
                            <Tags book={book} />
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    )
}
