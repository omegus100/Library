import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import * as bookObjects from './bookObjects'
import { useAuthors, useBook, useSaveBook, useSeriesList } from '../../api/hooks'
import { apiUrl, errorMessage } from '../../api/client'
import { TextInput, SelectInput, TextAreaInput } from '../FormOptions'
import { GoBackButton, SubmitButton, buttonClass } from '../Buttons'
import FileUploader from '../FileUpload'
import { useToast } from '../Toast'
import { resizeImage } from '../../utils/image'
import styles from './BookForm.module.css'

// Format and genres are stored as lists; the form edits the first value of each
const first = (value) => (Array.isArray(value) ? value[0] || '' : value || '')
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')
// Keep a value that isn't in the preset list (e.g. a Google category) selectable
const withValue = (options, value) => (value && !options.includes(value) ? [value, ...options] : options)

const empty = {
    title: '', description: '', publishDate: '', pageCount: '', format: '', genres: '',
    authorId: '', seriesId: '', seriesVolume: '', publisher: '', isbn: '',
    readingStatus: '', startedAt: '', finishedAt: '', currentPage: '', rating: '',
    shelves: '', owned: true, loanedTo: '', notes: '',
}

// New book (/books/new) and edit book (/books/:id/edit)
export default function BookForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const [form, setForm] = useState(empty)
    const [cover, setCover] = useState({ dataUrl: '', remove: false })
    const initialCover = useRef('')

    const { data: book } = useBook(id)
    const { data: authors = [] } = useAuthors()
    const { data: series = [] } = useSeriesList()
    const save = useSaveBook()

    useEffect(() => {
        if (!book) return
        initialCover.current = book.coverUrl ? apiUrl(book.coverUrl) : ''
        setForm({
            title: book.title || '',
            description: book.description || '',
            publishDate: day(book.publishDate),
            pageCount: book.pageCount ?? '',
            format: first(book.format),
            genres: first(book.genres),
            authorId: book.author?.id || '',
            seriesId: book.series?.id || '',
            seriesVolume: book.series?.volume ?? '',
            publisher: book.publisher || '',
            isbn: book.isbn || '',
            readingStatus: book.readingStatus || '',
            startedAt: day(book.startedAt),
            finishedAt: day(book.finishedAt),
            currentPage: book.currentPage ?? '',
            rating: book.rating || '',
            shelves: (book.shelves || []).join(', '),
            owned: book.owned !== false,
            loanedTo: book.loanedTo || '',
            notes: book.notes || '',
        })
    }, [book])

    const set = (changes) => setForm((prev) => ({ ...prev, ...changes }))
    const onChange = (e) => set({ [e.target.name]: e.target.value })

    // FilePond reports the existing cover too; only react to a new file or a removal
    const onCoverChange = async (items) => {
        const item = items[0]
        if (!item) { if (initialCover.current) setCover({ dataUrl: '', remove: true }); return }
        if (typeof item.source === 'string' && item.source === initialCover.current) return
        if (!(item.file instanceof Blob)) return
        try {
            setCover({ dataUrl: await resizeImage(item.file), remove: false })
        } catch (err) {
            toast.error(err.message)
        }
    }

    const handleSubmit = (event) => {
        event.preventDefault()
        const data = { ...form, seriesVolume: form.seriesId ? form.seriesVolume : '' }
        if (cover.dataUrl) data.coverImage = cover.dataUrl
        if (cover.remove) data.removeCover = true
        save.mutate({ id, data }, {
            onSuccess: (saved) => {
                toast.success(id ? 'Changes saved' : `Added “${saved.title}”`)
                navigate(`/books/${saved._id}`)
            },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t save the book.')),
        })
    }

    const cancelTo = id ? `/books/${id}` : '/library'

    return (
        <div className={styles.page}>
            <GoBackButton to={cancelTo} label={id ? 'Back to book' : 'All books'} />
            <h1 className={styles.title}>{id ? 'Edit book' : 'New book'}</h1>

            <form onSubmit={handleSubmit} className={styles.form}>
                <fieldset className={styles.section}>
                    <legend className={styles.legend}>Book</legend>
                    <TextInput label="Title" name="title" value={form.title} onChange={onChange} required wide />
                    <SelectInput label="Author" name="authorId" value={form.authorId} options={authors} onChange={onChange} link="/authors/new" linkText="Add a new author" />
                    <SelectInput label="Series" name="seriesId" value={form.seriesId} options={series} onChange={onChange} placeholder="Not in a series" link="/series/new" linkText="Add a new series" />
                    {form.seriesId && <TextInput label="Book number in series" name="seriesVolume" type="number" inputMode="numeric" min="0" value={form.seriesVolume} onChange={onChange} />}
                </fieldset>

                <fieldset className={styles.section}>
                    <legend className={styles.legend}>Details</legend>
                    <SelectInput label="Format" name="format" value={form.format} options={withValue(bookObjects.formats, form.format)} onChange={onChange} />
                    <SelectInput label="Genre" name="genres" value={form.genres} options={withValue(bookObjects.genres, form.genres)} onChange={onChange} />
                    <TextInput label="Published" name="publishDate" type="date" value={form.publishDate} onChange={onChange} />
                    <TextInput label="Pages" name="pageCount" type="number" inputMode="numeric" min="0" value={form.pageCount} onChange={onChange} />
                    <TextInput label="Publisher" name="publisher" value={form.publisher} onChange={onChange} />
                    <TextInput label="ISBN" name="isbn" value={form.isbn} onChange={onChange} />
                    <TextInput label="Shelves" name="shelves" value={form.shelves} onChange={onChange} placeholder="favorites, signed, to lend" hint="Separate with commas" wide />
                </fieldset>

                <fieldset className={styles.section}>
                    <legend className={styles.legend}>Reading</legend>
                    <SelectInput label="Status" name="readingStatus" value={form.readingStatus} options={bookObjects.readingStatus} onChange={onChange} placeholder="None" />
                    <SelectInput label="Rating" name="rating" value={String(form.rating || '')} options={['1', '2', '3', '4', '5']} onChange={onChange} placeholder="Not rated" />
                    <TextInput label="Started" name="startedAt" type="date" value={form.startedAt} onChange={onChange} />
                    <TextInput label="Finished" name="finishedAt" type="date" value={form.finishedAt} onChange={onChange} />
                    <TextInput label="Current page" name="currentPage" type="number" inputMode="numeric" min="0" value={form.currentPage} onChange={onChange} />
                </fieldset>

                <fieldset className={styles.section}>
                    <legend className={styles.legend}>Your copy</legend>
                    <label className={`${styles.check} ${styles.wide}`}>
                        <input type="checkbox" checked={form.owned} onChange={(e) => set({ owned: e.target.checked })} />
                        <span>I own this book <span className={styles.muted}>(untick to keep it on your wishlist)</span></span>
                    </label>
                    {form.owned && <TextInput label="Lent to" name="loanedTo" value={form.loanedTo} onChange={onChange} placeholder="Nobody" />}
                    <TextAreaInput label="Private notes" name="notes" value={form.notes} onChange={onChange} rows={3} />
                </fieldset>

                <fieldset className={styles.section}>
                    <legend className={styles.legend}>Cover and description</legend>
                    <div className={styles.wide}>
                        <FileUploader files={initialCover.current} onUpdateFiles={onCoverChange} />
                    </div>
                    <TextAreaInput label="Description" name="description" value={form.description} onChange={onChange} rows={6} />
                </fieldset>

                <div className={styles.actions}>
                    <SubmitButton isEditing={Boolean(id)} object="Book" disabled={save.isPending || !form.title.trim()} />
                    <Link to={cancelTo} className={buttonClass('secondary')}>Cancel</Link>
                </div>
            </form>
        </div>
    )
}
