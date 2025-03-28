const express = require('express')
const router = express.Router()
const Author = require('../models/author')
const Book = require('../models/book')

// All Authors Route
router.get('/', async (req, res) => {
    let searchOptions = {}
    if (req.query.firstName != null && req.query.firstName !== ''){
        searchOptions.firstName = new RegExp(req.query.firstName, 'i')
    }
    try {    
        const authors = await Author.find(searchOptions)
        res.render('authors/index', { 
            authors: authors, 
            searchOptions: req.query 
        })
    } catch {
        res.redirect('/')
    }  
})

// New Author Route
router.get('/new', (req, res) => {
    res.render('authors/new', { author: new Author()})
})

// New Author Route from Book
router.get('/new-add', (req, res) => {
    res.send("Add new author from book or series page")
    // Capture initial page, post new author routes, and then redirect to original page
    // res.render('authors/new', { author: new Author()})
})

// Create Author Route
router.post('/', async (req, res) => {
    const author = new Author({
        firstName: req.body.firstName,
        lastName: req.body.lastName
    })
    try {
        const newAuthor = await author.save()
        res.redirect(`authors/${newAuthor.id}`)
    } catch {
      res.render('authors/new', {
        author: author,
        errorMessage: 'Error creating Author'
      })  
    }
})

router.get('/:id', async (req, res) => {
    try {
        const author = await Author.findById(req.params.id)
        const books = await Book.find({ author: author.id }).limit(6).exec()
        res.render('authors/show', {
            author: author,
            booksByAuthor: books
        })
    } catch {
        res.redirect('/')
    }
})

router.get('/:id/edit', async (req, res) => {
    try {
        const author = await Author.findById(req.params.id)
        res.render('authors/edit', { author: author })
    } catch {
        res.redirect('/authors')
    }
    
})

router.put('/:id', async (req, res) => {
    let author
    try {
        author = await Author.findById(req.params.id)
        author.firstName = req.body.firstName
        author.lastName = req.body.lastName
        await author.save()
        res.redirect(`/authors/${author.id}`)
    } catch {
        if (author == null){
            res.redirect('/')
        } else {
            res.render('authors/edit', {
                author: author,
                errorMessage: 'Error updating Author'
              }) 
        }
       
    }
})

router.delete('/:id', async (req, res) => {
    let author
    try {
        author = await Author.findById(req.params.id)
        await author.deleteOne()
        res.redirect('/authors')
    } catch {
        if (author == null){
            res.redirect('/')
        } else {
            res.redirect(`/authors/${author.id}`)
        }
       
    }
})

module.exports = router