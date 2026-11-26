// Users, authors, series and settings. Plain objects in, plain objects out (API shape: _id, camelCase).
const { all, get, run, newId, now } = require('./index')

const { fold } = require('../lib/match')

// Series names ignore case, accents, punctuation and a leading The/A/An ("Reckoners" = "The Reckoners")
const seriesKey = (s) => fold(s).replace(/^\s*(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '')
// Author first names compare without case, accents, dots or spaces ("George R. R." = "George R.R.")
const key = (s) => fold(s).replace(/[^a-z0-9]/g, '')

// ---------- users ----------

const toUser = (r, withHash = false) => r && ({
    _id: r.id,
    email: r.email,
    name: r.name || undefined,
    role: r.role,
    tokenVersion: Number(r.token_version) || 0,
    createdAt: r.created_at,
    ...(withHash ? { passwordHash: r.password_hash } : {}),
})

const users = {
    count: async () => Number((await get('SELECT COUNT(*) n FROM users')).n),
    byId: async (id) => toUser(await get('SELECT * FROM users WHERE id = ?', [id])),
    byEmail: async (email, withHash = false) => toUser(await get('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]), withHash),
    async create({ email, passwordHash, role = 'owner', name, id, createdAt, tokenVersion = 0 }) {
        const row = [id || newId(), String(email).trim().toLowerCase(), name || null, passwordHash, role, tokenVersion, createdAt || now()]
        await run('INSERT INTO users (id, email, name, password_hash, role, token_version, created_at) VALUES (?,?,?,?,?,?,?)', row)
        return users.byId(row[0])
    },
    setPassword: (id, passwordHash) => run('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [passwordHash, id]),
    bumpTokenVersion: (id) => run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]),
    remove: (email) => run('DELETE FROM users WHERE email = ?', [String(email).toLowerCase()]),
}

// ---------- authors ----------

const toAuthor = (r) => r && ({ _id: r.id, firstName: r.first_name, lastName: r.last_name, owner: r.owner || undefined })

const authors = {
    list: async () => (await all('SELECT * FROM authors ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE')).map(toAuthor),
    byId: async (id) => toAuthor(await get('SELECT * FROM authors WHERE id = ?', [id])),
    async create({ firstName, lastName, owner, id }) {
        const first = String(firstName || '').trim()
        const last = String(lastName || '').trim()
        if (!first || !last) throw Object.assign(new Error('First and last name are required'), { status: 400 })
        const authorId = id || newId()
        await run('INSERT INTO authors (id, first_name, last_name, owner) VALUES (?,?,?,?)', [authorId, first, last, owner || null])
        return authors.byId(authorId)
    },
    async update(id, { firstName, lastName }) {
        const first = String(firstName || '').trim()
        const last = String(lastName || '').trim()
        if (!first || !last) throw Object.assign(new Error('First and last name are required'), { status: 400 })
        await run('UPDATE authors SET first_name = ?, last_name = ? WHERE id = ?', [first, last, id])
        return authors.byId(id)
    },
    bookCount: async (id) => Number((await get('SELECT COUNT(*) n FROM books WHERE author_id = ?', [id])).n),
    remove: (id) => run('DELETE FROM authors WHERE id = ?', [id]),
    // "R.F. Kuang" / "R. F.  Kuang" -> the same author; created if missing
    async findOrCreateByName(fullName, owner) {
        const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
        if (!parts.length) return null
        const lastName = parts.pop()
        const firstName = parts.join(' ') || '-'
        const candidates = await all('SELECT * FROM authors WHERE last_name = ? COLLATE NOCASE', [lastName])
        const match = candidates.find((a) => key(a.first_name) === key(firstName))
        return match ? toAuthor(match) : authors.create({ firstName, lastName, owner })
    },
}

// ---------- series ----------

const SERIES_SELECT = `SELECT s.*, a.first_name, a.last_name FROM series s LEFT JOIN authors a ON a.id = s.author_id`
const toSeries = (r) => r && ({
    _id: r.id,
    title: r.title,
    author: r.author_id ? { id: r.author_id, firstName: r.first_name, lastName: r.last_name } : undefined,
    owner: r.owner || undefined,
})

const series = {
    list: async () => (await all(`${SERIES_SELECT} ORDER BY s.title COLLATE NOCASE`)).map(toSeries),
    byId: async (id) => toSeries(await get(`${SERIES_SELECT} WHERE s.id = ?`, [id])),
    async create({ title, authorId, owner, id }) {
        const t = String(title || '').trim()
        if (!t) throw Object.assign(new Error('Title is required'), { status: 400 })
        const seriesId = id || newId()
        await run('INSERT INTO series (id, title, author_id, owner) VALUES (?,?,?,?)', [seriesId, t, authorId || null, owner || null])
        return series.byId(seriesId)
    },
    async update(id, { title, authorId }) {
        const current = await series.byId(id)
        if (!current) return null
        const t = title !== undefined ? String(title).trim() : current.title
        if (!t) throw Object.assign(new Error('Title is required'), { status: 400 })
        const a = authorId !== undefined ? authorId || null : current.author?.id || null
        await run('UPDATE series SET title = ?, author_id = ? WHERE id = ?', [t, a, id])
        return series.byId(id)
    },
    // Same name by the same author (or a series with no author set), else a new series.
    // Names compare loosely: case, accents, punctuation and a leading The/A/An are ignored ("Reckoners" = "The Reckoners").
    async findOrCreate(title, authorId, owner) {
        const t = String(title || '').replace(/\s+/g, ' ').trim()
        if (!t) return null
        const k = seriesKey(t)
        const rows = await all('SELECT id, title, author_id FROM series WHERE author_id = ? OR author_id IS NULL ORDER BY author_id IS NULL', [authorId || ''])
        const row = rows.find((r) => seriesKey(r.title) === k)
        return row ? series.byId(row.id) : series.create({ title: t, authorId, owner })
    },
    bookCount: async (id) => Number((await get('SELECT COUNT(*) n FROM books WHERE series_id = ?', [id])).n),
    remove: (id) => run('DELETE FROM series WHERE id = ?', [id]),
}

// ---------- settings (one row) ----------

const settings = {
    async get() {
        const r = await get('SELECT reading_goal FROM settings WHERE id = 1')
        return { readingGoal: r ? Number(r.reading_goal) || 0 : 0 }
    },
    async setReadingGoal(goal) {
        await run('INSERT INTO settings (id, reading_goal) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET reading_goal = excluded.reading_goal', [goal])
        return settings.get()
    },
    // Integration settings, e.g. { calibre: { enabled, path, webUrl, lastSync, lastResult } }
    async integrations() {
        const r = await get('SELECT integrations FROM settings WHERE id = 1')
        try { return JSON.parse(r?.integrations || '{}') || {} } catch { return {} }
    },
    // Merge `patch` into one integration's settings and return the new value
    async setIntegration(name, patch) {
        const all = await settings.integrations()
        all[name] = { ...(all[name] || {}), ...patch }
        await run('INSERT INTO settings (id, integrations) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET integrations = excluded.integrations', [JSON.stringify(all)])
        return all[name]
    },
}

module.exports = { users, authors, series, settings }
