import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { GoBackButton, SubmitButton, buttonClass } from '../Buttons'
import { TextInput } from '../FormOptions'
import { useAuthor, useSaveAuthor } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { useToast } from '../Toast'
import styles from '../FormPage.module.css'

// New author (/authors/new) and edit author (/authors/:id/edit)
export default function AuthorForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const [form, setForm] = useState({ firstName: '', lastName: '' })
    const { data: author } = useAuthor(id)
    const save = useSaveAuthor()

    useEffect(() => {
        if (author) setForm({ firstName: author.firstName || '', lastName: author.lastName || '' })
    }, [author])

    const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

    const handleSubmit = (event) => {
        event.preventDefault()
        save.mutate({ id, data: form }, {
            onSuccess: (saved) => {
                toast.success(id ? 'Author updated (their books were updated too)' : 'Author added')
                navigate(`/authors/${saved._id}`)
            },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t save the author.')),
        })
    }

    const cancelTo = id ? `/authors/${id}` : '/authors'
    const valid = form.firstName.trim() && form.lastName.trim()

    return (
        <div className={styles.page}>
            <GoBackButton to={cancelTo} label={id ? 'Back to author' : 'All authors'} />
            <h1 className={styles.title}>{id ? 'Edit author' : 'New author'}</h1>
            <form onSubmit={handleSubmit} className={styles.card}>
                <TextInput label="First name" name="firstName" value={form.firstName} onChange={onChange} required />
                <TextInput label="Last name" name="lastName" value={form.lastName} onChange={onChange} required />
                <div className={styles.actions}>
                    <SubmitButton isEditing={Boolean(id)} object="Author" disabled={save.isPending || !valid} />
                    <Link to={cancelTo} className={buttonClass('secondary')}>Cancel</Link>
                </div>
            </form>
        </div>
    )
}
