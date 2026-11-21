const mongoose = require('mongoose')

// A person who can sign in. Today there is one: the owner. Built so more can be added later.
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false }, // "scrypt$<salt>$<hash>"
    role: { type: String, enum: ['owner', 'member'], default: 'owner' },
    // Bumped on password change / "sign out everywhere" to invalidate old tokens
    tokenVersion: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('User', userSchema)
