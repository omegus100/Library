import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GoBackButton, SubmitButton } from '../Buttons'
import { TextInput } from '../../components/FormOptions'
import { handleFormSubmit } from '../../hooks/handleFormSubmit'
import { GetData } from '../../hooks/getData'

export default function ProductForm({ setProducts }) {
    const { id } = useParams()
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        sku: '',
        description: '',
        qty: 0
    })

    // Use the custom hook to fetch product data
    const { data: product, error } = GetData('products', id);

    // Populate form data when product data is fetched
    React.useEffect(() => {
        if (product) {
            setFormData({
                title: product.title,
                sku: product.sku,
                description: product.description,
                qty: product.qty,
            });
        }
    }, [product])

    // This function handles input changes and updates the form data state    
    const handleInputChange = (event) => {
        const { name, value } = event.target
        setFormData((prevData) => ({
            ...prevData,
            [name]: value
        }))
    } 

    // This function is called when the form is submitted
    const handleSubmit = (event) => {
        event.preventDefault();
        handleFormSubmit({
            endpoint: '/api/products',
            id,
            formData,
            setItems: setProducts,
            successMessage: id ? 'Product updated successfully!' : 'Product created successfully!',
            navigateTo: '/products',
            navigate,
        })
    }

    const formFields = [
        { label: 'Title', name: 'title', type: 'text', placeholder: 'Enter product title', component: TextInput },
        { label: 'SKU', name: 'sku', type: 'text', placeholder: 'Enter product SKU', component: TextInput },
        { label: 'Description', name: 'description', type: 'text', placeholder: 'Enter product description', component: TextInput },
        { label: 'Quantity', name: 'qty', type: 'number', placeholder: 'Enter product quantity', component: TextInput },
    ]

    return (
        <>
        <GoBackButton />
        <h1>{id ? 'Edit Product' : 'New Product'}</h1>
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
                        placeholder={field.placeholder}
                    />
                )
            })}
            {/* You can add more fields here if needed */}
            <SubmitButton isEditing={!!id} object="Product" />
        </form>
        </>
    )
}