const express = require('express')
const { series: Series, authors: Authors } = require('../db/repos')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const fail = (res, err, message) => {
    if (err.status === 400) return res.status(400).json({ message: err.message })
    console.error(message, err)
    res.status(500).json({ message })
}

// Only accept author ids that exist
const validAuthor = async (authorId) => (authorId && (await Authors.byId(authorId)) ? authorId : null)

router.get('/', async (req, res) => {
    try { res.json(await Series.list()) } catch (err) { fail(res, err, 'Failed to list series') }
})

router.get('/:id', async (req, res) => {
    try {
        const series = await Series.byId(req.params.id)
        if (!series) return res.status(404).json({ message: 'Series not found' })
        res.json(series)
    } catch (err) {
        fail(res, err, 'Failed to fetch series')
    }
})

router.post('/', requireOwner, async (req, res) => {
    try {
        res.status(201).json(await Series.create({ title: req.body.title, authorId: await validAuthor(req.body.authorId), owner: req.user.id }))
    } catch (err) {
        fail(res, err, 'Failed to save series')
    }
})

router.put('/:id', requireOwner, async (req, res) => {
    try {
        const update = { title: req.body.title }
        if (req.body.authorId !== undefined) update.authorId = await validAuthor(req.body.authorId)
        const series = await Series.update(req.params.id, update)
        if (!series) return res.status(404).json({ message: 'Series not found' })
        res.json(series)
    } catch (err) {
        fail(res, err, 'Failed to update series')
    }
})

router.delete('/:id', requireOwner, async (req, res) => {
    try {
        if (!(await Series.byId(req.params.id))) return res.status(404).json({ message: 'Series not found' })
        const inUse = await Series.bookCount(req.params.id)
        if (inUse) return res.status(409).json({ message: `This series still has ${inUse} book(s). Remove them from the series first.` })
        await Series.remove(req.params.id)
        res.json({ message: 'Series deleted', id: req.params.id })
    } catch (err) {
        fail(res, err, 'Failed to delete series')
    }
})

module.exports = router
