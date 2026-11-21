import React, { useState } from 'react'
import styles from './Rating.module.css'

const Star = ({ filled }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
    </svg>
)

// 1–5 stars. Read-only unless onChange is given. Clicking the current rating clears it.
export default function Rating({ value = 0, onChange, size = 'md' }) {
    const [hover, setHover] = useState(0)
    const shown = hover || value || 0

    if (!onChange) {
        if (!value) return null
        return (
            <span className={`${styles.stars} ${styles[size]}`} role="img" aria-label={`Rated ${value} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= value} />)}
            </span>
        )
    }

    return (
        <span className={`${styles.stars} ${styles[size]}`} role="radiogroup" aria-label="Your rating" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className={styles.star}
                    onMouseEnter={() => setHover(n)}
                    onFocus={() => setHover(n)}
                    onBlur={() => setHover(0)}
                    onClick={() => onChange(value === n ? 0 : n)}
                >
                    <Star filled={n <= shown} />
                </button>
            ))}
        </span>
    )
}
