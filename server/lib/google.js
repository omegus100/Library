// Google Books lookup, done by the server (optional API key, short cache, cover fetching).
const axios = require('axios')
const config = require('../config')

const API = 'https://www.googleapis.com/books/v1/volumes'
const COVER_HOSTS = new Set(['books.google.com', 'books.googleusercontent.com'])
const CACHE_MS = 10 * 60 * 1000
const cache = new Map()

class LookupError extends Error {
    constructor(message, status) { super(message); this.status = status }
}

const pickIsbn = (ids = []) =>
    ids.find((i) => i.type === 'ISBN_13')?.identifier || ids.find((i) => i.type === 'ISBN_10')?.identifier || ''

function splitName(full = '') {
    const parts = full.trim().split(/\s+/).filter(Boolean)
    return {
        firstName: parts.slice(0, -1).join(' ') || (parts.length ? '' : ''),
        lastName: parts.slice(-1).join(' ') || '',
    }
}

// Map a Google volume to the app's book shape
function mapVolume(item) {
    const v = item.volumeInfo || {}
    const author = splitName(v.authors?.[0])
    const thumb = (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace(/^http:/, 'https:')
    return {
        googleId: item.id,
        title: [v.title, v.subtitle].filter(Boolean).join(': ') || '',
        authors: v.authors || [],
        authorFirstName: author.firstName,
        authorLastName: author.lastName,
        description: v.description || '',
        publishDate: v.publishedDate || '',
        pageCount: v.pageCount || undefined,
        genres: v.categories || [],
        publisher: v.publisher || '',
        isbn: pickIsbn(v.industryIdentifiers),
        coverUrl: thumb ? `${thumb.replace(/&edge=curl/, '')}&fife=w800` : '',
    }
}

async function query(params) {
    const key = JSON.stringify(params)
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return hit.value

    try {
        const { data } = await axios.get(API, {
            params: { ...params, key: config.googleBooksApiKey || undefined },
            timeout: 10000,
        })
        const value = (data.items || []).map(mapVolume)
        cache.set(key, { value, expires: Date.now() + CACHE_MS })
        if (cache.size > 200) cache.delete(cache.keys().next().value)
        return value
    } catch (err) {
        const status = err.response?.status
        if (status === 429 || status === 403) {
            throw new LookupError('Google Books is limiting searches right now. Try again in a few minutes.', 429)
        }
        throw new LookupError('Google Books didn’t respond. Try again.', 502)
    }
}

const search = (q) => query({ q, maxResults: 20, printType: 'books' })
const byIsbn = (isbn) => query({ q: `isbn:${String(isbn).replace(/[\s-]/g, '')}`, maxResults: 5 })

const isCoverUrl = (value) => {
    try {
        const url = new URL(value)
        return ['https:', 'http:'].includes(url.protocol) && COVER_HOSTS.has(url.hostname)
    } catch {
        return false
    }
}

// Download a Google Books cover image -> { buffer, contentType }
async function fetchCover(url) {
    if (!isCoverUrl(url)) throw new LookupError('Only Google Books cover URLs are allowed', 400)
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        maxContentLength: 5 * 1024 * 1024,
        maxRedirects: 3,
        beforeRedirect: (options) => {
            if (!COVER_HOSTS.has(options.hostname)) throw new Error(`Redirect to disallowed host: ${options.hostname}`)
        },
    })
    const contentType = String(response.headers['content-type'] || '').split(';')[0]
    if (!contentType.startsWith('image/')) throw new LookupError('Not an image', 415)
    return { buffer: Buffer.from(response.data), contentType }
}

module.exports = { search, byIsbn, fetchCover, isCoverUrl, LookupError }
