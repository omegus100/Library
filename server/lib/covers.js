// Cover storage adapter.
//   COVER_STORAGE=db     covers stay inside each book document as a data URL (works on Render's free tier)
//   COVER_STORAGE=local  covers are files in COVER_DIR; the book stores "file:<name>" (NAS / Docker volume)
// Reading works for both kinds regardless of the current setting, so switching is safe.
const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')

const MAX_BYTES = 5 * 1024 * 1024
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

const isDataUrl = (v) => typeof v === 'string' && /^data:image\/[a-z+.-]+;base64,/i.test(v)
const isFileRef = (v) => typeof v === 'string' && v.startsWith('file:')

function parseDataUrl(dataUrl) {
    const match = /^data:(image\/[a-z+.-]+);base64,(.*)$/is.exec(dataUrl || '')
    if (!match) return null
    const buffer = Buffer.from(match[2], 'base64')
    return { contentType: match[1].toLowerCase(), buffer }
}

const safeName = (name) => path.basename(String(name)).replace(/[^a-zA-Z0-9._-]/g, '')

function check({ buffer, contentType }) {
    if (!buffer?.length) throw new Error('Empty image')
    if (buffer.length > MAX_BYTES) throw new Error('Cover image is larger than 5 MB')
    if (!EXT[contentType]) throw new Error(`Unsupported image type: ${contentType}`)
}

// Always write a file in COVER_DIR; returns "file:<name>"
async function writeFile(image, bookId) {
    check(image)
    await fs.mkdir(config.coverDir, { recursive: true })
    const hash = crypto.createHash('sha1').update(image.buffer).digest('hex').slice(0, 10)
    const name = `${safeName(bookId)}-${hash}.${EXT[image.contentType]}`
    await fs.writeFile(path.join(config.coverDir, name), image.buffer)
    return `file:${name}`
}

// Store image bytes with the configured adapter; returns the value to save on the book
async function store(image, bookId) {
    check(image)
    if (config.coverStorage === 'local') return writeFile(image, bookId)
    return `data:${image.contentType};base64,${image.buffer.toString('base64')}`
}

// Accepts a data URL from the client and stores it with the configured adapter
async function storeDataUrl(dataUrl, bookId) {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) throw new Error('Cover must be an image')
    return store(parsed, bookId)
}

// Returns { buffer, contentType } or null
async function read(value) {
    if (isDataUrl(value)) return parseDataUrl(value)
    if (isFileRef(value)) {
        const name = safeName(value.slice(5))
        try {
            const buffer = await fs.readFile(path.join(config.coverDir, name))
            const ext = path.extname(name).slice(1)
            const contentType = Object.keys(EXT).find((k) => EXT[k] === ext) || 'application/octet-stream'
            return { buffer, contentType }
        } catch {
            return null
        }
    }
    return null
}

async function remove(value) {
    if (!isFileRef(value)) return
    try { await fs.unlink(path.join(config.coverDir, safeName(value.slice(5)))) } catch { /* already gone */ }
}

module.exports = { isDataUrl, isFileRef, parseDataUrl, store, writeFile, storeDataUrl, read, remove }
