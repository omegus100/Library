import React, { useEffect, useState } from 'react'
import { usePatchBook } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { useToast } from '../Toast'
import Rating from './Rating'
import { buttonClass } from '../Buttons'
import styles from './ReadingPanel.module.css'

const STATUSES = [
    { value: 'Want To Read', label: 'Want to read' },
    { value: 'Currently Reading', label: 'Reading' },
    { value: 'Read', label: 'Read' },
    { value: 'Did Not Finish', label: 'Didn’t finish' },
]

// Dates are stored as midnight UTC; show them in UTC so they don't slip a day
const formatDay = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '')
const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

// Reading status, progress and rating. Editable for the owner, read-only for visitors.
export default function ReadingPanel({ book, editable }) {
    const patch = usePatchBook()
    const toast = useToast()
    const [page, setPage] = useState(book.currentPage ?? '')
    useEffect(() => setPage(book.currentPage ?? ''), [book.currentPage])

    const save = (data, message) =>
        patch.mutate({ id: book._id, data }, {
            onSuccess: () => message && toast.success(message),
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t save that change.')),
        })

    const pct = book.pageCount > 0 && book.currentPage > 0 ? Math.min(100, Math.round((book.currentPage / book.pageCount) * 100)) : null
    const reading = book.readingStatus === 'Currently Reading'

    if (!editable) {
        if (!book.readingStatus && !book.rating) return null
        return (
            <section className={styles.panel} aria-label="Reading">
                <div className={styles.readOnly}>
                    {book.readingStatus && <span className={styles.statusPill}>{STATUSES.find((s) => s.value === book.readingStatus)?.label || book.readingStatus}</span>}
                    {reading && pct !== null && <span className={styles.muted}>{pct}% · page {book.currentPage} of {book.pageCount}</span>}
                    <Rating value={book.rating} />
                </div>
            </section>
        )
    }

    return (
        <section className={styles.panel} aria-label="Reading">
            <div className={styles.segment} role="group" aria-label="Reading status">
                {STATUSES.map((s) => (
                    <button
                        key={s.value}
                        type="button"
                        className={styles.segmentButton}
                        aria-pressed={book.readingStatus === s.value}
                        disabled={patch.isPending}
                        onClick={() => save({ readingStatus: book.readingStatus === s.value ? '' : s.value }, book.readingStatus === s.value ? 'Status cleared' : `Marked as “${s.label}”`)}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {(reading || (book.currentPage > 0 && book.readingStatus !== 'Read')) && (
                <form className={styles.progressRow} onSubmit={(e) => { e.preventDefault(); save({ currentPage: page }, 'Progress saved') }}>
                    <label htmlFor="current-page" className={styles.label}>Page</label>
                    <input
                        id="current-page"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={book.pageCount || undefined}
                        className={styles.pageInput}
                        value={page}
                        onChange={(e) => setPage(e.target.value)}
                    />
                    {book.pageCount ? <span className={styles.muted}>of {book.pageCount}</span> : null}
                    <button type="submit" className={buttonClass('secondary')} disabled={patch.isPending || String(page) === String(book.currentPage ?? '')}>Update</button>
                    {pct !== null && (
                        <span className={styles.bar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                    )}
                    {pct !== null && <span className={styles.muted}>{pct}%</span>}
                </form>
            )}

            <div className={styles.row}>
                <span className={styles.label}>Rating</span>
                <Rating value={book.rating || 0} onChange={(n) => save({ rating: n || '' }, n ? `Rated ${n} of 5` : 'Rating cleared')} />
            </div>

            <div className={styles.dates}>
                <label className={styles.dateField}>
                    <span className={styles.label}>Started</span>
                    <input type="date" className={styles.dateInput} value={isoDay(book.startedAt)} onChange={(e) => save({ startedAt: e.target.value || '' })} />
                </label>
                <label className={styles.dateField}>
                    <span className={styles.label}>Finished</span>
                    <input type="date" className={styles.dateInput} value={isoDay(book.finishedAt)} onChange={(e) => save({ finishedAt: e.target.value || '' })} />
                </label>
                {book.startedAt && book.finishedAt && (
                    <span className={styles.muted}>
                        {formatDay(book.startedAt)} – {formatDay(book.finishedAt)}
                    </span>
                )}
            </div>
        </section>
    )
}
