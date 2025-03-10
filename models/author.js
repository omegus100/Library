const mongoose = require('mongoose')
const Book = require('./book')

const authorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    }
})

// authorSchema.pre('deleteOne', function(next) {
//     Book.find({ author: this.id }, (err, books) => {
//         if (err){
//             next(err)
//         } else if (books.length > 0) {
//             next(new Error('This author has books still'))
//         } else {
//             next()
//         }
//     })
// })


authorSchema.pre("deleteOne", { document: true, query: false }, async function (next) {    
    try {     
        const books = await Book.find({ author: this._id }).exec();
        console.log(books);
        if (books.length > 0) {
          next(new Error("This author has books still"));
        } else {
          next();
        }
      } catch (error) {
        console.log(error);
        next(error);
      }
    }
  );

module.exports = mongoose.model('Author', authorSchema)