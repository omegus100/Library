const express = require('express')
const Book = require('../models/book')
const Settings = require('../models/settings')
const { requireOwner } = require('../lib/auth')

const router = express.Router()

const getSettings = async () => (await Settings.findOne({}).lean()) || { readingGoal: 0 }

// GET /api/stats?year=2026 -> reading numbers for that year plus library totals
router.get('/stats', async (req, res) => {
    try {
        const year = Number(req.query.year) || new Date().getUTCFullYear()
        const start = new Date(Date.UTC(year, 0, 1))
        const end = new Date(Date.UTC(year + 1, 0, 1))
        const books = await Book.find({}, { title: 1, author: 1, readingStatus: 1, finishedAt: 1, pageCount: 1, rating: 1, owned: 1, genres: 1, createdAt: 1 }).lean()

        const finished = books.filter((b) => b.finishedAt && b.finishedAt >= start && b.finishedAt < end)
        const byMonth = Array(12).fill(0)
        finished.forEach((b) => { byMonth[new Date(b.finishedAt).getUTCMonth()] += 1 })
        const rated = books.filter((b) => b.rating > 0)
        const statuses = {}
        books.forEach((b) => { const k = b.readingStatus || 'none'; statuses[k] = (statuses[k] || 0) + 1 })

        const countBy = (list, key) => {
            const m = new Map()
            list.forEach((b) => { const k = key(b); if (k) m.set(k, (m.get(k) || 0) + 1) })
            return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }))
        }
        const years = [...new Set(books.filter((b) => b.finishedAt).map((b) => new Date(b.finishedAt).getUTCFullYear()))].sort((a, b) => b - a)
        const settings = await getSettings()

        res.json({
            year,
            years: years.includes(year) ? years : [year, ...years].sort((a, b) => b - a),
            goal: settings.readingGoal || 0,
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
            topAuthors: countBy(books, (b) => [b.author?.firstName, b.author?.lastName].filter(Boolean).join(' ')),
            topGenres: countBy(books.flatMap((b) => (b.genres || []).map((g) => ({ g }))), (x) => x.g),
        })
    } catch (err) {
        console.error('Stats failed:', err)
        res.status(500).json({ message: 'Failed to load stats' })
    }
})

// GET /api/settings
router.get('/settings', async (req, res) => {
    const s = await getSettings()
    res.json({ readingGoal: s.readingGoal || 0 })
})

// PUT /api/settings { readingGoal } (owner)
router.put('/settings', requireOwner, async (req, res) => {
    const goal = Math.max(0, Math.min(1000, Math.round(Number(req.body?.readingGoal) || 0)))
    const s = await Settings.findOneAndUpdate({}, { $set: { readingGoal: goal, owner: req.user.id } }, { upsert: true, new: true })
    res.json({ readingGoal: s.readingGoal })
})

module.exports = router
