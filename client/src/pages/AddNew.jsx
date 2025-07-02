import React, { useState } from 'react'
import axios from 'axios'
import styles from '../stylesheets/Index.module.css'
import { SearchInput, TextInput, TextAreaInput } from '../components/FormOptions'
import FileUploader from '../components/FileUpload' // Assuming you have a file uploader component

export default function AddNewBook() {
    const [books, setBooks] = useState([]) // State to store books mapped to bookSchema
    const [searchQuery, setSearchQuery] = useState('') // State to store the search query
    const [editStates, setEditStates] = useState({}) // State to track edit mode for each book
    const API_URL = process.env.REACT_APP_API_URL || '' // Use environment variable for backend API URL

    const fetchBooks = async () => {
        try {
            const response = await axios.get('https://www.googleapis.com/books/v1/volumes', {
                params: { q: searchQuery },
            })
    
            const mappedBooks = await Promise.all(
                response.data.items.map(async (item) => {
                    const volumeInfo = item.volumeInfo
                    const authorName = volumeInfo.authors?.[0] || 'Unknown Author'
                    const nameParts = authorName.split(' ')
                    const authorFirstName = nameParts.slice(0, -1).join(' ') || 'Unknown'
                    const authorLastName = nameParts.slice(-1).join(' ') || 'Unknown'
    
                    // Append &fife=w800 to the thumbnail URL
                    const thumbnailUrl = volumeInfo.imageLinks?.thumbnail
                    ? `${volumeInfo.imageLinks.thumbnail}&fife=w800`
                    : ''

                    // Convert the modified URL to Base64
                    const coverImagePath = thumbnailUrl
                        ? await convertUrlToBase64(thumbnailUrl)
                        : ''
    
                    return {
                        title: volumeInfo.title || '',
                        description: volumeInfo.description || '',
                        publishDate: volumeInfo.publishedDate || '',
                        pageCount: volumeInfo.pageCount || '',
                        genres: volumeInfo.categories || [],
                        authorId: '',
                        authorFirstName: authorFirstName || '',
                        authorLastName: authorLastName || '',
                        coverImage: volumeInfo.imageLinks?.thumbnail || '/no_book_cover_available.svg', // Keep the original URL,
                        coverImagePath, // Add the Base64 value as a new variable
                        publisher: volumeInfo.publisher || 'N/A',
                        isbn: volumeInfo.industryIdentifiers?.[0]?.identifier || '',
                    }
                })
            )
    
            setBooks(mappedBooks)
            setEditStates(mappedBooks.reduce((acc, _, index) => ({ ...acc, [index]: false }), {})) // Initialize edit states
        } catch (error) {
            console.error('Error fetching books:', error)
        }
    }

    const convertUrlToBase64 = async (url) => {
        try {
            // const response = await fetch(url)
            const response = await fetch(`http://localhost:3000/proxy?url=${encodeURIComponent(url)}`)
            const blob = await response.blob()
    
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result) // Base64 string
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        } catch (error) {
            console.error('Error converting URL to Base64:', error)
            return '' // Return an empty string if conversion fails
        }
    }

    const toggleEditState = (index) => {
        setEditStates((prevStates) => ({
            ...prevStates,
            [index]: !prevStates[index], // Toggle the edit state for the specific book
        }))
    }

    const findMatchingAuthor = async (book) => {
        try {
            // Fetch all authors from the backend
            const response = await axios.get(`${API_URL}/api/authors`)
            const authors = response.data

            // Find a matching author
            const matchingAuthor = authors.find(
                (author) =>
                    author.firstName === book.authorFirstName &&
                    author.lastName === book.authorLastName
            )

            if (matchingAuthor) {
                // Update the book's authorId with the matching author's ID
                book.authorId = matchingAuthor._id
    
                return book
            } else {
                return addNewAuthor(book)
            }
           
        } catch (error) {
            console.error('Error fetching authors:', error)
            throw error
        }
    }

    const addNewAuthor = async (book) => {
        try {
            // Create a new author using book.authorFirstName and book.authorLastName
            const response = await axios.post(`${API_URL}/api/authors`, {
                firstName: book.authorFirstName,
                lastName: book.authorLastName
            })

            const newAuthor = response.data // Get the newly created author from the response
            book.authorId = newAuthor._id // Update the book's authorId with the ID of the newly created author

            // Return the updated book
            return book           
        } catch (error) {
            console.error('Error adding new author:', error)
            throw error
        }
    }

    const handleFormSubmit = async (e, book, index) => {
        e.preventDefault()
        try {
            // Check for a matching author and update the book
            const updatedBook = await findMatchingAuthor(book)
    
            // Add the updated book to the backend
            const response = await axios.post(`${API_URL}/api/books`, updatedBook)
            alert('Book added successfully!')
        } catch (error) {
            console.error('Error handling form submission:', error)
        }
    }

    const formFields = [
        { label: 'Title', name: 'title', type: 'text' },
        { label: 'Author First Name', name: 'authorFirstName', type: 'text' },
        { label: 'Author Last Name', name: 'authorLastName', type: 'text' },
        { label: 'Description', name: 'description', type: 'textarea' },
        { label: 'Publish Date', name: 'publishDate', type: 'date' },
        { label: 'Page Count', name: 'pageCount', type: 'number' },
        { label: 'Genres', name: 'genres', type: 'text' },
        { label: 'Publisher', name: 'publisher', type: 'text' },
        { label: 'ISBN', name: 'isbn', type: 'text' },
        { label: 'Cover Image Path', name: 'coverImagePath', type: 'file' }
    ]

    return (
        <div>
            <h1>Add New Book</h1>
            <div className={styles.filterContainer}>
                <SearchInput
                    type="text"
                    placeholder="Search for books..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
                <button onClick={fetchBooks} style={{ padding: '.5rem' }}>
                    Search
                </button>
            </div>
            {/* <p>Enter your title and click Search to retrieve results.</p> */}
            <div>
                {books.map((book, index) => (
                    <div key={index} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
                        {/* Render Book Details as Text */}
                        {!editStates[index] && (
                            <div style={{ marginBottom: '10px' }} className="returned-books-text">                                    
                                <p><img src={book.coverImage} alt="Cover" style={{ maxWidth: '100px' }} /></p>
                                <p><strong>Title:</strong> {book.title}</p>
                                <p><strong>Author:</strong> {book.authorFirstName} {book.authorLastName}</p>
                                <p><strong>Description:</strong> {book.description}</p>
                                <p><strong>Publish Date:</strong> {book.publishDate}</p>
                                <p><strong>Page Count:</strong> {book.pageCount}</p>
                                <p><strong>Genres:</strong> {Array.isArray(book.genres) ? book.genres.join(', ') : book.genres}</p>
                                <p><strong>Publisher:</strong> {book.publisher}</p>
                                <p><strong>ISBN:</strong> {book.isbn}</p>
                                {/* <p><strong>Image ID:</strong> {book.coverImage}</p> */}
                                <button onClick={() => toggleEditState(index)} style={{ marginTop: '10px', padding: '10px' }}>
                                    Edit
                                </button>
                            </div>
                        )}

                        {/* Render Editable Form */}
                        {editStates[index] && (
                            <form
                                onSubmit={(e) => handleFormSubmit(e, book, index)}
                                style={{ borderTop: '1px solid #ccc', paddingTop: '10px' }}
                                className="returned-books-form"
                            >
                                {formFields.map((field, fieldIndex) => {
                                    switch (field.type) {
                                        case 'text':
                                        case 'date':
                                        case 'number':
                                            return (
                                                <TextInput
                                                    key={fieldIndex}
                                                    label={field.label}
                                                    name={field.name}
                                                    type={field.type}
                                                    value={book[field.name]}
                                                    onChange={(e) => {
                                                        const updatedBooks = [...books]
                                                        updatedBooks[index][field.name] = e.target.value
                                                        setBooks(updatedBooks)
                                                    }}
                                                    placeholder={field.label}
                                                />
                                            )
                                        case 'textarea':
                                            return (
                                                <TextAreaInput
                                                    key={fieldIndex}
                                                    label={field.label}
                                                    name={field.name}
                                                    value={book[field.name]}
                                                    onChange={(e) => {
                                                        const updatedBooks = [...books]
                                                        updatedBooks[index][field.name] = e.target.value
                                                        setBooks(updatedBooks)
                                                    }}
                                                    placeholder={field.label}
                                                    rows="10"
                                                />
                                            )
                                        case 'file':                          
                                            return (
                                                <FileUploader
                                                    key={fieldIndex}
                                                    files={book.coverImagePath} // Use the coverImagePath value here
                                                    onChange={(file) => {
                                                        const updatedBooks = [...books]
                                                        updatedBooks[index].coverImagePath = file // Update the coverImagePath value
                                                        setBooks(updatedBooks)
                                                    }}
                                                />
                                            )
                                        default:
                                            return null
                                    }
                                })}
                                
                                <button
                                    type="button"
                                    onClick={() => toggleEditState(index)}
                                    style={{ marginTop: '10px', padding: '10px', marginLeft: '10px' }}
                                >
                                    Cancel
                                </button>
                            </form>
                        )}
                        <button
                            type="button"
                            onClick={(e) => handleFormSubmit(e, book, index)}
                            style={{ marginTop: '10px', padding: '10px', backgroundColor: '#4CAF50', color: 'white' }}
                        >
                            Add Book
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}