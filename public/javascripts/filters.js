// Function to remove "The" from titles that begin with it
function filterTitles(books) {
    return books.map(book => {
        if (book.title.toLowerCase().startsWith('the ')) {
            book.filterTitle = book.title.substring(4); // Assign the modified title to book.filterTitle
        } else {
            book.filterTitle = book.title; // If no modification, keep the original title
        }
        return book;
    });
}

module.exports = { filterTitles };