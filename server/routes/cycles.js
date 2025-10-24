const express = require('express')
const router = express.Router()
const cycle = require('../models/cycle')
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif']
const upload = require('../models/multer')

// Get all cycle objects
router.get('/', async (req, res) => {
    try {
        const cycle = await cycle.find({})
        res.json(cycle)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
});

module.exports = router