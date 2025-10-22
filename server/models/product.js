const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    sku: {
        type: String,
        required: true
    },
    description: String,
    qty: Number, 
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    Cycle: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cycle' },
        title: String
    }
    // Bin: {
    //     id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bin'},
    // },
})

module.exports = mongoose.model('product', productSchema)