import React from 'react'
import { GoBackButton } from '../Buttons'
import BookResults from './BookResults'
import { BookGridSkeleton } from '../Skeleton'
import styles from './CollectionPage.module.css'

const plural = (n) => `${n} ${n === 1 ? 'book' : 'books'}`

// One author / series / genre / format: heading, optional actions, and its books
export default function CollectionPage({ backTo, backLabel, kicker, title, subtitle, books, isLoading, error, actions, emptyText }) {
    return (
        <div className={styles.page}>
            <GoBackButton to={backTo} label={backLabel} />
            <header className={styles.header}>
                <div className={styles.headText}>
                    {kicker && <span className={styles.kicker}>{kicker}</span>}
                    <h1 className={styles.title}>{title}</h1>
                    <span className={styles.subtitle}>
                        {[subtitle, !isLoading && !error ? plural(books.length) : null].filter(Boolean).join(' · ')}
                    </span>
                </div>
                {actions && <div className={styles.actions}>{actions}</div>}
            </header>

            {isLoading ? (
                <BookGridSkeleton count={5} />
            ) : error ? (
                <p className={styles.message}>Couldn’t load these books. Try again in a minute.</p>
            ) : books.length === 0 ? (
                <p className={styles.message}>{emptyText || 'No books here yet.'}</p>
            ) : (
                <BookResults books={books} />
            )}
        </div>
    )
}
