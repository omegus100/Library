import React from 'react'
import styles from './Skeleton.module.css'

// Grey placeholder shapes shown while data loads (replace "Loading…" and the old GIF)
export function Skeleton({ width = '100%', height = 16, radius, className = '' }) {
    return <span className={`${styles.block} ${className}`} style={{ width, height, borderRadius: radius }} aria-hidden="true" />
}

export function BookGridSkeleton({ count = 10 }) {
    return (
        <div className={styles.grid} aria-busy="true" aria-label="Loading books">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className={styles.card}>
                    <span className={`${styles.block} ${styles.cover}`} />
                    <Skeleton width="80%" height={14} />
                    <Skeleton width="55%" height={12} />
                </div>
            ))}
        </div>
    )
}

export function ListSkeleton({ rows = 5 }) {
    return (
        <div className={styles.list} aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className={styles.row}>
                    <Skeleton width="40%" height={14} />
                    <Skeleton width="60px" height={12} />
                </div>
            ))}
        </div>
    )
}

export function DetailSkeleton() {
    return (
        <div className={styles.detail} aria-busy="true" aria-label="Loading book">
            <span className={`${styles.block} ${styles.detailCover}`} />
            <div className={styles.detailText}>
                <Skeleton width="60%" height={32} />
                <Skeleton width="30%" height={18} />
                <Skeleton height={120} />
                <Skeleton width="90%" height={14} />
                <Skeleton width="75%" height={14} />
            </div>
        </div>
    )
}
