const mongoose = require('mongoose')

// Per-owner preferences that live on the server (e.g. yearly reading goal)
const settingsSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
    readingGoal: { type: Number, min: 0, default: 0 }, // books per year; 0 = no goal
})

module.exports = mongoose.model('Settings', settingsSchema)
