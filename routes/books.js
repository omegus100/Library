const express = require('express')
const router = express.Router()
const Book = require('../models/book')

// All Books Route
router.get('/', async (req, res) => {
   res.send('All Books') 
})

// New Book Route
router.get('/new', (req, res) => {
    res.send('New Books') 
})

// Create Book Route
router.post('/', async (req, res) => {
    res.send('Create Books')  
})

module.exports = router