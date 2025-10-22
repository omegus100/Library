const mongoose = require('mongoose')

const cycleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    countDate: Date, 
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    products: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
    }
    // , format: [String],
    // genres: [String],
    // coverImage: Buffer,
    // coverImageType: String,
    // coverImagePath: String,
    // publisher: String,
    // isbn: Number,
    // readingStatus: String
})

module.exports = mongoose.model('cycle', cycleSchema)