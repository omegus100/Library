import React, { useEffect, useState } from 'react'
import styles from './ThemeToggle.module.css'

const getSystemTheme = () =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const getEffectiveTheme = () =>
    document.documentElement.getAttribute('data-theme') || getSystemTheme()

// Switches between light and dark. The choice is saved; until then the app follows the system.
export default function ThemeToggle() {
    const [theme, setTheme] = useState(getEffectiveTheme)

    // Keep the icon right if the system theme changes and the user hasn't picked one
    useEffect(() => {
        const media = window.matchMedia?.('(prefers-color-scheme: dark)')
        if (!media) return
        const onChange = () => setTheme(getEffectiveTheme())
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [])

    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        try { localStorage.setItem('theme', next) } catch { /* private mode: still switches for this visit */ }
        setTheme(next)
    }

    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

    return (
        <button type="button" className={styles.button} onClick={toggle} aria-label={label} title={label}>
            {theme === 'dark' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
            ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    )
}
