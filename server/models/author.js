const mongoose = require('mongoose')

const authorSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
})

module.exports = mongoose.model('Author', authorSchema)
