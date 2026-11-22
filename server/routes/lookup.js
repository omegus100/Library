const express = require('express')
const google = require('../lib/google')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

// GET /api/lookup?q=...   or   ?isbn=...   (owner) -> Google Books results in the app's book shape
// Done on the server so an API key (GOOGLE_BOOKS_API_KEY) can be used and results cached.
router.get('/', requireOwner, async (req, res) => {
    const q = String(req.query.q || '').trim()
    const isbn = String(req.query.isbn || '').replace(/[\s-]/g, '')
    if (!q && !isbn) return res.status(400).json({ message: 'Enter a title, author or ISBN.' })
    try {
        res.json(isbn ? await google.byIsbn(isbn) : await google.search(q))
    } catch (err) {
        res.status(err.status || 502).json({ message: err.message || 'Lookup failed.' })
    }
})

// GET /api/lookup/cover?url=... (owner) -> the image, for previews (Google covers only)
router.get('/cover', requireOwner, async (req, res) => {
    try {
        const image = await google.fetchCover(String(req.query.url || ''))
        res.set('Cache-Control', 'private, max-age=3600')
        res.type(image.contentType).send(image.buffer)
    } catch (err) {
        res.status(err.status || 502).end()
    }
})

module.exports = router
