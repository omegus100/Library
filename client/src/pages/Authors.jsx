import React from 'react'
import { useAuthors, useCounts } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import IndexList from '../components/library/IndexList'

const compare = (a, b) => (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' })

export default function Authors() {
    const { isOwner } = useAuth()
    const { data: authors = [], error, isLoading } = useAuthors()
    const { data: counts } = useCounts()

    // Surname A–Z, then first name
    const items = [...authors]
        .sort((a, b) => compare(a.lastName, b.lastName) || compare(a.firstName, b.firstName))
        .map((a) => ({
            id: a._id,
            to: `/authors/${a._id}`,
            title: `${a.firstName === '-' ? '' : a.firstName} ${a.lastName}`.trim(),
            count: counts?.byAuthor?.[a._id] || 0,
        }))

    return (
        <IndexList
            heading="Authors"
            noun="author"
            items={items}
            isLoading={isLoading}
            error={error}
            addTo={isOwner ? '/authors/new' : null}
            addLabel="Add author"
            searchLabel="Search authors"
        />
    )
}
