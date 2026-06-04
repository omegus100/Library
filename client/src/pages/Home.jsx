import React, { useEffect, useState } from "react";
import BookCover from "../components/books/BookCover";
import { GetData, GetBookObjectData } from "../hooks/getData";
import { Loading } from "../components/Icons";
import { GridLayout } from "../components/PageLayouts";
import { Link } from "react-router-dom";
import "../stylesheets/main.css";
import styles from "../stylesheets/Home.module.css";

export default function Home() {
  const [totalBooks, setTotalBooks] = useState(0);
  const [recentBooks, setRecentBooks] = useState([]);
  // const [genres, setGenres] = useState([])
  // const [formats, setFormats] = useState([])
  const { data: books, error, isLoading } = GetData("books");
  const { data: authors, error: authorError } = GetData("authors");
  const { data: genres } = GetBookObjectData("genres");
  const { data: formats } = GetBookObjectData("format");

  const newBooksLimit = 5; // Limit for the number of new books to display

  // Process books to find recent ones
  if (books && books.length > 0 && recentBooks.length === 0) {
    // Update total books
    setTotalBooks(books.length);

    // Sort books by dateAdded (assuming books have a `dateAdded` field)
    const sortedBooks = books.sort(
      (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
    );

    // Get the most recent books
    setRecentBooks(sortedBooks.slice(0, newBooksLimit));
  }

  // Update finished books (assuming finished books are those with a reading status of 'finished')
  const finishedBooksCount = books.filter((book) => book.readingStatus === "Read").length;
  const currentBooksCount = books.filter((book) => book.readingStatus === "Currently Reading").length;

  if (isLoading) {
    return <Loading />;
  }

  return (
    <>
      <header>
        <h1>Welcome to Your Library</h1>
        {/* <p>Organize, explore, and enjoy your personal book collection.</p> */}
      </header>

      <div className="homepage">
        <div className="homepage-main-container">

          <section className="homepage-section">
            <div className="grid-card-container">
              <div className="grid-card card-purple-blue">
                <div></div>
                <Link to="/library">
                  <div>
                    <div className="grid-card-title">{totalBooks}</div>
                    <div className="grid-card-subtitle">Total Books</div>
                  </div>
                </Link>
              </div>
              <div className="grid-card card-salmon-pink">
                <div></div>
                <Link to="/authors">
                  <div>
                    <div className="grid-card-title">{authors.length}</div>
                    <div className="grid-card-subtitle">Total Authors</div>
                  </div>
                </Link>
              </div>
              <div className="grid-card card-blue-green">
                <div></div>
                <div>
                  <div className="grid-card-title">{finishedBooksCount}</div>
                  <div className="grid-card-subtitle">Books Read</div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2>New Books</h2>
            <div className="homepage-container">
              <BookCover
                books={recentBooks}
                subtitle={(book) =>
                  `${book.author.firstName} ${book.author.lastName}`
                }
              />
            </div>
          </section>

          <section className="homepage-section">
            <h2>Books by Genre</h2>
            <div className="book-grid">
              <div className="grid-card-container">
                {genres.map((genre, index) => {
                  const genreName = genre.toLowerCase();
                  return (
                    <Link to={`/genres/${genreName}`}>
                      <div className="grid-card" key={index}>

                        <div>
                          <span>{genre}</span>
                        </div>

                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="homepage-section">
            <h2>Books by Format</h2>
            <div className="book-grid">
              <div className="grid-card-container">
                {formats.map((format, index) => {
                  return (
                    <Link to={`/format/${format}`}>
                      <div className="grid-card">

                        <div>
                          <span>{format}</span>
                        </div>

                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>

        </div>
        <div className="homepage-sidebar">
          <div>
            <h2>Currently Reading</h2>
            {/* <div> {currentBooksCount}</div> */}
            <div>
              {books.filter((book) => book.readingStatus === "Currently Reading").map((book, index) => {
                return (
                  <div key={index} className="book-card">
                    <img src={book.coverImagePath} alt={book.title} />
                    <div>{book.title}</div>
                    <span>{book.author.firstName} {book.author.lastName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>



      {/* Search and Filter */}
      {/* <section>
                <h2>Search Your Library</h2>
                <input 
                    type="text" 
                    placeholder="Search by title, author, or genre" 
                    style={{ width: '100%', padding: '10px', marginBottom: '20px' }}
                />
            </section> */}

      {/* Book Highlights */}




      {/* Genres Section */}
      {/* <section>
        <h2>Genres</h2>
        {genres.map((genre, index) => {
          const booksInGenre = books.filter((book) =>
            book.genres.includes(genre)
          ); // Filter books for the genre
          const bookCount = booksInGenre.length; // Count books for each genre
          const limitedBooks = booksInGenre.slice(0, newBooksLimit); // Limit books to listLimit
          const genreName = genre.toLowerCase();

          return (
            <div key={index}>
              <GridLayout
                books={limitedBooks} // Pass only the limited books
                value={genre}
                property="genres"
                count={bookCount} // Pass the book count to the GridLayout component
                object="Genres"
                link={`/genres/${genreName}`}
                limit={limitedBooks.length} // Pass the limit to the GridLayout component
              />
            </div>
          );
        })}
      </section> */}

      {/* Recommendations */}
      {/* <section>
        <h2>Recommendations for You</h2>
        <div className="book-grid">
          <div className="book-card">Recommended Book 1</div>
          <div className="book-card">Recommended Book 2</div>
          <div className="book-card">Recommended Book 3</div>
        </div>
      </section> */}

      {/* Statistics */}

      {/* Interactive Features */}
      {/* <section>
        <h2>Discover a Random Book</h2>
        <button
          style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
          onClick={() => alert('Random Book: "The Great Gatsby"')}
        >
          Suggest a Book
        </button>
      </section> */}
    </>
  );
}
