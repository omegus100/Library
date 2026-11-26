const express = require('express')
const { users: Users } = require('../db/repos')
const { verifyPassword, hashPassword, signToken, requireOwner, loginRateLimit } = require('../lib/auth')

const router = express.Router()

const publicUser = (u) => ({ id: u._id, email: u.email, name: u.name, role: u.role })

// POST /api/auth/login { email, password } -> { token, user }
router.post('/login', loginRateLimit, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = String(req.body?.password || '')
    if (!email || !password) return res.status(400).json({ message: 'Enter your email and password.' })

    try {
        const user = await Users.byEmail(email, true)
        const ok = user && (await verifyPassword(password, user.passwordHash))
        if (!ok) return res.status(401).json({ message: 'That email and password don’t match.' })
        res.json({ token: signToken(user), user: publicUser(user) })
    } catch (err) {
        console.error('Login error:', err)
        res.status(500).json({ message: 'Sign-in failed. Try again.' })
    }
})

// GET /api/auth/me -> the signed-in user, or 401
router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ message: 'Not signed in.' })
    res.json({ user: req.user })
})

// GET /api/auth/status -> { setupNeeded } (true when no owner account exists yet)
router.get('/status', async (req, res) => {
    try {
        res.json({ setupNeeded: (await Users.count()) === 0 })
    } catch {
        res.json({ setupNeeded: false })
    }
})

// POST /api/auth/password { currentPassword, newPassword } (signed in) -> new token; signs out other devices
router.post('/password', requireOwner, async (req, res) => {
    const { currentPassword = '', newPassword = '' } = req.body || {}
    if (String(newPassword).length < 10) return res.status(400).json({ message: 'Use at least 10 characters.' })
    try {
        const user = await Users.byEmail(req.user.email, true)
        if (!user || !(await verifyPassword(String(currentPassword), user.passwordHash))) {
            return res.status(401).json({ message: 'Your current password is wrong.' })
        }
        await Users.setPassword(user._id, await hashPassword(String(newPassword)))
        res.json({ token: signToken(await Users.byId(user._id)) })
    } catch (err) {
        console.error('Password change error:', err)
        res.status(500).json({ message: 'Couldn’t change the password. Try again.' })
    }
})

// POST /api/auth/logout-everywhere (signed in) -> invalidates every token for this account
router.post('/logout-everywhere', requireOwner, async (req, res) => {
    await Users.bumpTokenVersion(req.user.id)
    res.json({ ok: true })
})

module.exports = router
