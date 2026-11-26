// Settings → Integrations (owner only). Everything here is configured in the app, nothing in code.
const express = require('express')
const { settings: Settings } = require('../db/repos')
const { requireOwner } = require('../lib/auth')
const calibre = require('../lib/calibre')
const calibreSync = require('../lib/calibreSync')

const router = express.Router()
router.use(requireOwner)

const fail = (res, err, fallback) => {
    if (err instanceof calibre.CalibreError) return res.status(err.status).json({ message: err.message })
    console.error(fallback, err)
    res.status(500).json({ message: fallback })
}

// "http://nas:8083/" -> "http://nas:8083"; empty stays empty; anything else is rejected
function cleanUrl(value) {
    const s = String(value || '').trim()
    if (!s) return ''
    let url
    try { url = new URL(s) } catch { throw new calibre.CalibreError('The Calibre-Web address must look like http://your-nas:8083') }
    if (!/^https?:$/.test(url.protocol)) throw new calibre.CalibreError('The Calibre-Web address must start with http:// or https://')
    return s.replace(/\/+$/, '')
}

// GET /api/integrations/calibre
router.get('/calibre', async (req, res) => {
    try { res.json({ ...(await calibreSync.getConfig()), defaultPath: calibre.DEFAULT_PATH }) } catch (err) { fail(res, err, 'Couldn’t load Calibre settings') }
})

// PUT /api/integrations/calibre { enabled, path, webUrl } -> settings (+ a sync when turned on)
router.put('/calibre', async (req, res) => {
    try {
        const body = req.body || {}
        const patch = {}
        if ('path' in body) patch.path = String(body.path || '').trim() || calibre.DEFAULT_PATH
        if ('webUrl' in body) patch.webUrl = cleanUrl(body.webUrl)
        if ('enabled' in body) patch.enabled = Boolean(body.enabled)
        if (patch.enabled) calibre.test(patch.path || (await calibreSync.getConfig()).path) // refuse to turn on a folder that doesn't work
        await Settings.setIntegration('calibre', patch)
        let sync = null
        if (patch.enabled) {
            try { sync = await calibreSync.sync() } catch (err) { sync = { error: err.message } }
        }
        res.json({ ...(await calibreSync.getConfig()), defaultPath: calibre.DEFAULT_PATH, sync })
    } catch (err) {
        fail(res, err, 'Couldn’t save Calibre settings')
    }
})

// POST /api/integrations/calibre/test { path } -> { books }
router.post('/calibre/test', async (req, res) => {
    try {
        const path = String(req.body?.path || '').trim() || (await calibreSync.getConfig()).path
        res.json(calibre.test(path))
    } catch (err) {
        fail(res, err, 'Couldn’t test the Calibre library')
    }
})

// POST /api/integrations/calibre/sync -> counts
router.post('/calibre/sync', async (req, res) => {
    try { res.json(await calibreSync.sync()) } catch (err) { fail(res, err, 'Calibre sync failed') }
})

// GET /api/integrations/calibre/not-in-library -> Calibre books with no library entry
router.get('/calibre/not-in-library', async (req, res) => {
    try { res.json(await calibreSync.notInLibrary()) } catch (err) { fail(res, err, 'Couldn’t list Calibre books') }
})

// POST /api/integrations/calibre/add { ids: [calibreId] } -> { added, linked }
router.post('/calibre/add', async (req, res) => {
    try { res.json(await calibreSync.addToLibrary(req.body?.ids, req.user.id)) } catch (err) { fail(res, err, 'Couldn’t add those books') }
})

module.exports = router
