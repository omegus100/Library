// All server configuration comes from environment variables (Docker/NAS friendly).
require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const crypto = require('crypto')
const path = require('path')
const { pathToFileURL } = require('url')

const list = (value, fallback) =>
  (value || fallback).split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)

let sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex')
  console.warn('SESSION_SECRET is not set: using a random one. Sign-ins will reset when the server restarts.')
}

// Where app data lives (SQLite file + cover files). Docker mounts a volume here.
const dataDir = path.resolve(__dirname, process.env.DATA_DIR || './data')

module.exports = {
  port: Number(process.env.PORT) || 5000,
  dataDir,
  // SQLite database: a local file (default, Docker) or a hosted Turso database
  //   file:/data/library.db            local file
  //   libsql://your-db.turso.io        Turso (also set DATABASE_AUTH_TOKEN)
  databaseUrl: process.env.DATABASE_URL || pathToFileURL(path.join(dataDir, 'library.db')).href,
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  clientOrigins: list(process.env.CLIENT_ORIGIN, 'http://localhost:3000'),
  sessionSecret,
  sessionDays: Number(process.env.SESSION_DAYS) || 30,
  // Covers: "local" files in COVER_DIR (default; Docker) or "db" inside each book (hosted, no disk)
  coverStorage: (process.env.COVER_STORAGE || 'local').toLowerCase(),
  coverDir: path.resolve(__dirname, process.env.COVER_DIR || path.join(dataDir, 'covers')),
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',
  // When set (Docker), Express also serves the built client from this folder
  clientDist: process.env.CLIENT_DIST ? path.resolve(__dirname, process.env.CLIENT_DIST) : '',
}
