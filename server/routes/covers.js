// Bulk "Find missing covers" (owner). The client calls /fill repeatedly with the returned cursor,
// so each request stays short and the page can show progress.
const express = require('express')
const { requireOwner } = require('../lib/auth')
const finder = require('../lib/coverFinder')
const calibreSync = require('../lib/calibreSync')

const router = express.Router()
router.use(requireOwner)

const BATCH = 6

// GET /api/covers/missing -> { count }
router.get('/missing', async (req, res) => {
    try { res.json({ count: await finder.missingCount() }) } catch (err) {
        console.error('Cover count failed:', err)
        res.status(500).json({ message: 'Couldn’t count missing covers' })
    }
})

// POST /api/covers/fill { after, googleBlocked } -> { results: [{ id, title, source }], next, remaining, googleBlocked }
// First call (no `after`): links new books to Calibre ebooks first, which brings their Calibre covers.
router.post('/fill', async (req, res) => {
    try {
        const after = typeof req.body?.after === 'string' ? req.body.after : ''
        const state = { googleBlocked: Boolean(req.body?.googleBlocked) }
        if (!after && (await calibreSync.getConfig()).enabled) {
            try { await calibreSync.sync() } catch (err) { console.warn('Calibre sync before cover search failed:', err.message) }
        }
        const batch = await finder.missingBatch(after, BATCH)
        const results = []
        for (const b of batch) {
            let source = null
            try { source = await finder.fill(b.id, state) } catch (err) { console.warn(`Cover for "${b.title}" failed:`, err.message) }
            results.push({ id: b.id, title: b.title, source })
        }
        const next = batch.length === BATCH ? batch[batch.length - 1].id : null
        res.json({ results, next, remaining: await finder.missingCount(), googleBlocked: state.googleBlocked })
    } catch (err) {
        console.error('Cover search failed:', err)
        res.status(500).json({ message: 'Cover search failed' })
    }
})

module.exports = router
