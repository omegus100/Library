// SQLite storage (libSQL): a local file in Docker, or a hosted Turso database. Same code for both.
const fs = require('fs')
const crypto = require('crypto')
const { fileURLToPath } = require('url')
const { createClient } = require('@libsql/client')
const config = require('../config')

let client

// Schema. Additive changes only: add a new numbered step to MIGRATIONS, never edit an old one.
const MIGRATIONS = [
    [
        `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name TEXT,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'owner',
            token_version INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS authors (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            owner TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS series (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author_id TEXT REFERENCES authors(id) ON DELETE SET NULL,
            owner TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            publish_date TEXT,
            page_count INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            author_id TEXT REFERENCES authors(id) ON DELETE SET NULL,
            series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
            series_volume REAL,
            format TEXT NOT NULL DEFAULT '[]',
            genres TEXT NOT NULL DEFAULT '[]',
            shelves TEXT NOT NULL DEFAULT '[]',
            publisher TEXT,
            isbn TEXT,
            cover TEXT,
            reading_status TEXT,
            started_at TEXT,
            finished_at TEXT,
            current_page INTEGER,
            rating REAL,
            notes TEXT,
            owned INTEGER NOT NULL DEFAULT 1,
            loaned_to TEXT,
            loaned_at TEXT,
            owner TEXT
        )`,
        `CREATE INDEX IF NOT EXISTS books_title ON books(title COLLATE NOCASE)`,
        `CREATE INDEX IF NOT EXISTS books_author ON books(author_id)`,
        `CREATE INDEX IF NOT EXISTS books_series ON books(series_id)`,
        `CREATE INDEX IF NOT EXISTS books_isbn ON books(isbn)`,
        `CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            reading_goal INTEGER NOT NULL DEFAULT 0
        )`,
    ],
    // 2: integrations (Calibre). Settings as JSON; one row per Calibre book, linked to a library book when matched.
    [
        `ALTER TABLE settings ADD COLUMN integrations TEXT NOT NULL DEFAULT '{}'`,
        `CREATE TABLE IF NOT EXISTS calibre_books (
            calibre_id INTEGER PRIMARY KEY,
            uuid TEXT,
            title TEXT NOT NULL,
            authors TEXT,
            series TEXT,
            series_index REAL,
            isbn TEXT,
            formats TEXT NOT NULL DEFAULT '[]',
            has_cover INTEGER NOT NULL DEFAULT 0,
            last_modified TEXT,
            book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
            matched_by TEXT,
            missing INTEGER NOT NULL DEFAULT 0,
            synced_at TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS calibre_books_book ON calibre_books(book_id)`,
    ],
]

async function migrate(c) {
    await c.execute('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
    const rows = (await c.execute('SELECT version FROM schema_version')).rows
    let version = rows.length ? Number(rows[0].version) : 0
    if (!rows.length) await c.execute('INSERT INTO schema_version (version) VALUES (0)')
    for (let i = version; i < MIGRATIONS.length; i++) {
        await c.batch([...MIGRATIONS[i], { sql: 'UPDATE schema_version SET version = ?', args: [i + 1] }], 'write')
        version = i + 1
    }
    return version
}

// Open the database (creating the folder and tables if needed). Safe to call more than once.
async function init() {
    if (client) return client
    if (config.databaseUrl.startsWith('file:')) {
        const file = config.databaseUrl.startsWith('file://') ? fileURLToPath(config.databaseUrl) : config.databaseUrl.slice(5)
        fs.mkdirSync(require('path').dirname(file), { recursive: true })
    }
    client = createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken })
    if (config.databaseUrl.startsWith('file:')) {
        await client.execute('PRAGMA foreign_keys = ON')
        await client.execute('PRAGMA journal_mode = WAL')
    }
    await migrate(client)
    return client
}

const db = () => {
    if (!client) throw new Error('Database not initialised: call init() first')
    return client
}

// Rows come back as array-like objects; turn them into plain objects
const plain = (row) => (row ? Object.fromEntries(Object.entries(row).filter(([k]) => Number.isNaN(Number(k)))) : null)

const all = async (sql, args = []) => (await db().execute({ sql, args })).rows.map(plain)
const get = async (sql, args = []) => plain((await db().execute({ sql, args })).rows[0])
const run = async (sql, args = []) => db().execute({ sql, args })
const batch = async (statements) => db().batch(statements, 'write')

// 24-hex ids, same shape as the old MongoDB ids (so existing links keep working)
const newId = () => crypto.randomBytes(12).toString('hex')
const now = () => new Date().toISOString()

async function ping() {
    try { await db().execute('SELECT 1'); return true } catch { return false }
}

function close() {
    if (client) { client.close(); client = undefined }
}

module.exports = { init, db, all, get, run, batch, newId, now, ping, close }
