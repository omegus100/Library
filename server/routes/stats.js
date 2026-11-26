const express = require('express')
const Books = require('../db/books')
const { settings: Settings } = require('../db/repos')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

// GET /api/stats?year=2026 -> reading numbers for that year plus library totals
router.get('/stats', async (req, res) => {
    try {
        const year = Number(req.query.year) || new Date().getUTCFullYear()
        const books = await Books.allBooks()
        const yearOf = (d) => new Date(d).getUTCFullYear()

        const finished = books.filter((b) => b.finishedAt && yearOf(b.finishedAt) === year)
        const byMonth = Array(12).fill(0)
        finished.forEach((b) => { byMonth[new Date(b.finishedAt).getUTCMonth()] += 1 })
        const rated = books.filter((b) => b.rating > 0)
        const statuses = {}
        books.forEach((b) => { const k = b.readingStatus || 'none'; statuses[k] = (statuses[k] || 0) + 1 })

        const countBy = (items) => {
            const m = new Map()
            items.forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1) })
            return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
        }
        const years = [...new Set(books.filter((b) => b.finishedAt).map((b) => yearOf(b.finishedAt)))]
        const goal = (await Settings.get()).readingGoal

        res.json({
            year,
            years: [...new Set([year, ...years])].sort((a, b) => b - a),
            goal,
            finishedCount: finished.length,
            pagesRead: finished.reduce((sum, b) => sum + (b.pageCount || 0), 0),
            byMonth,
            finished: finished
                .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
                .map((b) => ({ _id: b._id, title: b.title, author: b.author, finishedAt: b.finishedAt, rating: b.rating })),
            totals: {
                books: books.filter((b) => b.owned !== false).length,
                wishlist: books.filter((b) => b.owned === false).length,
                statuses,
                averageRating: rated.length ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10 : null,
            },
            topAuthors: countBy(books.map((b) => [b.author?.firstName, b.author?.lastName].filter((x) => x && x !== '-').join(' '))),
            topGenres: countBy(books.flatMap((b) => b.genres || [])),
        })
    } catch (err) {
        console.error('Stats failed:', err)
        res.status(500).json({ message: 'Failed to load stats' })
    }
})

router.get('/settings', async (req, res) => {
    res.json(await Settings.get())
})

router.put('/settings', requireOwner, async (req, res) => {
    const goal = Math.max(0, Math.min(1000, Math.round(Number(req.body?.readingGoal) || 0)))
    res.json(await Settings.setReadingGoal(goal))
})

module.exports = router
