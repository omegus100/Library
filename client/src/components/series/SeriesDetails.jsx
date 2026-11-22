import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EditButton, DeleteButton } from '../Buttons'
import { useBookList, useDeleteSeries, useSeries } from '../../api/hooks'
import { errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../Toast'
import CollectionPage from '../library/CollectionPage'

export default function SeriesDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const { isOwner } = useAuth()
    const { data: series, error, isLoading } = useSeries(id)
    const { data: list, isLoading: booksLoading } = useBookList({ seriesId: id, sort: 'series', owned: 'all', limit: 500 })
    const remove = useDeleteSeries()
    const books = list?.items || []

    const handleDelete = () => {
        if (books.length) {
            toast.error(`This series still has ${books.length} book(s). Remove them from the series first.`)
            return
        }
        if (!window.confirm(`Delete the series “${series.title}”? This can’t be undone.`)) return
        remove.mutate(id, {
            onSuccess: () => { toast.success(`Deleted “${series.title}”`); navigate('/series') },
            onError: (err) => toast.error(errorMessage(err, 'Couldn’t delete the series.')),
        })
    }

    const author = series?.author ? `${series.author.firstName || ''} ${series.author.lastName || ''}`.trim() : ''

    return (
        <CollectionPage
            backTo="/series"
            backLabel="All series"
            kicker="Series"
            title={isLoading ? 'Loading…' : error ? 'Series not found' : series?.title}
            subtitle={author}
            books={books}
            isLoading={isLoading || booksLoading}
            error={error}
            emptyText="No books in this series yet."
            actions={series && isOwner && (
                <>
                    <EditButton onClick={() => navigate(`/series/${id}/edit`)} />
                    <DeleteButton onClick={handleDelete} />
                </>
            )}
        />
    )
}
