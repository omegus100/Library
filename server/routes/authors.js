const express = require('express')
const Author = require('../models/author')
const Book = require('../models/book')
const Series = require('../models/series')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const fail = (res, err, message) => {
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: err.message })
    console.error(message, err)
    res.status(500).json({ message })
}

// GET /api/authors
router.get('/', async (req, res) => {
    try {
        res.json(await Author.find({}).sort({ lastName: 1, firstName: 1 }).lean())
    } catch (err) {
        fail(res, err, 'Failed to list authors')
    }
})

// GET /api/authors/:id
router.get('/:id', async (req, res) => {
    try {
        const author = await Author.findById(req.params.id).lean()
        if (!author) return res.status(404).json({ message: 'Author not found' })
        res.json(author)
    } catch (err) {
        if (err.name === 'CastError') return res.status(404).json({ message: 'Author not found' })
        fail(res, err, 'Failed to fetch author')
    }
})

// POST /api/authors (owner)
router.post('/', requireOwner, async (req, res) => {
    try {
        const author = await Author.create({
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            owner: req.user.id,
        })
        res.status(201).json(author)
    } catch (err) {
        fail(res, err, 'Failed to save author')
    }
})

// PUT /api/authors/:id (owner) — also updates the name stored on their books and series
router.put('/:id', requireOwner, async (req, res) => {
    try {
        const author = await Author.findByIdAndUpdate(
            req.params.id,
            { firstName: req.body.firstName, lastName: req.body.lastName },
            { new: true, runValidators: true }
        )
        if (!author) return res.status(404).json({ message: 'Author not found' })
        const names = { firstName: author.firstName, lastName: author.lastName }
        await Promise.all([
            Book.updateMany({ 'author.id': author._id }, { $set: { 'author.firstName': names.firstName, 'author.lastName': names.lastName } }),
            Series.updateMany({ 'author.id': author._id }, { $set: { 'author.firstName': names.firstName, 'author.lastName': names.lastName } }),
        ])
        res.json(author)
    } catch (err) {
        fail(res, err, 'Failed to update author')
    }
})

// DELETE /api/authors/:id (owner) — refused while books still use this author
router.delete('/:id', requireOwner, async (req, res) => {
    try {
        const inUse = await Book.countDocuments({ 'author.id': req.params.id })
        if (inUse) return res.status(409).json({ message: `This author still has ${inUse} book(s). Delete or reassign them first.` })
        const author = await Author.findByIdAndDelete(req.params.id)
        if (!author) return res.status(404).json({ message: 'Author not found' })
        res.json({ message: 'Author deleted', id: req.params.id })
    } catch (err) {
        fail(res, err, 'Failed to delete author')
    }
})

module.exports = router
