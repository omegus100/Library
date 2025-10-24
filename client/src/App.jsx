import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Library from './pages/Library'
import Books from './pages/Books'
import Authors from './pages/Authors'
import Series from './pages/Series'
import Genres from './pages/Genres'
import Formats from './pages/Formats'
import BookForm from './components/books/BookForm'
import BookDetails from './components/books/BookDetails.jsx'
import AuthorForm from './components/authors/AuthorForm'
import AuthorDetails from './components/authors/AuthorDetails'
import SeriesForm from './components/series/SeriesForm'
import SeriesDetails from './components/series/SeriesDetails'
import AddNew from './pages/AddNew.jsx'
import BookObjects from './pages/BookObjects.jsx'
import Settings from './pages/Settings.jsx'
import ProductForm from './components/products/ProductForm.jsx'

import Products from './pages/Products.jsx'
import Cycles from './pages/Cycles.jsx'

export default function App() {
    return (
        <Router>
            <Routes>
                {/* Wrap all routes with the Layout component */}
                <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="home" element={<Home />} />
                    <Route path="library" element={<Library />} />
                    <Route path="books" element={<Books />} />
                    <Route path="books/new" element={<BookForm />} /> 
                    <Route path="books/:id" element={<BookDetails />} /> 
                    <Route path="books/:id/edit" element={<BookForm />} /> 
                    <Route path="authors" element={<Authors />} />
                    <Route path="authors/new" element={<AuthorForm />} /> 
                    <Route path="authors/:id" element={<AuthorDetails />} /> 
                    <Route path="authors/:id/edit" element={<AuthorForm />} /> 
                    <Route path="series" element={<Series />} />        
                    <Route path="series/new" element={<SeriesForm />} />  
                    <Route path="series/:id" element={<SeriesDetails />} /> 
                    <Route path="series/:id/edit" element={<SeriesForm />} />         
                    <Route path="genres" element={<Genres />} /> 
                    <Route path="genres/:id" element={<BookObjects />} />     
                    <Route path="format" element={<Formats />} />    
                    <Route path="format/:id" element={<BookObjects />} />
                    <Route path="books/new/search" element={<AddNew />} />  
                    <Route path="settings" element={<Settings />} />
                    <Route path="products" element={<Products />} />
                    <Route path="products/new" element={<ProductForm />} />
                    <Route path="cycles" element={<Cycles />} />
                </Route>
            </Routes>
        </Router>
    );
}