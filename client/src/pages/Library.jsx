import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GetData } from '../hooks/getData'
import { AddButtonDropdown } from '../components/Buttons'
import styles from '../stylesheets/Index.module.css'
import { SearchInput } from '../components/FormOptions'
import SortOptions from '../components/SortOptions'
import BookCover from '../components/books/BookCover'
import { Loading } from '../components/Icons'
import { TabMenu } from '../components/Headings'
import  NoContentFound  from '../components/NoContent'

const Books = () => {
    const { data: books, error, isLoading } = GetData('books')
    const [searchQuery, setSearchQuery] = useState('') // State for search query
    const [sortBy, setSortBy] = useState('title')
    const location = useLocation() // Get the current location

    // Helper function to normalize titles (e.g., remove "The" for sorting)
    const normalizeTitle = (title) => title.replace(/^The\s+/i, '').toLowerCase()

    // Filter books based on the search query
    const filteredBooks = books?.filter((book) =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.series?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) 
    )

    // Sort books based on the selected criterion
    const sortedBooks = filteredBooks?.sort((a, b) => {
        switch (sortBy) {
            case 'title': {
                return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
            }
            case 'author': {
                const authorA = `${a.author?.firstName || ''} ${a.author?.lastName || ''}`.toLowerCase();
                const authorB = `${b.author?.firstName || ''} ${b.author?.lastName || ''}`.toLowerCase();
                return authorA.localeCompare(authorB);
            }
            case 'series': {
                const seriesA = a.series?.title?.toLowerCase() || '';
                const seriesB = b.series?.title?.toLowerCase() || '';
                return seriesA.localeCompare(seriesB);
            }
            case 'pageCount': {
                const pageCountA = a.pageCount || 0;
                const pageCountB = b.pageCount || 0;
                return pageCountA - pageCountB;
            }
            case 'publishDate': {
                const publishDateA = new Date(a.publishDate) || new Date(0);
                const publishDateB = new Date(b.publishDate) || new Date(0);
                return publishDateA - publishDateB;
            }
            case 'createdAt': {
                const createdAtA = new Date(a.createdAt) || new Date(0);
                const createdAtB = new Date(b.createdAt) || new Date(0);
                return createdAtA - createdAtB;
            }
            default:
                return 0;
        }
    });

    const dropdownOptions = [
        { text: 'Search', link: '/books/new/search' },
        { text: 'Manually', link: '/books/new' },
    ]

    if (isLoading) {
        return <Loading /> 
    }

    return (
        <>
        
            {/* <AddButtonDropdown mainText="Add New" options={dropdownOptions} /> */}
            <TabMenu />
            <div className={styles.filterContainer}>
                <SearchInput      
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search books..."
                    className={styles.searchInput}  
                />   
                <SortOptions sortBy={sortBy} setSortBy={setSortBy} object="book" className={styles.sortContainer}/> 
                <AddButtonDropdown mainText="Add New" options={dropdownOptions} />
            </div>

            {error ? (
                <NoContentFound element={`books`}/>
            ) : (
                
            <BookCover 
                books={sortedBooks} 
                subtitle={(book) => {
                    switch (sortBy) {
                        case 'title':
                        case 'author': {
                            return `${book.author?.firstName || ''} ${book.author?.lastName || ''}`;
                        }
                        case 'series': {
                            return `${book.series?.title || ''} ${book.series?.volume || ''}`;
                        }
                        case 'pageCount': {
                            return `${book.pageCount || 0} pages`;
                        }
                        case 'publishDate': {
                            return book.publishDate ? new Date(book.publishDate).toLocaleDateString() : 'No Publish Date';
                        }
                        case 'createdAt': {
                            return new Date(book.createdAt).toLocaleDateString();
                        }
                        default: {
                            return `${book.author?.firstName || ''} ${book.author?.lastName || ''}`;
                        }
                    }
                }}
            />
            )}
           
        </>
    )
}

export default Books