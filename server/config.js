// All server configuration comes from environment variables (Docker/NAS friendly).
require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const crypto = require('crypto')
const path = require('path')

const list = (value, fallback) =>
  (value || fallback).split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)

let sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex')
  console.warn('SESSION_SECRET is not set: using a random one. Sign-ins will reset when the server restarts.')
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/library',
  // Optional: pick the database by name instead of from the URI (e.g. a dev copy)
  mongoDbName: process.env.MONGO_DB_NAME || undefined,
  clientOrigins: list(process.env.CLIENT_ORIGIN, 'http://localhost:3000'),
  sessionSecret,
  sessionDays: Number(process.env.SESSION_DAYS) || 30,
  coverStorage: (process.env.COVER_STORAGE || 'db').toLowerCase(), // db | local
  coverDir: path.resolve(__dirname, process.env.COVER_DIR || './data/covers'),
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',
  // When set (Docker), Express also serves the built client from this folder
  clientDist: process.env.CLIENT_DIST ? path.resolve(__dirname, process.env.CLIENT_DIST) : '',
}
