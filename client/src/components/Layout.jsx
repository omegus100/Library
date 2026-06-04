import React from 'react'
import { Link, Outlet } from 'react-router-dom'
import styles from '../stylesheets/Layout.module.css'

export default function Layout() {
    return (
        <div className={styles.layoutContainer}>
            {/* Sidebar Navigation */}
            <div className={styles.sidebar}>
                <nav className={styles.sidebarNav}>
                    <ul>
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/library">Library</Link></li>
                        {/* <li><Link to="/books">Books</Link></li>
                        <li><Link to="/authors">Authors</Link></li>
                        <li><Link to="/series">Series</Link></li> */}
                        <li><Link to="/genres">Genres</Link></li>
                        <li><Link to="/format">Formats</Link></li>

                        {/* <li><Link to="/genres">Genres</Link></li>
                        <li><Link to="/format">Format</Link></li> */}
                        <li><Link to="/books/new/search">Search</Link></li>
                        <li><Link to="/settings">Settings</Link></li>
                    </ul>
                </nav>
            </div>

            {/* Main Content */}
            <main className={styles.mainContent}>
                <Outlet /> {/* This is where the routed page content will be rendered */}
            </main>
        </div>
    )
}