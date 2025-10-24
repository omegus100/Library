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
                        <li><Link to="/products">Inventory</Link></li>
                        <li><Link to="/cycles">Stock Counts</Link></li>
                        <li><Link to="/products/new">Add Products</Link></li>
               
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