import React, { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useBookList, useFacets } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import BookResults from '../components/library/BookResults'
import { BookGridSkeleton } from '../components/Skeleton'
import { errorMessage } from '../api/client'
import styles from './Library.module.css'

const SORTS = [
    { value: 'title', label: 'Title A–Z' },
    { value: 'author', label: 'Author A–Z' },
    { value: 'series', label: 'Series' },
    { value: 'recent', label: 'Recently added' },
    { value: 'published', label: 'Newest published' },
    { value: 'finished', label: 'Recently finished' },
    { value: 'rating', label: 'Highest rated' },
]

// Status chips. "wishlist" and "loaned" are special filters, not reading statuses.
const CHIPS = [
    { value: '', label: 'All' },
    { value: 'Currently Reading', label: 'Reading' },
    { value: 'Want To Read', label: 'Want to read' },
    { value: 'Read', label: 'Read' },
    { value: 'Did Not Finish', label: 'Didn’t finish' },
    { value: 'wishlist', label: 'Wishlist' },
    { value: 'loaned', label: 'Lent out', ownerOnly: true },
]

const PAGE = 60
const plural = (n) => `${n} ${n === 1 ? 'book' : 'books'}`

const readPref = (key, fallback) => { try { return localStorage.getItem(key) || fallback } catch { return fallback } }
const savePref = (key, value) => { try { localStorage.setItem(key, value) } catch { /* ignore */ } }

