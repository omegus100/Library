const mongoose = require('mongoose')

const seriesSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    author: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Author' },
        firstName: String,
        lastName: String,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
})

module.exports = mongoose.model('Series', seriesSchema)
