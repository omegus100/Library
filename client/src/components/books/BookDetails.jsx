import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { GoBackButton, buttonClass } from '../Buttons'
import { useBook, useBookList, useDeleteBook, useRefreshBook } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../Toast'
import { DetailSkeleton } from '../Skeleton'
import Cover from '../library/Cover'
import BookStrip from '../library/BookStrip'
import ReadingPanel from './ReadingPanel'
import PersonalPanel from './PersonalPanel'
import { authorName } from '../../utils/bookSort'
import styles from './BookDetails.module.css'

// Dates are stored as midnight UTC; show them in UTC so they don't slip a day
const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : null

const LinkList = ({ items, to }) =>
    items.map((item, i) => (
        <React.Fragment key={item}>
            {i > 0 && ', '}
            <Link to={to(item)}>{item}</Link>
        </React.Fragment>
    ))

const FIELD_NAMES = { description: 'description', publisher: 'publisher', pageCount: 'page count', isbn: 'ISBN', publishDate: 'publish date', genres: 'genres', cover: 'cover' }

export default function BookDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const { isOwner } = useAuth()
    const { data: book, error, isLoading } = useBook(id)
    const seriesId = book?.series?.id
    const authorId = book?.author?.id
    const { data: seriesData } = useBookList({ seriesId, sort: 'series', owned: 'all', limit: 100 }, { enabled: Boolean(seriesId) })
    const { data: authorData } = useBookList({ authorId, sort: 'series', owned: 'all', limit: 100 }, { enabled: Boolean(authorId) })
    const remove = useDeleteBook()
    const refresh = useRefreshBook()

    const handleDelete = () => {
        if (!window.confirm(`Delete “${book.title}”? This can’t be undone.`)) return
        remove.mutate(id, {
            onSuccess: () => { toast.success(`Deleted “${book.title}”`); navigate('/library') },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t delete the book.')),
        })
    }

    const handleRefresh = () =>
        refresh.mutate(id, {
            onSuccess: ({ filled }) => toast.success(filled.length
                ? `Filled in ${filled.map((f) => FIELD_NAMES[f] || f).join(', ')}`
                : 'Nothing missing: your details are already complete'),
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t look up details.')),
        })

    if (isLoading) return <div className={styles.page}><GoBackButton to="/library" label="All books" /><DetailSkeleton /></div>
    if (error || !book) {
        return (
            <div className={styles.page}>
                <GoBackButton to="/library" label="All books" />
                <p className={styles.message}>{error?.response?.status === 404 ? 'This book isn’t in your library.' : errorMessage(error, 'Couldn’t load this book.')}</p>
            </div>
        )
    }

    const seriesBooks = (seriesData?.items || [])
    const authorBooks = (authorData?.items || []).filter((b) => b._id !== book._id && (!seriesId || b.series?.id !== seriesId))

    const facts = [
        seriesId && { label: 'Series', value: <Link to={`/series/${seriesId}`}>{book.series.title}{book.series.volume ? ` · Book ${book.series.volume}` : ''}</Link> },
        book.format?.length > 0 && { label: 'Format', value: <LinkList items={book.format} to={(f) => `/format/${encodeURIComponent(f)}`} /> },
        book.ebook && {
            label: 'Ebook',
            value: book.ebook.missing
                ? <span className={styles.muted}>No longer in Calibre</span>
                : <>{book.ebook.formats.join(', ') || 'In Calibre'}{book.ebook.link && <> · <a href={book.ebook.link} target="_blank" rel="noreferrer">Read in Calibre-Web ↗</a></>}</>,
        },
        book.genres?.length > 0 && { label: book.genres.length > 1 ? 'Genres' : 'Genre', value: <LinkList items={book.genres} to={(g) => `/genres/${encodeURIComponent(g.toLowerCase())}`} /> },
        book.pageCount && { label: 'Pages', value: book.pageCount },
        book.publishDate && { label: 'Published', value: formatDate(book.publishDate) },
        book.publisher && { label: 'Publisher', value: book.publisher },
        book.isbn && { label: 'ISBN', value: book.isbn },
        book.createdAt && { label: 'Added', value: formatDate(book.createdAt) },
    ].filter(Boolean)

    const name = authorName(book)

    return (
        <div className={styles.page}>
            <GoBackButton to="/library" label="All books" />

            <article className={styles.main}>
                <div className={styles.cover}>
                    <Cover book={book} />
                </div>

                <div className={styles.info}>
                    <header className={styles.header}>
                        <h1 className={styles.title}>{book.title}</h1>
                        {name && (authorId
                            ? <Link to={`/authors/${authorId}`} className={styles.author}>{name}</Link>
                            : <span className={styles.author}>{name}</span>)}
                    </header>

                    <ReadingPanel book={book} editable={isOwner} />

                    {facts.length > 0 && (
                        <dl className={styles.facts}>
                            {facts.map((fact) => (
                                <div key={fact.label} className={styles.fact}>
                                    <dt>{fact.label}</dt>
                                    <dd>{fact.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {book.description && <p className={styles.description}>{book.description}</p>}

                    <PersonalPanel book={book} editable={isOwner} />

                    {isOwner && (
                        <div className={styles.actions}>
                            <Link to={`/books/${book._id}/edit`} className={buttonClass('secondary')}>Edit details</Link>
                            <button type="button" className={buttonClass('secondary')} onClick={handleRefresh} disabled={refresh.isPending}>
                                {refresh.isPending ? 'Looking up…' : 'Fill missing details'}
                            </button>
                            <button type="button" className={buttonClass('danger')} onClick={handleDelete} disabled={remove.isPending}>Delete</button>
                        </div>
                    )}
                </div>
            </article>

            {seriesBooks.length > 1 && (
                <BookStrip
                    title={`${book.series.title} series`}
                    books={seriesBooks}
                    caption={(b) => (b.series?.volume ? `Book ${b.series.volume}` : '')}
                />
            )}
            {authorBooks.length > 0 && <BookStrip title={`More by ${name}`} books={authorBooks} />}
        </div>
    )
}
