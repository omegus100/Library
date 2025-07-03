import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GoBackButton, DeleteButton, EditButton } from '../Buttons'
import { GetData } from '../../hooks/getData'
import BookCover from '../books/BookCover'
import axios from 'axios'

// Get API base URL from environment variables
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'

export default function AuthorDetails() {
    const { id } = useParams() // Get the author ID from the URL
    const navigate = useNavigate()

    const { data: author, error: authorsError } = GetData('authors', id) 
    const { data: books, error: booksError } = GetData('books')

    // Handle errors from GetData or author fetching
    if (authorsError || booksError) {
        return <p>Error fetching data: {authorsError?.message || booksError?.message}</p>
    }

    if (!author || !books) {
        return <p>Loading author details...</p>
    }

    // Filter books by the current author
    const booksByAuthor = books.filter((book) => book.author?.id === author._id)

    const handleDelete = async () => {
        try {
            if (booksByAuthor.length > 0) {
                // Check if the author has books assigned to them
                alert('This author has book(s) assigned to it. Please delete the book(s) first.')
                return
            } else {
                await axios.delete(`${API_BASE_URL}/api/authors/${id}`) // Call the DELETE route
                alert('Author deleted successfully') // Notify the user
                navigate('/authors') // Redirect to the authors list page
            }
        } catch (err) {
            console.error('Error deleting author:', err)
            alert('Failed to delete the author')
        }
    }

    return (
        <>
            <GoBackButton />
            <h1>{author.firstName} {author.lastName}</h1>
            <p><strong>Books:</strong></p>
            <BookCover
                books={booksByAuthor}
                subtitle={(book) => `${book.author.firstName} ${book.author.lastName}`}
            />
            <EditButton onClick={() => navigate(`/authors/${author._id}/edit`)} />
            <DeleteButton onClick={handleDelete} />
        </>
    )
}