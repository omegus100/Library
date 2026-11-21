import React from "react"
import { useParams, useLocation } from "react-router-dom"
import { useBookList } from "../api/hooks"
import CollectionPage from "../components/library/CollectionPage"

// Books for one genre (/genres/:id) or one format (/format/:id), filtered on the server
export default function BookObjects() {
    const { id } = useParams()
    const location = useLocation()
    const isGenre = location.pathname.startsWith('/genres')
    const { data, error, isLoading } = useBookList({ [isGenre ? 'genre' : 'format']: id, sort: 'title', owned: 'all', limit: 500 })
    const books = data?.items || []
    const field = isGenre ? 'genres' : 'format'
    // Show the value as it's written on the books ("Science Fiction", not "science fiction")
    const display = books[0]?.[field]?.find((v) => v.toLowerCase() === id.toLowerCase()) || id

    return (
        <CollectionPage
            backTo={isGenre ? '/genres' : '/format'}
            backLabel={isGenre ? 'All genres' : 'All formats'}
            kicker={isGenre ? 'Genre' : 'Format'}
            title={display}
            books={books}
            isLoading={isLoading}
            error={error}
        />
    )
}
