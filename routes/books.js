const express = require('express')
const router = express.Router()
const Book = require('../models/book')
const Author = require('../models/author')
const Series = require('../models/series')
const book = require('../models/book')
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif']
const { bookTypes } = require('../models/book')
const { bookGenres } = require('../models/book')

// All Books Route
router.get('/', async (req, res) => {
    let query = Book.find()
    if (req.query.title != null && req.query.title != '' ) {
        query = query.regex('title', new RegExp(req.query.title, 'i'))
    }
    if (req.query.publishedBefore != null && req.query.publishedBefore != '' ) {
        query = query.lte('publishDate', req.query.publishedBefore)
    }
    if (req.query.publishedAfter != null && req.query.publishedAfter != '' ) {
        query = query.gte('publishDate', req.query.publishedAfter)
    }
    try {
        const books = await query.exec()
        res.render('books/index', {
            books: books,
            searchOptions: req.query
           })
    } catch {
        res.redirect('/')
    }
})

// New Book Route
router.get('/new', async (req, res) => {
   renderNewPage(res, new Book())
})

// Create Book Route
router.post('/', async (req, res) => {
    const book = new Book({
        title: req.body.title,
        author: req.body.author,
        publishDate: new Date(req.body.publishDate),
        pageCount: req.body.pageCount,
        description: req.body.description,
        bookType: req.body.bookType,
        bookGenre: req.body.bookGenre
    }) 
    if (req.body.seriesId || req.body.seriesVolume) {
        book.bookSeries = {
            series: req.body.seriesId || null,
            title: req.body.seriesTitle || null,
            volume: req.body.seriesVolume || null
        }
    }
    saveCover(book, req.body.cover)

    try {
        await updateSeriesTitle(book, req.body.seriesId)
        const newBook = await book.save()
        res.redirect(`books/${newBook.id}`)
    } catch (error) {
        console.error('Error creating book:', error) // Log the error
        console.error('Request body:', req.body) // Log the request body
        renderNewPage(res, book, true)
    }
})

// Show Book Route
router.get('/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id).populate('author').exec()  
        res.render('books/show', { book: book })
    } catch {
        res.redirect('/')
    }
})

// Edit Book Route
router.get('/:id/edit', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id)
        renderEditPage(res, book)
    } catch  {
        res.redirect('/')
    }
 })

 // Update Book Route
router.put('/:id', async (req, res) => {
   let book 

    try { 
        book = await Book.findById(req.params.id)
        book.title = req.body.title
        book.author = req.body.author
        book.publishDate = new Date(req.body.publishDate)
        book.pageCount = req.body.pageCount
        book.description = req.body.description
        book.bookType = req.body.bookType
        book.bookGenre = req.body.bookGenre

        // Code for handling series update
        if (!book.bookSeries) {     
            book.bookSeries = {}
        }
        book.bookSeries.series = req.body.seriesId || book.bookSeries.series
        book.bookSeries.volume = req.body.seriesVolume || book.bookSeries.volume
        await updateSeriesTitle(book, req.body.seriesId)
     
        if (req.body.cover != null && req.body.cover != '') {
            saveCover(book, req.body.cover)
        }
        await book.save()
        res.redirect(`/books/${book.id}`)
    } catch (error) {
        // console.error('Error updating book:', error)
        // console.error('Request body:', req.body)
        if (book != null ) {
            renderEditPage(res, book, true)
        } else {         
            redirect('/')
        }      
    }
})

// Delete Book Page
router.delete('/:id', async (req, res) => {
    let book

    try {
        book = await Book.findById(req.params.id)
        await book.deleteOne()
        res.redirect('/books')
    } catch (error) {
        if (book != null) {
            res.render('books/show', {
                book: book,
                errorMessage: 'Could not remove book'
            })
        } else {
            res.redirect('/')
        }
    }
})

async function renderNewPage(res, book, hasError = false) {
    try {
        renderFormPage(res, book, 'new', hasError)
    } catch (error) {
        console.error('Error rendering new page:', error) // Log rendering errors
        res.redirect('/books')
    }
}

async function renderEditPage(res, book, hasError = false) {
    renderFormPage(res, book, 'edit', hasError)
}

async function renderFormPage(res, book, form, hasError = false) {
    try {
        const authors = await Author.find({}) 
        const series = await Series.find({}) 
        const params = {
            authors: authors,
            book: book,
            bookTypes: bookTypes,
            bookGenres: bookGenres,
            series: series
        }
         if (hasError) {
            if (form === 'edit') {
                params.errorMessage = 'Error Updating Book'
            } else {
                params.errorMessage = 'Error Creating Book'
            }
         }
  
        res.render(`books/${form}`, params)
       } catch (error) {
        console.error('Error rendering form page:', error) // Log rendering errors
        res.redirect('/books')
    
       }
}

function saveCover(book, coverEncoded) {
   if(coverEncoded == null) return
   const cover = JSON.parse(coverEncoded)
   if (cover != null && imageMimeTypes.includes(cover.type)) {
    book.coverImage = new Buffer.from(cover.data, 'base64')
    book.coverImageType = cover.type
   }
}

async function updateSeriesTitle(book, seriesId) {
    if (book.bookSeries != null && seriesId) {
        const series = await Series.findById(seriesId);
        if (series) {
            book.bookSeries.title = series.title;
        }
    }
}

module.exports = router
