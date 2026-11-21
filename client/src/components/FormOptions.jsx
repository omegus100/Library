import React from 'react'
import { Link } from 'react-router-dom'
import styles from './FormOptions.module.css'

// Form fields (Round 3): label above the control, full width, themed.
// Each field is a block; put them in a grid or stack to lay out a form.

const Field = ({ label, htmlFor, hint, children, wide }) => (
    <div className={`${styles.field} ${wide ? styles.wide : ''}`}>
        <label htmlFor={htmlFor} className={styles.label}>{label}</label>
        {children}
        {hint}
    </div>
)

const SearchInput = ({ type = 'search', value, onChange, placeholder, className, label = 'Search', id = 'search' }) => (
    <div className={className || styles.searchWrap}>
        <label htmlFor={id} className="sr-only">{label}</label>
        <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={styles.control}
            autoComplete="off"
        />
    </div>
)

const SelectInput = ({ label, name, value, options = [], onChange, placeholder = `Choose ${label.toLowerCase()}`, link, linkText, wide }) => (
    <Field
        label={label}
        htmlFor={name}
        wide={wide}
        hint={link ? <Link to={link} className={styles.hintLink}>{linkText || `Add new ${label.toLowerCase()}`}</Link> : null}
    >
        <select id={name} name={name} value={value ?? ''} onChange={onChange} className={styles.control}>
            <option value="">{placeholder}</option>
            {options.map((option, index) => (
                <option key={index} value={typeof option === 'string' ? option : option._id}>
                    {typeof option === 'string' ? option : option.title || `${option.firstName} ${option.lastName}`}
                </option>
            ))}
        </select>
    </Field>
)

const TextInput = ({ label, name, type = 'text', value, onChange, placeholder, required, wide, inputMode, autoComplete, min, max, step, hint }) => (
    <Field label={required ? `${label} (required)` : label} htmlFor={name} wide={wide} hint={hint ? <span className={styles.hint}>{hint}</span> : null}>
        <input
            id={name}
            name={name}
            type={type}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder || ''}
            required={required}
            inputMode={inputMode}
            autoComplete={autoComplete}
            min={min}
            max={max}
            step={step}
            className={styles.control}
        />
    </Field>
)

const TextAreaInput = ({ label, name, value, onChange, placeholder, rows = 4, wide = true }) => (
    <Field label={label} htmlFor={name} wide={wide}>
        <textarea
            id={name}
            name={name}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder || ''}
            rows={rows}
            className={`${styles.control} ${styles.textarea}`}
        />
    </Field>
)

export { Field, SearchInput, SelectInput, TextInput, TextAreaInput }
