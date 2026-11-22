import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import Layout from './components/Layout'
import RequireOwner from './auth/RequireOwner'
import Library from './pages/Library'
import BookDetails from './components/books/BookDetails'
import { BookGridSkeleton } from './components/Skeleton'

// Less-used pages load on demand (keeps the first load small; forms pull in the upload widget)
const Authors = lazy(() => import('./pages/Authors'))
const Series = lazy(() => import('./pages/Series'))
const Genres = lazy(() => import('./pages/Genres'))
const Formats = lazy(() => import('./pages/Formats'))
const BookObjects = lazy(() => import('./pages/BookObjects'))
const AddNew = lazy(() => import('./pages/AddNew'))
const Stats = lazy(() => import('./pages/Stats'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const BookForm = lazy(() => import('./components/books/BookForm'))
const AuthorForm = lazy(() => import('./components/authors/AuthorForm'))
const AuthorDetails = lazy(() => import('./components/authors/AuthorDetails'))
const SeriesForm = lazy(() => import('./components/series/SeriesForm'))
const SeriesDetails = lazy(() => import('./components/series/SeriesDetails'))

const owner = (element) => <RequireOwner>{element}</RequireOwner>

function NotFound() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 style={{ margin: 0 }}>Page not found</h1>
            <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>That page doesn’t exist.</p>
            <Link to="/library">Go to your library</Link>
        </div>
    )
}

export default function App() {
    return (
        <Router>
            <Suspense fallback={<div style={{ maxWidth: 1200, margin: '40px auto', padding: '0 32px' }}><BookGridSkeleton count={5} /></div>}>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Navigate to="/library" replace />} />
                    <Route path="library" element={<Library />} />
                    <Route path="login" element={<Login />} />
                    <Route path="stats" element={<Stats />} />
                    <Route path="settings" element={<Settings />} />

                    <Route path="books/new" element={owner(<BookForm />)} />
                    <Route path="books/new/search" element={owner(<AddNew />)} />
                    <Route path="books/:id" element={<BookDetails />} />
                    <Route path="books/:id/edit" element={owner(<BookForm />)} />

                    <Route path="authors" element={<Authors />} />
                    <Route path="authors/new" element={owner(<AuthorForm />)} />
                    <Route path="authors/:id" element={<AuthorDetails />} />
                    <Route path="authors/:id/edit" element={owner(<AuthorForm />)} />

                    <Route path="series" element={<Series />} />
                    <Route path="series/new" element={owner(<SeriesForm />)} />
                    <Route path="series/:id" element={<SeriesDetails />} />
                    <Route path="series/:id/edit" element={owner(<SeriesForm />)} />

                    <Route path="genres" element={<Genres />} />
                    <Route path="genres/:id" element={<BookObjects />} />
                    <Route path="format" element={<Formats />} />
                    <Route path="format/:id" element={<BookObjects />} />

                    {/* Old addresses */}
                    <Route path="books" element={<Navigate to="/library" replace />} />
                    <Route path="home" element={<Navigate to="/library" replace />} />
                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
            </Suspense>
        </Router>
    )
}
