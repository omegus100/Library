import React, { useState } from 'react'
import { buttonClass } from '../components/Buttons'
import styles from './Settings.module.css'
import pick from './CalibreSettings.module.css'

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`
const FIELD_NAMES = { readingStatus: 'status', finishedAt: 'date read', pageCount: 'pages', publishDate: 'published', isbn: 'ISBN' }
const seriesLabel = (b) => (b.series ? `${b.series}${b.seriesVolume ? ` #${b.seriesVolume}` : ''}` : '')

// Import preview: what will be added, what existing books get filled in, and which unrated books go to the wishlist.
// onImport({ wishlist: [row], fillExisting })
export default function ImportPreview({ preview, busy, onImport, onCancel }) {
    const [wishlist, setWishlist] = useState(() => new Set())
    const [fillExisting, setFillExisting] = useState(true)
    // Defaults keep this working against an older server that doesn't send every field
    const { created = 0, wishlistCount = 0, readCount = 0, items = [], unrated = [], fill = { count: 0, items: [] }, skipped = [] } = preview

    const toggle = (row) => setWishlist((prev) => {
        const next = new Set(prev)
        next.has(row) ? next.delete(row) : next.add(row)
        return next
    })
    const allPicked = unrated.length > 0 && unrated.every((u) => wishlist.has(u.row))
    const total = created + (fillExisting ? fill.count : 0)

    return (
        <div className={styles.preview}>
            <p>
                <strong>{plural(created, 'new book')}</strong>
                {created > 0 && <> — {readCount} read, {wishlistCount + wishlist.size} to the wishlist</>}
                {skipped.length > 0 && <>, {skipped.length} skipped</>}.
            </p>
            {items.length > 0 && (
                <details>
                    <summary className={styles.muted}>See the new books</summary>
                    <ul className={styles.previewList}>
                        {items.map((b, i) => (
                            <li key={i}>
                                {b.title}{b.author ? ` — ${b.author}` : ''}
                                {seriesLabel(b) && <span className={styles.muted}> · {seriesLabel(b)}</span>}
                                {b.owned === false && <span className={styles.muted}> · wishlist</span>}
                                {b.readingStatus === 'Read' && <span className={styles.muted}> · read</span>}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {fill.count > 0 && (
                <div className={pick.picker}>
                    <label className={pick.check}>
                        <input type="checkbox" checked={fillExisting} onChange={(e) => setFillExisting(e.target.checked)} />
                        Fill in missing details on {plural(fill.count, 'book')} you already have
                    </label>
                    <ul className={styles.previewList}>
                        {fill.items.map((f, i) => (
                            <li key={i}>{f.title}: <span className={styles.muted}>{f.fields.map((x) => FIELD_NAMES[x] || x).join(', ')}</span></li>
                        ))}
                    </ul>
                    <p className={styles.muted}>Only empty fields are filled. Nothing you’ve entered is changed.</p>
                </div>
            )}

            {unrated.length > 0 && (
                <div className={pick.picker}>
                    <p>
                        <strong>{plural(unrated.length, 'book')} without a rating</strong> won’t be marked as read.
                        Tick any that belong on your wishlist; the rest go into your library with no status.
                    </p>
                    <div className={pick.toolbar}>
                        <label className={pick.check}>
                            <input type="checkbox" checked={allPicked}
                                onChange={() => setWishlist(allPicked ? new Set() : new Set(unrated.map((u) => u.row)))} />
                            Select all {unrated.length}
                        </label>
                        <span className={styles.muted}>{wishlist.size} to the wishlist</span>
                    </div>
                    <ul className={pick.list}>
                        {unrated.map((u) => (
                            <li key={u.row}>
                                <label className={pick.item}>
                                    <input type="checkbox" checked={wishlist.has(u.row)} onChange={() => toggle(u.row)} />
                                    <span className={pick.text}>
                                        <span className={pick.title}>{u.title}</span>
                                        <span className={styles.muted}>{[u.author, seriesLabel(u), u.shelf && `Goodreads shelf: ${u.shelf}`].filter(Boolean).join(' · ')}</span>
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {skipped.length > 0 && (
                <details>
                    <summary className={styles.muted}>Skipped ({skipped.length})</summary>
                    <ul className={styles.previewList}>
                        {skipped.slice(0, 100).map((s, i) => <li key={i}>{s.title}: {s.reason}</li>)}
                    </ul>
                </details>
            )}

            <div className={styles.row}>
                <button type="button" className={buttonClass('primary')} disabled={!total || busy}
                    onClick={() => onImport({ wishlist: [...wishlist], fillExisting })}>
                    {busy ? 'Importing…' : created ? `Import ${plural(created, 'book')}` : `Fill in ${plural(fill.count, 'book')}`}
                </button>
                <button type="button" className={buttonClass('secondary')} onClick={onCancel} disabled={busy}>Cancel</button>
            </div>
        </div>
    )
}
