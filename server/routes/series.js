const express = require('express')
const Series = require('../models/series')
const Author = require('../models/author')
const Book = require('../models/book')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const fail = (res, err, message) => {
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: err.message })
    console.error(message, err)
    res.status(500).json({ message })
}

const authorFor = async (authorId) => {
    if (!authorId) return undefined
    const a = await Author.findById(authorId).lean()
    return a ? { id: a._id, firstName: a.firstName, lastName: a.lastName } : undefined
}

// GET /api/series
router.get('/', async (req, res) => {
    try {
        res.json(await Series.find({}).sort({ title: 1 }).lean())
    } catch (err) {
        fail(res, err, 'Failed to list series')
    }
})

// GET /api/series/:id
router.get('/:id', async (req, res) => {
    try {
        const series = await Series.findById(req.params.id).lean()
        if (!series) return res.status(404).json({ message: 'Series not found' })
        res.json(series)
    } catch (err) {
        if (err.name === 'CastError') return res.status(404).json({ message: 'Series not found' })
        fail(res, err, 'Failed to fetch series')
    }
})

// POST /api/series (owner)
router.post('/', requireOwner, async (req, res) => {
    try {
        const series = await Series.create({
            title: req.body.title,
            author: await authorFor(req.body.authorId),
            owner: req.user.id,
        })
        res.status(201).json(series)
    } catch (err) {
        fail(res, err, 'Failed to save series')
    }
})

// PUT /api/series/:id (owner) — also updates the title stored on its books
router.put('/:id', requireOwner, async (req, res) => {
    try {
        const update = {}
        if (req.body.title !== undefined) update.title = req.body.title
        if (req.body.authorId !== undefined) update.author = await authorFor(req.body.authorId)
        const series = await Series.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
        if (!series) return res.status(404).json({ message: 'Series not found' })
        await Book.updateMany({ 'series.id': series._id }, { $set: { 'series.title': series.title } })
        res.json(series)
    } catch (err) {
        fail(res, err, 'Failed to update series')
    }
})

// DELETE /api/series/:id (owner) — refused while books are in it
router.delete('/:id', requireOwner, async (req, res) => {
    try {
        const inUse = await Book.countDocuments({ 'series.id': req.params.id })
        if (inUse) return res.status(409).json({ message: `This series still has ${inUse} book(s). Remove them from the series first.` })
        const series = await Series.findByIdAndDelete(req.params.id)
        if (!series) return res.status(404).json({ message: 'Series not found' })
        res.json({ message: 'Series deleted', id: req.params.id })
    } catch (err) {
        fail(res, err, 'Failed to delete series')
    }
})

module.exports = router
