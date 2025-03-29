const mongoose = require('mongoose')

const bookTypes = ['Paperback','Hardback', 'eBook', 'Audiobook']
const bookGenres = ["Biography", "Classics", "Fantasy", "Historical Fiction", "Horror", "Mystery", "Non-Fiction", "Romance", "Science Fiction", "Thriller", "Young Adult"]


const BookSeriesSchema = new mongoose.Schema({ 
    series: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Series'
    },
    title: String,
    volume: Number 
})

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    publishDate: Date,
    pageCount: Number, 
    createdAt: {
        type: Date,
        default: Date.now
    },
    coverImage:  {
        type: Buffer,
        required: true
    },
    coverImageType: String, 
    author: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Author'
    },
    bookSeries: BookSeriesSchema, 
    bookType: {
        type: [String],
        enum: bookTypes
    }, 
    bookGenre: {
        type: [String],
        enum: bookGenres
    } 
})

bookSchema.virtual('coverImagePath').get(function() {
    if (this.coverImage != null && this.coverImageType != null) {
        return `data:${this.coverImageType};charset=utf-8;base64,${this.coverImage.toString('base64')}`
    }
})

module.exports = mongoose.model('Book', bookSchema)
module.exports.bookTypes = bookTypes
module.exports.bookGenres = bookGenres

