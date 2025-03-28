const mongoose = require('mongoose')
const Author = require('./author')
const Book = require('./book')

const seriesSchema = new mongoose.Schema({
  title: {
      type: String,
      required: true
  }, 
  author: {   
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: 'Author'
    }
})

seriesSchema.pre("deleteOne", { document: true, query: false }, async function (next) {    
    try {     
        const books = await Book.find({ 'bookSeries.series': this._id }).exec()
        if (books.length > 0) {
          next(new Error("This series has books still"));
        } else {
          next();
        }
      } catch (error) {
        console.log(error);
        next(error);
      }
    }
  );

module.exports = mongoose.model('Series', seriesSchema)