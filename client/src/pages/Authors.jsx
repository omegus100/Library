import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GetData } from '../hooks/getData'
import { AddButton } from '../components/Buttons'
import styles from '../stylesheets/Index.module.css'
import { SearchInput } from '../components/FormOptions'
import SortOptions from '../components/SortOptions'
import ListLayout from '../components/PageLayouts'
import { Loading } from '../components/Icons'
import { TabMenu } from '../components/Headings'

const Authors = () => {
    const { data: authors, error, isLoading } = GetData('authors')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('lastName')
    const location = useLocation() // Get the current location

     // Filter authors based on the search query
     const filteredAuthors = authors?.filter((author) =>
        author.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        author.lastName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sort authors by last name, then first name  
    const sortedAuthors = filteredAuthors?.sort((a, b) => {
        const lastNameA = a.lastName.toLowerCase()
        const lastNameB = b.lastName.toLowerCase()
        switch (sortBy) {
            case 'firstName':
                return lastNameA.localeCompare(lastNameB)
            case 'lastName':
                return lastNameB.localeCompare(lastNameA)
            default:
                return lastNameA.localeCompare(lastNameB)
        }
    })

    if (isLoading) {
            return <Loading /> 
    }

    if (error) {
        return <p>Error fetching authors: {error.message}</p>
    }

    return (
        <>
            {/* <div className={styles.indexHeader}>
                <h1>Authors</h1>
                
            </div>     */}
            <TabMenu />
            <div className={styles.filterContainer}>
                <SearchInput
                    type="text"
                    placeholder="Search authors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className={styles.searchInput}
                />  
                <SortOptions sortBy={sortBy} setSortBy={setSortBy} object="author" className={styles.sortContainer}/> 
                <Link to="/authors/new">
                    <AddButton />               
                </Link> 
            </div>
        
            <ListLayout authors={sortedAuthors} sortBy={sortBy}/>  
        </>
    )
}

export default Authors
