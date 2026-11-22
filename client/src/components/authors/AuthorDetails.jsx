import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EditButton, DeleteButton } from '../Buttons'
import { useAuthor, useBookList, useDeleteAuthor } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../Toast'
import CollectionPage from '../library/CollectionPage'

export default function AuthorDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const { isOwner } = useAuth()
    const { data: author, error, isLoading } = useAuthor(id)
    const { data: list, isLoading: booksLoading } = useBookList({ authorId: id, sort: 'series', owned: 'all', limit: 500 })
    const remove = useDeleteAuthor()
    const books = list?.items || []
    const name = author ? `${author.firstName === '-' ? '' : author.firstName} ${author.lastName}`.trim() : ''

    const handleDelete = () => {
        if (books.length) {
            toast.error(`${name} still has ${books.length} book(s). Delete or reassign them first.`)
            return
        }
        if (!window.confirm(`Delete ${name}? This can’t be undone.`)) return
        remove.mutate(id, {
            onSuccess: () => { toast.success(`Deleted ${name}`); navigate('/authors') },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t delete the author.')),
        })
    }

    return (
        <CollectionPage
            backTo="/authors"
            backLabel="All authors"
            kicker="Author"
            title={isLoading ? 'Loading…' : error ? 'Author not found' : name}
            books={books}
            isLoading={isLoading || booksLoading}
            error={error}
            emptyText="No books by this author yet."
            actions={author && isOwner && (
                <>
                    <EditButton onClick={() => navigate(`/authors/${id}/edit`)} />
                    <DeleteButton onClick={handleDelete} />
                </>
            )}
        />
    )
}
