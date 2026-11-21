import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Buttons.module.css'

// Class names for a button look, usable on <button> or <Link>.
// variant: primary | secondary | outline | danger
export const buttonClass = (variant = 'secondary') => `${styles.button} ${styles[variant] || ''}`

const BackIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
    </svg>
)

// Back link. With `to`, goes there; otherwise goes back in history (falls back to Library).
export function GoBackButton({ to, label = 'Back' }) {
    const navigate = useNavigate()
    if (to) {
        return <Link to={to} className={styles.back}><BackIcon />{label}</Link>
    }
    const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/library'))
    return <button type="button" className={styles.back} onClick={goBack}><BackIcon />{label}</button>
}

export function EditButton({ onClick, label = 'Edit' }) {
    return <button type="button" className={buttonClass('secondary')} onClick={onClick}>{label}</button>
}

export function DeleteButton({ onClick, label = 'Delete' }) {
    return <button type="button" className={buttonClass('danger')} onClick={onClick}>{label}</button>
}

// Link styled as a button, e.g. <AddLink to="/authors/new">Add author</AddLink>
export function AddLink({ to, children }) {
    return (
        <Link to={to} className={buttonClass('primary')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {children}
        </Link>
    )
}

export function ViewAllButton({ link }) {
    return <Link to={link} className={buttonClass('secondary')}>View all</Link>
}

export function SubmitButton({ isEditing, object, disabled }) {
    return (
        <button type="submit" className={buttonClass('primary')} disabled={disabled}>
            {isEditing ? 'Save changes' : `Add ${object.toLowerCase()}`}
        </button>
    )
}
