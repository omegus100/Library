import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuthors, useSaveSeries, useSeries } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { GoBackButton, SubmitButton, buttonClass } from '../Buttons'
import { TextInput, SelectInput } from '../FormOptions'
import { useToast } from '../Toast'
import styles from '../FormPage.module.css'

// New series (/series/new) and edit series (/series/:id/edit)
export default function SeriesForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const [form, setForm] = useState({ title: '', authorId: '' })
    const { data: authors = [] } = useAuthors()
    const { data: series } = useSeries(id)
    const save = useSaveSeries()

    useEffect(() => {
        if (series) setForm({ title: series.title || '', authorId: series.author?.id || '' })
    }, [series])

    const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

    const handleSubmit = (event) => {
        event.preventDefault()
        save.mutate({ id, data: form }, {
            onSuccess: (saved) => {
                toast.success(id ? 'Series updated' : 'Series added')
                navigate(`/series/${saved._id}`)
            },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t save the series.')),
        })
    }

    const cancelTo = id ? `/series/${id}` : '/series'
    const valid = form.title.trim() && form.authorId

    return (
        <div className={styles.page}>
            <GoBackButton to={cancelTo} label={id ? 'Back to series' : 'All series'} />
            <h1 className={styles.title}>{id ? 'Edit series' : 'New series'}</h1>
            <form onSubmit={handleSubmit} className={styles.card}>
                <TextInput label="Title" name="title" value={form.title} onChange={onChange} required />
                <SelectInput label="Author" name="authorId" value={form.authorId} options={authors} onChange={onChange} link="/authors/new" linkText="Add a new author" />
                <div className={styles.actions}>
                    <SubmitButton isEditing={Boolean(id)} object="Series" disabled={save.isPending || !valid} />
                    <Link to={cancelTo} className={buttonClass('secondary')}>Cancel</Link>
                </div>
            </form>
        </div>
    )
}
