import React from 'react'
import { Link } from 'react-router-dom'
import Cover from './Cover'
import styles from './BookStrip.module.css'

// A row of small covers with titles, e.g. "More in this series"
export default function BookStrip({ title, books, caption }) {
    if (!books.length) return null
    return (
        <section className={styles.section}>
            <h2 className={styles.heading}>{title}</h2>
            <ul className={styles.strip}>
                {books.map((book) => (
                    <li key={book._id}>
                        <Link to={`/books/${book._id}`} className={styles.item}>
                            <Cover book={book} />
                            <span className={styles.title}>{book.title}</span>
                            {caption && <span className={styles.caption}>{caption(book)}</span>}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
