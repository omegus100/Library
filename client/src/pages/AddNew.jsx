import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLookup, useSaveBook, useSummary } from '../api/hooks'
import { errorMessage } from '../api/client'
import { TextInput, TextAreaInput } from '../components/FormOptions'
import Cover from '../components/library/Cover'
import BarcodeScanner, { canScan } from '../components/BarcodeScanner'
import { GoBackButton, buttonClass } from '../components/Buttons'
import { useToast } from '../components/Toast'
import styles from './AddNew.module.css'

const norm = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase()
const normIsbn = (v) => String(v || '').replace(/[\s-]/g, '').toUpperCase()
const looksLikeIsbn = (v) => /^(97[89])?\d{9}[\dX]$/i.test(normIsbn(v))

const DETAIL_FIELDS = [
    { label: 'Title', name: 'title' },
    { label: 'Author', name: 'authorName' },
    { label: 'Published', name: 'publishDate' },
    { label: 'Pages', name: 'pageCount', type: 'number' },
    { label: 'Publisher', name: 'publisher' },
    { label: 'ISBN', name: 'isbn' },
]


export default function AddNewBook() {
    const toast = useToast()
    const [params] = useSearchParams()
    const [query, setQuery] = useState(params.get('q') || '')
    const [term, setTerm] = useState(null)
    const [edits, setEdits] = useState({}) // googleId -> edited fields
    const [expanded, setExpanded] = useState({})
    const [added, setAdded] = useState({}) // googleId -> { id, owned }
    const [scanning, setScanning] = useState(false)
    const searchRef = useRef(null)

    const { data: results = [], isFetching, error, isSuccess } = useLookup(term)
    const { data: summary = [] } = useSummary()
    const save = useSaveBook()

    useEffect(() => { searchRef.current?.focus() }, [])
    // Arriving with ?q= (from the Library's "add it" link): search right away
    useEffect(() => {
        const q = params.get('q')
        if (q) setTerm(looksLikeIsbn(q) ? { isbn: normIsbn(q) } : { q })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const search = (e) => {
        e?.preventDefault()
        const q = query.trim()
        if (!q) return
        setTerm(looksLikeIsbn(q) ? { isbn: normIsbn(q) } : { q })
        setExpanded({})
    }

    const onScan = useCallback((isbn) => {
        setScanning(false)
        setQuery(isbn)
        setTerm({ isbn: normIsbn(isbn) })
        toast.show(`Scanned ${isbn}`)
    }, [toast])
    const closeScanner = useCallback(() => setScanning(false), [])

    const findOwned = (book) => {
        const isbn = normIsbn(book.isbn)
        return summary.find((o) =>
            (isbn && normIsbn(o.isbn) === isbn) ||
            (norm(o.title) === norm(book.title) && norm(o.author?.lastName) === norm(book.authorLastName)))
    }

    const withEdits = (book) => ({ authorName: book.authors?.[0] || '', ...book, ...edits[book.googleId] })

    const add = (book, owned) => {
        const b = withEdits(book)
        const already = findOwned(b)
        if (already && !window.confirm(`“${already.title}” is already in your library. Add another copy?`)) return
        save.mutate({
            data: {
                title: b.title,
                authorName: b.authorName,
                description: b.description,
                publishDate: b.publishDate,
                pageCount: b.pageCount,
                genres: b.genres,
                publisher: b.publisher,
                isbn: b.isbn,
                coverUrl: b.coverUrl, // the server downloads and stores it
                owned,
            },
        }, {
            onSuccess: (saved) => {
                setAdded((prev) => ({ ...prev, [book.googleId]: { id: saved._id, owned } }))
                toast.success(owned ? `Added “${saved.title}”` : `Added “${saved.title}” to your wishlist`)
            },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t add this book.')),
        })
    }

    const lookupError = error && errorMessage(error, 'Search failed. Try again.')
    const lastTerm = term?.isbn || term?.q

    return (
        <div className={styles.page}>
            <GoBackButton to="/library" label="All books" />

            <div className={styles.intro}>
                <h1 className={styles.title}>Add a book</h1>
                <p className={styles.lede}>Search by title, author or ISBN{canScan() ? ', or scan the barcode' : ''}. Details and cover are filled in for you.</p>
            </div>

            <form role="search" className={styles.searchForm} onSubmit={search}>
                <label htmlFor="add-search" className="sr-only">Find a book</label>
                <input
                    id="add-search"
                    ref={searchRef}
                    type="search"
                    className={styles.searchInput}
                    placeholder="Title, author or ISBN"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                />
                <button type="submit" className={`${buttonClass('primary')} ${styles.searchButton}`} disabled={isFetching || !query.trim()}>
                    {isFetching ? 'Searching…' : 'Search'}
                </button>
                {canScan() && (
                    <button type="button" className={`${buttonClass('secondary')} ${styles.searchButton}`} onClick={() => setScanning(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8" /></svg>
                        Scan barcode
                    </button>
                )}
            </form>

            {scanning && <BarcodeScanner onDetect={onScan} onClose={closeScanner} />}

            <div aria-live="polite">
                {lookupError && (
                    <p className={styles.message}>{lookupError} You can also <Link to="/books/new">enter the details yourself</Link>.</p>
                )}
                {isSuccess && !isFetching && results.length === 0 && <p className={styles.message}>No books found for “{lastTerm}”.</p>}
                {results.length > 0 && <p className={styles.resultCount}>{results.length} results from Google Books</p>}
            </div>

            {results.length > 0 && (
                <ul className={styles.results}>
                    {results.map((raw) => {
                        const book = withEdits(raw)
                        const done = added[raw.googleId]
                        const already = !done && findOwned(book)
                        const year = String(book.publishDate || '').slice(0, 4)
                        // Google thumbnails display fine directly in <img>; the server downloads the full cover on Add
                        const preview = { title: book.title, coverPreview: book.coverUrl, author: { firstName: book.authorFirstName, lastName: book.authorLastName } }
                        return (
                            <li key={raw.googleId} className={styles.result}>
                                <div className={styles.row}>
                                    <Cover book={preview} size="sm" />
                                    <div className={styles.rowText}>
                                        <span className={styles.rowTitle}>{book.title || 'Untitled'}</span>
                                        <span className={styles.rowMeta}>{[book.authorName || 'Unknown author', year].filter(Boolean).join(' · ')}</span>
                                        <button type="button" className={styles.detailsToggle} aria-expanded={Boolean(expanded[raw.googleId])} onClick={() => setExpanded((p) => ({ ...p, [raw.googleId]: !p[raw.googleId] }))}>
                                            {expanded[raw.googleId] ? 'Hide details' : 'Check details'}
                                        </button>
                                    </div>
                                    <div className={styles.rowAction}>
                                        {done ? (
                                            <Link to={`/books/${done.id}`} className={styles.added}>{done.owned ? 'Added' : 'On wishlist'} · View</Link>
                                        ) : already ? (
                                            <span className={styles.ownedGroup}>
                                                <span className={styles.badge}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                                                    {already.owned === false ? 'On your wishlist' : 'In your library'}
                                                </span>
                                                <Link to={`/books/${already._id}`} className={styles.viewLink}>View</Link>
                                            </span>
                                        ) : (
                                            <span className={styles.addGroup}>
                                                <button type="button" className={buttonClass('outline')} onClick={() => add(raw, true)} disabled={save.isPending}>Add</button>
                                                <button type="button" className={styles.wishButton} onClick={() => add(raw, false)} disabled={save.isPending}>Wishlist</button>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {expanded[raw.googleId] && (
                                    <div className={styles.details}>
                                        {DETAIL_FIELDS.map((f) => (
                                            <TextInput
                                                key={f.name}
                                                label={f.label}
                                                name={`${f.name}-${raw.googleId}`}
                                                type={f.type || 'text'}
                                                value={book[f.name]}
                                                onChange={(e) => setEdits((p) => ({ ...p, [raw.googleId]: { ...p[raw.googleId], [f.name]: e.target.value } }))}
                                            />
                                        ))}
                                        <TextAreaInput
                                            label="Description"
                                            name={`description-${raw.googleId}`}
                                            value={book.description}
                                            onChange={(e) => setEdits((p) => ({ ...p, [raw.googleId]: { ...p[raw.googleId], description: e.target.value } }))}
                                            rows={5}
                                        />
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            <p className={styles.manual}>Can’t find it? <Link to="/books/new">Enter the details yourself</Link></p>
        </div>
    )
}
