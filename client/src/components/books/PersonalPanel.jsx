import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePatchBook, useFacets } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { useToast } from '../Toast'
import { buttonClass } from '../Buttons'
import styles from './PersonalPanel.module.css'

const formatDay = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '')

// Shelves, wishlist, loan and private notes. Owner only (visitors see shelves as links).
export default function PersonalPanel({ book, editable }) {
    const patch = usePatchBook()
    const toast = useToast()
    const { data: facets } = useFacets()
    const [notes, setNotes] = useState(book.notes || '')
    const [shelfInput, setShelfInput] = useState('')
    const [lendTo, setLendTo] = useState('')
    useEffect(() => setNotes(book.notes || ''), [book.notes])

    const save = (data, message) =>
        patch.mutate({ id: book._id, data }, {
            onSuccess: () => message && toast.success(message),
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t save that change.')),
        })

    const shelves = book.shelves || []

    if (!editable) {
        if (!shelves.length) return null
        return (
            <section className={styles.panel} aria-label="Shelves">
                <div className={styles.shelves}>
                    {shelves.map((s) => <Link key={s} to={`/library?shelf=${encodeURIComponent(s)}`} className={styles.shelf}>{s}</Link>)}
                </div>
            </section>
        )
    }

    const addShelf = (e) => {
        e.preventDefault()
        const name = shelfInput.trim()
        if (!name || shelves.some((s) => s.toLowerCase() === name.toLowerCase())) { setShelfInput(''); return }
        save({ shelves: [...shelves, name] }, `Added to “${name}”`)
        setShelfInput('')
    }

    return (
        <section className={styles.panel} aria-label="Your copy">
            <div className={styles.block}>
                <span className={styles.label}>Shelves</span>
                <div className={styles.shelves}>
                    {shelves.map((s) => (
                        <span key={s} className={styles.shelf}>
                            <Link to={`/library?shelf=${encodeURIComponent(s)}`}>{s}</Link>
                            <button type="button" className={styles.removeShelf} aria-label={`Remove from ${s}`} onClick={() => save({ shelves: shelves.filter((x) => x !== s) })}>×</button>
                        </span>
                    ))}
                    <form onSubmit={addShelf} className={styles.inline}>
                        <label htmlFor="add-shelf" className="sr-only">Add a shelf</label>
                        <input id="add-shelf" className={styles.input} placeholder="Add a shelf…" value={shelfInput} onChange={(e) => setShelfInput(e.target.value)} list="shelf-suggestions" />
                        <datalist id="shelf-suggestions">
                            {(facets?.shelves || []).filter((s) => !shelves.includes(s.value)).map((s) => <option key={s.value} value={s.value} />)}
                        </datalist>
                    </form>
                </div>
            </div>

            <div className={styles.block}>
                <span className={styles.label}>Copy</span>
                <div className={styles.inline}>
                    {book.owned === false ? (
                        <>
                            <span className={styles.badgeWish}>On your wishlist</span>
                            <button type="button" className={buttonClass('secondary')} onClick={() => save({ owned: true }, 'Moved to your library')}>I own it now</button>
                        </>
                    ) : (
                        <button type="button" className={styles.textButton} onClick={() => save({ owned: false }, 'Moved to your wishlist')}>Move to wishlist</button>
                    )}
                </div>
            </div>

            {book.owned !== false && (
                <div className={styles.block}>
                    <span className={styles.label}>Loan</span>
                    {book.loanedTo ? (
                        <div className={styles.inline}>
                            <span>Lent to <strong>{book.loanedTo}</strong>{book.loanedAt ? ` on ${formatDay(book.loanedAt)}` : ''}</span>
                            <button type="button" className={buttonClass('secondary')} onClick={() => save({ loanedTo: '' }, 'Marked as returned')}>Returned</button>
                        </div>
                    ) : (
                        <form className={styles.inline} onSubmit={(e) => { e.preventDefault(); if (lendTo.trim()) { save({ loanedTo: lendTo.trim() }, `Lent to ${lendTo.trim()}`); setLendTo('') } }}>
                            <label htmlFor="lend-to" className="sr-only">Lend to</label>
                            <input id="lend-to" className={styles.input} placeholder="Lend to…" value={lendTo} onChange={(e) => setLendTo(e.target.value)} />
                            <button type="submit" className={buttonClass('secondary')} disabled={!lendTo.trim()}>Lend</button>
                        </form>
                    )}
                </div>
            )}

            <div className={styles.block}>
                <label htmlFor="book-notes" className={styles.label}>Notes <span className={styles.private}>(only you see these)</span></label>
                <textarea
                    id="book-notes"
                    className={styles.notes}
                    rows={4}
                    value={notes}
                    placeholder="Thoughts, quotes, where you bought it…"
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => { if (notes !== (book.notes || '')) save({ notes }, 'Notes saved') }}
                />
            </div>
        </section>
    )
}
