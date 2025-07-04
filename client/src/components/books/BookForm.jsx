import React, { useState, useEffect } from 'react'
import axios from 'axios'

import * as bookObjects from './bookObjects'
import { GetData } from '../../hooks/getData'
import { useParams, useNavigate } from 'react-router-dom'
import { TextInput, SelectInput, TextAreaInput } from '../../components/FormOptions'
import { GoBackButton, SubmitButton } from '../Buttons'
import FileUploader from '../../components/FileUpload'
import { handleFormSubmit } from '../../hooks/handleFormSubmit'
import styles from '../../stylesheets/Forms.css'

export default function BookForm({ setBooks }) {
    const { id } = useParams()
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        publishDate: '',
        pageCount: '',
        format: '',
        genres: '',
        authorId: '',
        seriesId: '',
        seriesVolume: '',
        coverImagePath: ''
    })

    const { data: book, error: bookError } = GetData('books', id)
    const { data: authors, error: authorsError } = GetData('authors')
    const { data: series, error: seriesError } = GetData('series')

    // Populate form data when book data is fetched
    React.useEffect(() => {
        if (book) {
            setFormData({                   
                title: book.title || '',
                description: book.description || '',
                publishDate: book.publishDate ? new Date(book.publishDate).toISOString().split('T')[0] : '',
                pageCount: book.pageCount || '',
                format: book.format || '',
                genres: book.genres || '',
                authorId: book.author?.id || '',
                authorFirstName: book.author?.firstName || '',
                authorLastName: book.author?.lastName || '',
                seriesTitle: book.series?.title || '',
                seriesId: book.series?.id || '',
                seriesVolume: book.series?.volume || '',
                coverImagePath: book.coverImagePath,
                publisher: book.publisher || '',
                isbn: book.isbn || '',
                readingStatus: book.readingStatus || ''   
            });
        }
    }, [book])

    const handleInputChange = (event) => {
        const { name, value } = event.target
        setFormData((prevData) => ({
            ...prevData,
            [name]: value
        }))
    }

    const updateAuthorInfo = (authorId) => {
        if (!authorId || authorId === formData.authorId) return // Prevent overwriting if no change
        const selectedAuthor = authors.find((author) => author._id === authorId)
        if (selectedAuthor) {
            setFormData((prevData) => ({
                ...prevData,
                authorFirstName: selectedAuthor.firstName,
                authorLastName: selectedAuthor.lastName,
            }))
        }
    }

    const updateSeriesInfo = (seriesId) => {
        if (!seriesId || seriesId === formData.seriesId) return // Prevent overwriting if no change
        const selectedSeries = series.find((series) => series._id === seriesId)
        if (selectedSeries) {
            setFormData((prevData) => ({
                ...prevData,
                seriesTitle: selectedSeries.title,
            }))
        }
    }

    const handleFileChange = (fileItems) => {
        if (fileItems.length > 0 && fileItems[0].file instanceof Blob) {
            const file = fileItems[0].file
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onloadend = () => {
                setFormData((prevData) => ({
                    ...prevData,
                    coverImagePath: reader.result
                }))
            }
        // } else {
        //     console.warn('Invalid file or no file selected. Using default cover image.')
        //     // Set the default cover image if no valid file is uploaded
        //     setFormData((prevData) => ({
        //         ...prevData,
        //         coverImagePath: '/no_book_cover_available.svg'
        //     }))
         }
    }

    const handleSubmit = (event) => {
        event.preventDefault()

        const finalFormData = {
            ...formData,
            coverImagePath: formData.coverImagePath 
        }

        handleFormSubmit({
            endpoint: '/api/books',
            id,
            formData: finalFormData,
            setItems: setBooks,
            successMessage: id ? 'Book updated successfully!' : 'Book created successfully!',
            navigateTo: '/library',
            navigate,
        })
    }

    const formFields = [
        { label: "Title", name: "title", type: "text", component: "TextInput" },
        { label: "Publish Date", name: "publishDate", type: "date", component: "TextInput" },
        { label: "Page Count", name: "pageCount", type: "number", component: "TextInput" },
        { label: "Format", name: "format", component: "SelectInput", options: bookObjects.formats },
        { label: "Genres", name: "genres", component: "SelectInput", options: bookObjects.genres },
        { label: "Author", name: "authorId", component: "SelectInput", options: authors, customHandler: updateAuthorInfo, link: '/authors/new', linkText: 'Add New Author' },
        { label: "Series", name: "seriesId", component: "SelectInput", options: series, customHandler: updateSeriesInfo },
        { label: "Series Volume", name: "seriesVolume", type: "number", component: "TextInput" },
        { label: "Publisher", name: "publisher", type: "text", component: "TextInput" },
        { label: "ISBN", name: "isbn", type: "number", component: "TextInput" },
        { label: "Cover Image", name: "coverImagePath", component: "FileUploader" },
        { label: "Description", name: "description", component: "TextAreaInput" },
        { label: "Reading Status", name: "readingStatus", component: "SelectInput", options: bookObjects.readingStatus },
    ]

    return (
        <>
            <GoBackButton />
            <h1>{id ? 'Edit Book' : 'New Book'}</h1>
            <form onSubmit={handleSubmit}>
                {formFields.map((field, index) => {
                    switch (field.component) {
                        case "TextInput":
                            return (
                                <TextInput
                                    key={index}
                                    label={field.label}
                                    name={field.name}
                                    type={field.type || "text"}
                                    value={formData[field.name]}
                                    onChange={handleInputChange}
                                    placeholder={field.label}
                                />
                            )
                        case "TextAreaInput":
                            return (
                                <TextAreaInput
                                    key={index}
                                    label={field.label}
                                    name={field.name}
                                    value={formData[field.name]}
                                    onChange={handleInputChange}
                                    placeholder={field.label}
                                    rows="4"
                                />
                            )    
                        case "SelectInput":
                            return (
                                <SelectInput
                                    key={index}
                                    label={field.label}
                                    name={field.name}
                                    value={formData[field.name]}
                                    options={field.options}
                                    onChange={(event) => {
                                        const { value } = event.target
                                        handleInputChange(event)
                                        if (field.customHandler) field.customHandler(value)
                                    }}
                                    link={field.link}
                                    linkText={field.linkText}
                                />
                            )
                        case "FileUploader":
                            return (
                                <FileUploader
                                    key={index}
                                    files={formData[field.name]}
                                    onUpdateFiles={handleFileChange}
                                />
                            )
                        default:
                            return null
                    }
                })}
            <SubmitButton isEditing={!!id} object="Book" />
            </form>
            {/* {authorsError && <p>Error fetching authors: {authorsError.message}</p>}
            {seriesError && <p>Error fetching series: {seriesError.message}</p>}
            {bookError && <p>Error fetching book: {bookError.message}</p>} */}
        </>
    )
}