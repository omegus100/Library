import React from 'react'
import { useFacets } from '../api/hooks'
import IndexList from '../components/library/IndexList'

// Every genre on your books, with counts
export default function Genres() {
    const { data, error, isLoading } = useFacets()
    const items = (data?.genres || []).map((g) => ({
        id: g.value,
        to: `/genres/${encodeURIComponent(g.value.toLowerCase())}`,
        title: g.value,
        count: g.count,
    }))
    return <IndexList heading="Genres" noun="genre" items={items} isLoading={isLoading} error={error} searchLabel="Search genres" />
}
