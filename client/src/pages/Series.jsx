import React from 'react'
import { useCounts, useSeriesList } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import IndexList from '../components/library/IndexList'

const titleKey = (t) => (t || '').replace(/^(the|a|an)\s+/i, '')

export default function Series() {
    const { isOwner } = useAuth()
    const { data: series = [], error, isLoading } = useSeriesList()
    const { data: counts } = useCounts()

    const items = [...series]
        .sort((a, b) => titleKey(a.title).localeCompare(titleKey(b.title), undefined, { sensitivity: 'base' }))
        .map((s) => ({
            id: s._id,
            to: `/series/${s._id}`,
            title: s.title,
            subtitle: s.author?.firstName || s.author?.lastName ? `${s.author.firstName || ''} ${s.author.lastName || ''}`.trim() : '',
            count: counts?.bySeries?.[s._id] || 0,
        }))

    return (
        <IndexList
            heading="Series"
            noun="series"
            nounPlural="series"
            items={items}
            isLoading={isLoading}
            error={error}
            addTo={isOwner ? '/series/new' : null}
            addLabel="Add series"
            searchLabel="Search series"
        />
    )
}
