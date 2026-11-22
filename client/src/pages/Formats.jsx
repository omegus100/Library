import React from 'react'
import { useFacets } from '../api/hooks'
import IndexList from '../components/library/IndexList'

// Every format on your books (Hardback, eBook, Audiobook...), with counts
export default function Formats() {
    const { data, error, isLoading } = useFacets()
    const items = (data?.formats || []).map((f) => ({
        id: f.value,
        to: `/format/${encodeURIComponent(f.value)}`,
        title: f.value,
        count: f.count,
    }))
    return <IndexList heading="Formats" noun="format" items={items} isLoading={isLoading} error={error} searchLabel="Search formats" />
}
