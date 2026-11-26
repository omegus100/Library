// The Express app (no listening here, so scripts and tests can import it).
const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const { ping } = require('./db')
const config = require('./config')
const google = require('./lib/google')
const { attachUser } = require('./lib/auth')

const app = express()
app.set('trust proxy', 1) // correct client IPs behind Render / a reverse proxy (login rate limit)
app.disable('x-powered-by')

// CORS: only the client origin(s) may call the API from a browser. Same-origin requests have no
// Origin header and are always allowed (Docker setup serves the client from this server).
app.use(cors({
    origin(origin, callback) {
        callback(null, !origin || config.clientOrigins.includes(origin))
    },
}))
app.use(express.json({ limit: '10mb' })) // cover uploads arrive as data URLs
app.use(attachUser)

// Health check for Docker / uptime monitors
app.get('/api/health', async (req, res) => {
    const up = await ping()
    res.status(up ? 200 : 503).json({ ok: up, db: up ? 'up' : 'down' })
})

app.use('/api/auth', require('./routes/auth'))
app.use('/api/books', require('./routes/books'))
app.use('/api/authors', require('./routes/authors'))
app.use('/api/series', require('./routes/series'))
app.use('/api/lookup', require('./routes/lookup'))
app.use('/api/integrations', require('./routes/integrations'))
app.use('/api', require('./routes/stats'))
app.use('/api', require('./routes/data'))

// Legacy cover proxy used by the previous client version (Google covers only). Safe to remove
// once the new client is deployed everywhere.
app.get('/proxy', async (req, res) => {
    try {
        const image = await google.fetchCover(String(req.query.url || ''))
        res.type(image.contentType).send(image.buffer)
    } catch (err) {
        res.status(err.status || 502).send('Error fetching image')
    }
})

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }))

// Docker / NAS: serve the built client and let React Router handle every other path
if (config.clientDist && fs.existsSync(path.join(config.clientDist, 'index.html'))) {
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }))
    app.get('/{*path}', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')))
}

// Last-resort error handler (e.g. malformed JSON)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON' })
    if (err.type === 'entity.too.large') return res.status(413).json({ message: 'That upload is too large.' })
    console.error('Unhandled error:', err)
    res.status(500).json({ message: 'Something went wrong' })
})

module.exports = app
