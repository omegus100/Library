// Owner sign-in: scrypt password hashes + HMAC-signed bearer tokens. Node built-ins only.
//
// Tokens go in the Authorization header (not a cookie) so sign-in works when the site and the
// API are on different domains (Netlify + Render) — Safari blocks those cross-site cookies.
const crypto = require('crypto')
const config = require('../config')
const { users: Users } = require('../db/repos')

const b64url = (buf) => Buffer.from(buf).toString('base64url')

async function hashPassword(password) {
    const salt = crypto.randomBytes(16)
    const hash = await new Promise((resolve, reject) =>
        crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))))
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

async function verifyPassword(password, stored) {
    const [scheme, saltHex, hashHex] = String(stored || '').split('$')
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
    const expected = Buffer.from(hashHex, 'hex')
    const actual = await new Promise((resolve, reject) =>
        crypto.scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, (err, key) => (err ? reject(err) : resolve(key))))
    return crypto.timingSafeEqual(actual, expected)
}

const sign = (payload) => b64url(crypto.createHmac('sha256', config.sessionSecret).update(payload).digest())

function signToken(user) {
    const body = b64url(JSON.stringify({
        sub: String(user._id),
        v: user.tokenVersion || 0,
        exp: Date.now() + config.sessionDays * 24 * 60 * 60 * 1000,
    }))
    return `${body}.${sign(body)}`
}

function readToken(token) {
    const [body, signature] = String(token || '').split('.')
    if (!body || !signature) return null
    const expected = sign(body)
    if (signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
        return payload.exp > Date.now() ? payload : null
    } catch {
        return null
    }
}

// Attaches req.user when a valid token is present. Never blocks.
async function attachUser(req, res, next) {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const payload = token && readToken(token)
    if (payload) {
        try {
            const user = await Users.byId(payload.sub)
            if (user && (user.tokenVersion || 0) === payload.v) {
                req.user = { id: String(user._id), email: user.email, name: user.name, role: user.role }
            }
        } catch { /* invalid id: treat as signed out */ }
    }
    next()
}

// Blocks writes unless the owner is signed in
function requireOwner(req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Sign in to make changes.' })
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Only the owner can make changes.' })
    next()
}

// Very small in-memory limiter for login attempts (per IP)
const attempts = new Map()
function loginRateLimit(req, res, next) {
    const key = req.ip
    const now = Date.now()
    const entry = attempts.get(key) || { count: 0, reset: now + 15 * 60 * 1000 }
    if (now > entry.reset) { entry.count = 0; entry.reset = now + 15 * 60 * 1000 }
    if (entry.count >= 10) {
        return res.status(429).json({ message: 'Too many sign-in attempts. Try again in 15 minutes.' })
    }
    entry.count += 1
    attempts.set(key, entry)
    res.on('finish', () => { if (res.statusCode < 400) attempts.delete(key) })
    next()
}

module.exports = { hashPassword, verifyPassword, signToken, readToken, attachUser, requireOwner, loginRateLimit }
