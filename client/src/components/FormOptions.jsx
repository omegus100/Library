import React from 'react'
import { Link } from 'react-router-dom'
import { GoBackButton } from '../components/Buttons'

const FormHeader = ({ isEditing }) => {
  return (
    <div className="form-header">
      <h1>{isEditing ? 'Edit Book' : 'Create New Book'}</h1>
      <GoBackButton />
    </div>
  )
}

const SearchInput = ({ type = 'text', value, onChange, placeholder, className }) => (
  <>
      <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={className ? className : 'search-input'}
      />
      <br />
  </>
)

const SelectInput = ({ label, name, value, options, onChange, placeholder = `Select ${label}`, link, linkText }) => (
  <>
      <label htmlFor={name}>{label}:</label>
      <select name={name} value={value} onChange={onChange}>
          <option value="">{placeholder}</option> {/* Default placeholder */}
          {options.map((option, index) => (
              <option
                  key={index}
                  value={typeof option === 'string' ? option : option._id} // Handle strings or objects
              >
                  {typeof option === 'string' ? option : option.title || `${option.firstName} ${option.lastName}`}
              </option>
          ))}
      </select>

      {link && (
          <Link to={link}>
              {linkText ? linkText : `Add New ${label}`}
          </Link>
      )}
      <br />
  </>
)

const TextInput = ({ label, name, type = 'text', value, onChange, placeholder }) => (
  <>
      <label htmlFor={name}>{label}:</label>
      <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder ? placeholder : `Enter ${label}`}
      />  
      <br />
  </>
)

const TextAreaInput = ({ label, name, value, onChange, placeholder, rows }) => (  
  <>
      <label htmlFor={name}>{label}:</label>
      <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder ? placeholder : `Enter ${label}`}
          rows={rows ? rows : 4} // Default to 4 rows if not specified
      />
      <br />
  </>
)

export { FormHeader, SearchInput, SelectInput, TextInput, TextAreaInput } 

