import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AddLink } from '../Buttons'
import { ListSkeleton } from '../Skeleton'
import styles from './IndexList.module.css'

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

// A searchable list page (Authors, Series). items: [{ id, to, title, subtitle, count }]
export default function IndexList({ heading, noun, nounPlural = `${noun}s`, items, isLoading, error, addTo, addLabel, searchLabel }) {
    const [query, setQuery] = useState('')
    const q = query.trim().toLowerCase()
    const shown = q ? items.filter((it) => `${it.title} ${it.subtitle || ''}`.toLowerCase().includes(q)) : items

    return (
        <div className={styles.page}>
            <div className={styles.titleRow}>
                <div className={styles.titleGroup}>
                    <h1 className={styles.title}>{heading}</h1>
                    {!isLoading && !error && (
                        <span className={styles.count} aria-live="polite">
                            {q ? `${shown.length} of ${plural(items.length, noun, nounPlural)}` : plural(items.length, noun, nounPlural)}
                        </span>
                    )}
                </div>
                {addTo && <AddLink to={addTo}>{addLabel}</AddLink>}
            </div>

            <div className={styles.searchBox}>
                <label htmlFor="index-search" className="sr-only">{searchLabel}</label>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={styles.searchIcon}>
                    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                </svg>
                <input
                    id="index-search"
                    type="search"
                    className={styles.searchInput}
                    placeholder={searchLabel}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
                    autoComplete="off"
                />
            </div>

            {isLoading ? (
                <ListSkeleton />
            ) : error ? (
                <p className={styles.message}>Couldn’t load this list. The server or database may be asleep; try again in a minute.</p>
            ) : items.length === 0 ? (
                <p className={styles.message}>No {nounPlural} yet.</p>
            ) : shown.length === 0 ? (
                <p className={styles.message}>No {nounPlural} match “{query.trim()}”.</p>
            ) : (
                <ul className={styles.list}>
                    {shown.map((it) => (
                        <li key={it.id}>
                            <Link to={it.to} className={styles.row}>
                                <span className={styles.text}>
                                    <span className={styles.name}>{it.title}</span>
                                    {it.subtitle && <span className={styles.subtitle}>{it.subtitle}</span>}
                                </span>
                                <span className={styles.meta}>{plural(it.count, 'book')}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.chevron}>
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
