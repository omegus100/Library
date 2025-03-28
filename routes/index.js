const express = require('express')
const router = express.Router()
const Book = require('../models/book')
const { filterTitles } = require('../public/javascripts/filters')

router.get('/', async (req, res) => {
    try {
        const allBooks = await Book.find().exec()
        const filteredBooks = filterTitles(allBooks);
        const sortedBooks = filteredBooks.sort((a, b) => a.filterTitle.localeCompare(b.filterTitle));

        res.render('index', { books: sortedBooks });
    } catch {
        res.render('index', { books: [] });
    }
});

module.exports = router