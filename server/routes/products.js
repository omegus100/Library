const express = require('express')
const router = express.Router()
const product = require('../models/product')
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif']
const upload = require('../models/multer')
const { readingStatus } = require('../../client/src/components/products/productObjects')

// Get all product objects
router.get('/', async (req, res) => {
    try {
        const product = await product.find({})
        res.json(product)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
});

module.exports = router