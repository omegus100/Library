const express = require('express')
const router = express.Router()
const Author = require('../models/author')
const Book = require('../models/book')
const Series = require('../models/series')

// All Series Route
router.get('/', async (req, res) =>{
    let query = Series.find()
    if (req.query.title != null && req.query.title != '' ) {
        query = query.regex('title', new RegExp(req.query.title, 'i'))
    }
    try {
        const series = await query.exec()
        res.render('series/index', {
            series: series,
            searchOptions: req.query
        })
    } catch (error) {
        res.redirect('/')
    }
})

// New Series Route
router.get('/new', async (req, res) =>{
   renderNewPage(res, new Series())
})

// Create Series Route
router.post('/', async (req, res) => {
    const series = new Series({
        title: req.body.title,
        author: req.body.author
    }) 

    try {
        const newSeries = await series.save()
        // res.redirect(`series/${newSeries.id}`)
        res.redirect(`series`)
    } catch {
        renderNewPage(res, series, true)
    }
})

// Show Series Route
router.get('/:id', async (req, res) => {
    try {
        const series = await Series.findById(req.params.id).populate('author').exec()
        const books = await Book.find({ 'bookSeries.series': series.id })
        res.render('series/show', {
             series: series,
             booksBySeries: books
            })
    } catch {
        res.redirect('/')
    }
})

// Edit Series Route
router.get('/:id/edit', async (req, res) => {
    try {
        const series = await Series.findById(req.params.id)
        const authors = await Author.find({}) 
        res.render('series/edit', { 
            series: series, 
            authors: authors 
        })
    } catch {
        res.redirect('/series')
    }
    
})

// Update Series Route
router.put('/:id', async (req, res) => {
    let series
    try {
        series = await Series.findById(req.params.id)
        series.title = req.body.title
        series.author = req.body.author
        await series.save()
        res.redirect(`/series/${series.id}`)
    } catch {
        if (series == null){
            res.redirect('/')
        } else {
            res.render('series/edit', {
                series: series,
                errorMessage: 'Error updating Series'
              }) 
        }  
    }
})

// Delete Series Page
router.delete('/:id', async (req, res) => {
    let series

    try {
        series = await Series.findById(req.params.id)
        await series.deleteOne()
        res.redirect('/series')
    } catch {
        if (series == null){
            res.redirect('/')
        } else {
            res.redirect(`/series/${series.id}`)
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

async function renderNewPage(res, series, hasError = false) {
    try {
        const authors = await Author.find({})
        const params = { 
            authors: authors,
            series: series
        }
        if (hasError) params.errorMessage = 'Error creating series'
        // const series = new Series()
        res.render('series/new', params)
    } catch {
        res.redirect('/series')
    }
}

module.exports = router