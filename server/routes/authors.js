const express = require('express')
const { authors: Authors } = require('../db/repos')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const fail = (res, err, message) => {
    if (err.status === 400) return res.status(400).json({ message: err.message })
    console.error(message, err)
    res.status(500).json({ message })
}

router.get('/', async (req, res) => {
    try { res.json(await Authors.list()) } catch (err) { fail(res, err, 'Failed to list authors') }
})

router.get('/:id', async (req, res) => {
    try {
        const author = await Authors.byId(req.params.id)
        if (!author) return res.status(404).json({ message: 'Author not found' })
        res.json(author)
    } catch (err) {
        fail(res, err, 'Failed to fetch author')
    }
})

router.post('/', requireOwner, async (req, res) => {
    try {
        res.status(201).json(await Authors.create({ firstName: req.body.firstName, lastName: req.body.lastName, owner: req.user.id }))
    } catch (err) {
        fail(res, err, 'Failed to save author')
    }
})

// Books and series show the author's current name (they reference the author), so a rename shows everywhere
router.put('/:id', requireOwner, async (req, res) => {
    try {
        if (!(await Authors.byId(req.params.id))) return res.status(404).json({ message: 'Author not found' })
        res.json(await Authors.update(req.params.id, { firstName: req.body.firstName, lastName: req.body.lastName }))
    } catch (err) {
        fail(res, err, 'Failed to update author')
    }
})

// Refused while books still use this author
router.delete('/:id', requireOwner, async (req, res) => {
    try {
        if (!(await Authors.byId(req.params.id))) return res.status(404).json({ message: 'Author not found' })
        const inUse = await Authors.bookCount(req.params.id)
        if (inUse) return res.status(409).json({ message: `This author still has ${inUse} book(s). Delete or reassign them first.` })
        await Authors.remove(req.params.id)
        res.json({ message: 'Author deleted', id: req.params.id })
    } catch (err) {
        fail(res, err, 'Failed to delete author')
    }
})

module.exports = router