export default function Library() {
    const { isOwner } = useAuth()
    const [params, setParams] = useSearchParams()
    const [query, setQuery] = useState(params.get('q') || '')
    const [view, setView] = useState(() => readPref('library.view', 'grid'))
    const [limit, setLimit] = useState(PAGE)
    const searchRef = useRef(null)

    const status = params.get('status') || ''
    const sort = params.get('sort') || readPref('library.sort', 'title')
    const format = params.get('format') || ''
    const genre = params.get('genre') || ''
    const shelf = params.get('shelf') || ''
    const q = params.get('q') || ''

    const setParam = (key, value) => {
        const next = new URLSearchParams(params)
        if (value) next.set(key, value)
        else next.delete(key)
        setParams(next, { replace: true })
        setLimit(PAGE)
    }

    // Search as you type (debounced) -> ?q=
    useEffect(() => {
        const t = setTimeout(() => { if (query.trim() !== q) setParam('q', query.trim()) }, 250)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query])

    // "/" jumps to search
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
            const tag = document.activeElement?.tagName
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return
            e.preventDefault()
            searchRef.current?.focus()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    const listParams = {
        q: q || undefined,
        sort,
        format: format || undefined,
        genre: genre || undefined,
        shelf: shelf || undefined,
        status: !['wishlist', 'loaned'].includes(status) && status ? status : undefined,
        owned: status === 'wishlist' ? 'false' : status === 'loaned' ? 'all' : 'true',
        loaned: status === 'loaned' ? 'true' : undefined,
        limit,
    }
    const { data, isLoading, isFetching, error } = useBookList(listParams)
    const { data: facets } = useFacets()

    const books = data?.items || []
    const total = data?.total ?? 0
    const filtered = Boolean(q || status || format || genre || shelf)
    const clearAll = () => { setQuery(''); setParams(new URLSearchParams(sort !== 'title' ? { sort } : {}), { replace: true }) }

    return (
        <div className={styles.page}>
            <div className={styles.titleRow}>
                <h1 className={styles.title}>{status === 'wishlist' ? 'Wishlist' : 'Your books'}</h1>
                {data && <span className={styles.count} aria-live="polite">{filtered ? `${total} found` : plural(total)}</span>}
                <nav className={styles.browse} aria-label="Browse">
                    Browse by <Link to="/authors">author</Link> · <Link to="/series">series</Link> · <Link to="/genres">genre</Link>
                </nav>
            </div>

            <form role="search" className={styles.controls} onSubmit={(e) => e.preventDefault()}>
                <label htmlFor="library-search" className="sr-only">Search your library</label>
                <div className={styles.searchBox}>
                    <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                        id="library-search"
                        ref={searchRef}
                        type="search"
                        className={styles.searchInput}
                        placeholder="Search by title, author, series or ISBN"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
                        autoComplete="off"
                    />
                    {query ? (
                        <button type="button" className={styles.clearButton} onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Clear search">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                    ) : (
                        <kbd className={styles.shortcut} title="Press / to search">/</kbd>
                    )}
                </div>

                <div className={styles.chips} role="group" aria-label="Filter by status">
                    {CHIPS.filter((c) => !c.ownerOnly || isOwner).map((chip) => {
                        const count = chip.value === 'wishlist' ? facets?.wishlist
                            : chip.value === 'loaned' ? facets?.loaned
                            : chip.value ? facets?.statuses?.[chip.value] : null
                        // Hide chips with nothing behind them (but keep the active one so it can be turned off)
                        if (chip.value && !count && status !== chip.value) return null
                        return (
                            <button key={chip.value || 'all'} type="button" className={styles.chip} aria-pressed={status === chip.value} onClick={() => setParam('status', chip.value)}>
                                {chip.label}{count ? <span className={styles.chipCount}>{count}</span> : null}
                            </button>
                        )
                    })}
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.filters}>
                        <Select label="Sort" id="lib-sort" value={sort} onChange={(v) => { savePref('library.sort', v); setParam('sort', v === 'title' ? '' : v) }} options={SORTS} />
                        {facets?.formats?.length > 1 && (
                            <Select label="Format" id="lib-format" value={format} onChange={(v) => setParam('format', v)} options={[{ value: '', label: 'Any' }, ...facets.formats.map((f) => ({ value: f.value, label: `${f.value} (${f.count})` }))]} />
                        )}
                        {facets?.genres?.length > 1 && (
                            <Select label="Genre" id="lib-genre" value={genre} onChange={(v) => setParam('genre', v)} options={[{ value: '', label: 'Any' }, ...facets.genres.map((g) => ({ value: g.value, label: `${g.value} (${g.count})` }))]} />
                        )}
                        {facets?.shelves?.length > 0 && (
                            <Select label="Shelf" id="lib-shelf" value={shelf} onChange={(v) => setParam('shelf', v)} options={[{ value: '', label: 'Any' }, ...facets.shelves.map((s) => ({ value: s.value, label: `${s.value} (${s.count})` }))]} />
                        )}
                        {filtered && <button type="button" className={styles.clearFilters} onClick={clearAll}>Clear filters</button>}
                    </div>
                    <div className={styles.viewToggle} role="group" aria-label="View">
                        <button type="button" className={styles.viewButton} aria-pressed={view === 'grid'} onClick={() => { setView('grid'); savePref('library.view', 'grid') }}>Grid</button>
                        <button type="button" className={styles.viewButton} aria-pressed={view === 'list'} onClick={() => { setView('list'); savePref('library.view', 'list') }}>List</button>
                    </div>
                </div>
            </form>

            {isLoading ? (
                <BookGridSkeleton />
            ) : error ? (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>Couldn’t load your books</p>
                    <p className={styles.message}>{errorMessage(error)}</p>
                </div>
            ) : total === 0 && !filtered ? (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{status === 'wishlist' ? 'Your wishlist is empty' : 'Your library is empty'}</p>
                    {isOwner && <Link to="/books/new/search" className={styles.emptyAction}>Add your first book</Link>}
                </div>
            ) : total === 0 ? (
                <div className={styles.empty}>
                    <p className={styles.emptyTitle}>{q ? `No books match “${q}”` : 'No books match these filters'}</p>
                    <p className={styles.message}>
                        <button type="button" className={styles.linkButton} onClick={clearAll}>Clear filters</button>
                        {isOwner && <> or <Link to={`/books/new/search${q ? `?q=${encodeURIComponent(q)}` : ''}`}>add it to your library</Link></>}.
                    </p>
                </div>
            ) : (
                <>
                    <div style={{ opacity: isFetching ? 0.7 : 1, transition: 'opacity 120ms' }}>
                        <BookResults books={books} view={view} />
                    </div>
                    {books.length < total && (
                        <button type="button" className={styles.more} onClick={() => setLimit((n) => n + PAGE)} disabled={isFetching}>
                            {isFetching ? 'Loading…' : `Show more (${total - books.length} left)`}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}

function Select({ label, id, value, onChange, options }) {
    return (
        <div className={styles.sort}>
            <label htmlFor={id} className={styles.sortLabel}>{label}</label>
            <select id={id} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    )
}
