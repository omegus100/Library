import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { GetData } from '../hooks/getData'
import { AddButton } from '../components/Buttons'
import styles from '../stylesheets/Index.module.css'
import { SearchInput } from '../components/FormOptions'
import SortOptions from '../components/SortOptions'
import ListLayout from '../components/PageLayouts'
// import { Loading } from '../components/Icons'
import { TabMenu } from '../components/Headings'
import  NoContentFound  from '../components/NoContent' 

const Products = () => {
    const { data: products, error, isLoading } = GetData('products')
    const [searchQuery, setSearchQuery] = useState('')
    // const [sortBy, setSortBy] = useState('lastName')
    // const location = useLocation() // Get the current location

    //  // Filter products based on the search query
    //  const filteredProducts = products?.filter((product) =>
    //     product.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    //     product.lastName.toLowerCase().includes(searchQuery.toLowerCase())
    // )

    // // Sort products by last name, then first name  
    // const sortedProducts = filteredProducts?.sort((a, b) => {
    //     const lastNameA = a.lastName.toLowerCase()
    //     const lastNameB = b.lastName.toLowerCase()
    //     switch (sortBy) {
    //         case 'firstName':
    //             return lastNameA.localeCompare(lastNameB)
    //         case 'lastName':
    //             return lastNameB.localeCompare(lastNameA)
    //         default:
    //             return lastNameA.localeCompare(lastNameB)
    //     }
    // })

    // if (isLoading) {
    //         return <Loading /> 
    // }

    // if (error) {
    //     return <p>Error fetching products: {error.message}</p>
    // }

    return (
        <>
        <div>Product index page</div>
            {/* <div className={styles.indexHeader}>
                <h1>Products</h1>
                
            </div>     */}
            {/* <TabMenu />
            <div className={styles.filterContainer}>
                <SearchInput
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className={styles.searchInput}
                />  
                <SortOptions sortBy={sortBy} setSortBy={setSortBy} object="product" className={styles.sortContainer}/> 
                <Link to="/products/new">
                    <AddButton />               
                </Link> 
            </div> */}

            {products.map((product) => (
                <div key={product._id}>
                    <Link to={`/products/${product._id}`}>
                    
                        <div >{product.title}</div>
                        <div >{product.sku}</div>
                      
                    </Link>
                </div>
            ))}

            {error ? (
                <NoContentFound element={`products`}/>
            ) : (
                <div></div>
                )}   
        </>
    )
}

export default Products
