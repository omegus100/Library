const mongoose = require('mongoose')

const { ObjectId } = mongoose.Schema.Types

// Reading statuses used across the app (keep in sync with client/src/components/books/bookObjects.js)
const READING_STATUSES = ['Want To Read', 'Currently Reading', 'Read', 'Did Not Finish']

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: String,
    publishDate: Date,
    pageCount: { type: Number, min: 0 },
    createdAt: { type: Date, required: true, default: Date.now },

    // Author and series are stored on the book (fast lists, no joins). Renaming an author or
    // series updates these copies (see routes/authors.js and routes/series.js).
    author: {
        id: { type: ObjectId, ref: 'Author' },
        firstName: String,
        lastName: String,
    },
    series: {
        id: { type: ObjectId, ref: 'Series' },
        title: String,
        volume: Number,
    },

    format: [String],
    genres: [String],
    publisher: String,
    // String, not Number: keeps leading zeros and allows the "X" check digit in ISBN-10.
    isbn: {
        type: String,
        trim: true,
        set: (value) => (value == null || value === '' ? undefined : String(value).replace(/[\s-]/g, '').toUpperCase()),
    },

    // Cover: a data URL (COVER_STORAGE=db) or "file:<name>" (COVER_STORAGE=local).
    // Never sent in lists; clients load it from GET /api/books/:id/cover.
    coverImagePath: { type: String, select: true },

    // Reading
    readingStatus: { type: String, enum: [...READING_STATUSES, '', null] },
    startedAt: Date,
    finishedAt: Date,
    currentPage: { type: Number, min: 0 },

    // Personal
    rating: { type: Number, min: 0, max: 5 }, // 0 or empty = not rated
    notes: String,
    shelves: [{ type: String, trim: true }],

    // Ownership: false = wishlist (want it, don't own it yet)
    owned: { type: Boolean, default: true },
    loanedTo: { type: String, trim: true },
    loanedAt: Date,

    // Multi-user ready: who this record belongs to
    owner: { type: ObjectId, ref: 'User', index: true },
}, {
    timestamps: { createdAt: false, updatedAt: true },
})

bookSchema.index({ title: 1 })
bookSchema.index({ 'author.id': 1 })
bookSchema.index({ 'series.id': 1 })
bookSchema.index({ isbn: 1 })

bookSchema.statics.READING_STATUSES = READING_STATUSES

module.exports = mongoose.model('Book', bookSchema)
