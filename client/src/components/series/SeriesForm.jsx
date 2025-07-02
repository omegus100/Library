import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useParams, useNavigate } from 'react-router-dom'
import { GetData } from '../../hooks/getData'
import { GoBackButton, SubmitButton } from '../Buttons'
import { TextInput, SelectInput } from '../../components/FormOptions'
import { handleFormSubmit } from '../../hooks/handleFormSubmit'

export default function SeriesForm({ setSeries }) {
    const { id } = useParams()
    const navigate = useNavigate()
    const [formData, setFormData] = useState({
        title: '',
        authorId: '',
        authorFirstName: '',
        authorLastName: ''
    })

    const { data: authors, error: authorsError } = GetData('authors')
    const { data: series, error: seriesError } = GetData('series', id);

    // Populate form data when series data is fetched
    React.useEffect(() => {
        if (series) {
            setFormData({
                title: series.title,
                authorId: series.author.id,
                authorFirstName: series.author.firstName,
                authorLastName: series.author.lastName,
            });
        }
    }, [series])

    const handleInputChange = (event) => {
        const { name, value } = event.target
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }))

       // Update author info immediately when authorId changes
        if (name === "authorId") {
            updateAuthorInfo(value)
        }
    }
    
    const updateAuthorInfo = (authorId) => {
        const selectedAuthor = authors.find((author) => author._id === authorId)
        if (selectedAuthor) {
            setFormData((prevData) => ({
                ...prevData,
                authorFirstName: selectedAuthor.firstName,
                authorLastName: selectedAuthor.lastName
            }))
        }
    }

    // This function is called when the form is submitted
    const handleSubmit = (event) => {
        event.preventDefault()

        // Prevent submission if no author is selected
        if (!formData.authorId) {
            alert('Please select an author before submitting the form.')
            return
        } 

        handleFormSubmit({
            endpoint: '/api/series',
            id,
            formData,
            setItems: setSeries,
            successMessage: id ? 'Series updated successfully!' : 'Series created successfully!',
            navigateTo: '/series',
            navigate,
        })
    }

    const formFields = [
        { label: 'Title', name: 'title', type: 'text', placeholder: 'Enter Series Title', component: TextInput },
        { label: 'Author', name: 'authorId', value: formData.authorId, options: authors, placeholder: 'Select Author', component: SelectInput },
    ]

    return (
        <>
        <GoBackButton />
        <h1>{id ? 'Edit Series' : 'New Series'}</h1>
        <form onSubmit={handleSubmit}>
            {formFields.map((field) => {
                const FieldComponent = field.component
                return (
                    <FieldComponent
                        key={field.name}
                        label={field.label}
                        name={field.name}
                        type={field.type}
                        value={formData[field.name]}
                        onChange={handleInputChange}
                        options={field.options}
                        placeholder={field.placeholder}
                    />
                )
            }
            )}
        <SubmitButton isEditing={!!id} object="Series" />
        </form>
        {/* {authorsError && <p>Error fetching authors: {authorsError.message}</p>}
        {seriesError && <p>Error fetching series: {seriesError.message}</p>} */}
        </>
    )
}