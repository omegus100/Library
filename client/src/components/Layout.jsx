import React from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../auth/AuthContext'
import styles from '../stylesheets/Layout.module.css'

const navClass = ({ isActive }) => `${styles.navLink} ${isActive ? styles.navActive : ''}`

const Icon = ({ d }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {d.map((p) => <path key={p} d={p} />)}
    </svg>
)
const ICONS = {
    library: ['M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5', 'M19 19v3H6.5'],
    stats: ['M3 3v18h18', 'M7 15l4-4 3 3 5-6'],
    settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
}

// App shell (Round 3): slim header. Library is home; Reading (stats) and Settings are secondary.
export default function Layout() {
    const { isOwner, checking } = useAuth()
    const location = useLocation()

    return (
        <div className={styles.shell}>
            <a href="#main" className={styles.skipLink}>Skip to content</a>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link to="/library" className={styles.brand}>
                        <Icon d={ICONS.library} />
                        <span className={styles.brandText}>Library</span>
                    </Link>

                    <nav className={styles.nav} aria-label="Main">
                        <NavLink to="/library" className={(s) => `${navClass(s)} ${styles.navBooks}`}><Icon d={ICONS.library} /><span>Books</span></NavLink>
                        <NavLink to="/stats" className={navClass}><Icon d={ICONS.stats} /><span>Reading</span></NavLink>
                        <NavLink to="/settings" className={navClass}><Icon d={ICONS.settings} /><span>Settings</span></NavLink>
                    </nav>

                    <div className={styles.actions}>
                        <ThemeToggle />
                        {isOwner ? (
                            <Link to="/books/new/search" className={styles.addButton}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                <span>Add book</span>
                            </Link>
                        ) : !checking && (
                            <Link to="/login" className={styles.signIn}>Sign in</Link>
                        )}
                    </div>
                </div>
            </header>

            <main id="main" className={styles.main}>
                <ErrorBoundary resetKey={location.pathname}>
                    <Outlet />
                </ErrorBoundary>
            </main>
        </div>
    )
}
