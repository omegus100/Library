// Every server read and write, as TanStack Query hooks. Pages use these instead of calling axios.
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { api } from './client'

const get = (url, params) => api.get(url, { params }).then((r) => r.data)

export const keys = {
    books: ['books'],
    bookList: (params) => ['books', 'list', params],
    book: (id) => ['books', 'detail', id],
    facets: ['books', 'facets'],
    counts: ['books', 'counts'],
    summary: ['books', 'summary'],
    authors: ['authors'],
    author: (id) => ['authors', id],
    seriesList: ['series'],
    series: (id) => ['series', id],
    stats: (year) => ['stats', year],
    settings: ['settings'],
    lookup: (term) => ['lookup', term],
}

// ---------- reads ----------

// Light, paged, server-filtered list: { items, total, page, pages }
export const useBookList = (params, options = {}) =>
    useQuery({ queryKey: keys.bookList(params), queryFn: () => get('/books', { view: 'list', ...params }), placeholderData: keepPreviousData, ...options })

export const useBook = (id) =>
    useQuery({ queryKey: keys.book(id), queryFn: () => get(`/books/${id}`), enabled: Boolean(id) })

export const useFacets = () => useQuery({ queryKey: keys.facets, queryFn: () => get('/books/facets') })
export const useCounts = () => useQuery({ queryKey: keys.counts, queryFn: () => get('/books/counts') })
export const useSummary = (enabled = true) => useQuery({ queryKey: keys.summary, queryFn: () => get('/books/summary'), enabled })

export const useAuthors = () => useQuery({ queryKey: keys.authors, queryFn: () => get('/authors') })
export const useAuthor = (id) => useQuery({ queryKey: keys.author(id), queryFn: () => get(`/authors/${id}`), enabled: Boolean(id) })
export const useSeriesList = () => useQuery({ queryKey: keys.seriesList, queryFn: () => get('/series') })
export const useSeries = (id) => useQuery({ queryKey: keys.series(id), queryFn: () => get(`/series/${id}`), enabled: Boolean(id) })

export const useStats = (year) => useQuery({ queryKey: keys.stats(year), queryFn: () => get('/stats', { year }) })
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => get('/settings') })

// Google Books search through the server (owner only); only runs when there's a term
export const useLookup = (term) =>
    useQuery({
        queryKey: keys.lookup(term),
        queryFn: () => get('/lookup', term.isbn ? { isbn: term.isbn } : { q: term.q }),
        enabled: Boolean(term && (term.q || term.isbn)),
        retry: false,
        staleTime: 10 * 60 * 1000,
    })

// ---------- writes ----------

const useInvalidate = () => {
    const qc = useQueryClient()
    return (...groups) => Promise.all(groups.map((queryKey) => qc.invalidateQueries({ queryKey })))
}

export function useSaveBook() {
    const invalidate = useInvalidate()
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }) => (id ? api.put(`/books/${id}`, data) : api.post('/books', data)).then((r) => r.data),
        onSuccess: (book) => {
            qc.setQueryData(keys.book(book._id), book)
            invalidate(keys.books, ['stats'])
        },
    })
}

// Quick partial update (status, page, rating, notes, ...)
export function usePatchBook() {
    const qc = useQueryClient()
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: ({ id, data }) => api.patch(`/books/${id}`, data).then((r) => r.data),
        onSuccess: (book) => {
            qc.setQueryData(keys.book(book._id), book)
            invalidate(['books', 'list'], keys.facets, ['stats'])
        },
    })
}

export function useDeleteBook() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: (id) => api.delete(`/books/${id}`).then((r) => r.data),
        onSuccess: () => invalidate(keys.books, ['stats']),
    })
}

export function useRefreshBook() {
    const qc = useQueryClient()
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: (id) => api.post(`/books/${id}/refresh`).then((r) => r.data),
        onSuccess: ({ book }) => {
            qc.setQueryData(keys.book(book._id), book)
            invalidate(['books', 'list'], keys.facets)
        },
    })
}

export function useSaveAuthor() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: ({ id, data }) => (id ? api.put(`/authors/${id}`, data) : api.post('/authors', data)).then((r) => r.data),
        onSuccess: () => invalidate(keys.authors, keys.books, keys.seriesList),
    })
}

export function useDeleteAuthor() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: (id) => api.delete(`/authors/${id}`).then((r) => r.data),
        onSuccess: () => invalidate(keys.authors),
    })
}

export function useSaveSeries() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: ({ id, data }) => (id ? api.put(`/series/${id}`, data) : api.post('/series', data)).then((r) => r.data),
        onSuccess: () => invalidate(keys.seriesList, keys.books),
    })
}

export function useDeleteSeries() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: (id) => api.delete(`/series/${id}`).then((r) => r.data),
        onSuccess: () => invalidate(keys.seriesList),
    })
}

export function useSaveSettings() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: (data) => api.put('/settings', data).then((r) => r.data),
        onSuccess: () => invalidate(keys.settings, ['stats']),
    })
}

export function useImport() {
    const invalidate = useInvalidate()
    return useMutation({
        mutationFn: ({ csv, dryRun }) => api.post('/import', { csv, dryRun }).then((r) => r.data),
        onSuccess: (result) => { if (!result.dryRun) invalidate(keys.books, keys.authors, ['stats']) },
    })
}
