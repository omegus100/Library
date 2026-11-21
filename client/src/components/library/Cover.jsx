import React, { useState } from 'react'
import { apiUrl } from '../../api/client'
import { authorName, coverColor } from '../../utils/bookSort'
import styles from './Cover.module.css'

// The cover image a book should show: server cover URL, a local preview (data URL / remote), or none
export const coverSrc = (book) => {
    if (book.coverPreview) return book.coverPreview
    if (book.coverUrl) return apiUrl(book.coverUrl)
    const legacy = book.coverImagePath
    return legacy && !legacy.endsWith('no_book_cover_available.svg') ? legacy : ''
}

// A book cover: the real image when there is one, otherwise a colored tile with the title.
// size: "md" (grid), "sm" (list rows)
export default function Cover({ book, size = 'md' }) {
    const [failed, setFailed] = useState(false)
    const src = coverSrc(book)

    if (src && !failed) {
        return (
            <img
                className={`${styles.cover} ${styles[size]}`}
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div className={`${styles.cover} ${styles.placeholder} ${styles[size]}`} style={{ background: coverColor(book.title) }} aria-hidden="true">
            {size === 'md' && (
                <>
                    <span className={styles.placeholderTitle}>{book.title}</span>
                    <span className={styles.placeholderAuthor}>{authorName(book)}</span>
                </>
            )}
        </div>
    )
}
