const express = require('express')
const router = express.Router()
const Author = require('../models/author')
const Book = require('../models/book')
const Series = require('../models/series')

// All Series Route
router.get('/', async (req, res) =>{
    try {
        const series = await Series.find({})
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