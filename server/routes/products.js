const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif']
const upload = require('../models/multer')

// Get all product objects
router.get('/', async (req, res) => {
    try {
        const product = await Product.find({})
        res.json(product)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
});

// POST route for /api/products
router.post('/', async (req, res) => {
    const { title, sku, description, qty, createdAt  } = req.body;
    // Add more fields later for cycles and bins
    const product = new Product({
        title,
        sku,
        description,
        qty
        // ,createdAt
        // Cycle: { id: authorId, firstName: authorFirstName, lastName: authorLastName },
        // bin: { id: seriesId, title: seriesTitle, volume: seriesVolume },
    });

    try {
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ message: 'Failed to create product' });
        console.log(error);
    }
});

module.exports = router