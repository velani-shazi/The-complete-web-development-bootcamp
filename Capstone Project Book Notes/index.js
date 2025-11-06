import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book_notes",
  password: process.env.DBPASSWORD, 
  port: 5432,
});

db.connect()
  .then(() => {
    console.log("Connected to PostgreSQL database");
    return db.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        isbn VARCHAR(13),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        date_read DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  })
  .then(() => {
    console.log("Database table ready");
  })
  .catch((err) => {
    console.error("Database connection error:", err);
  });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.set("view engine", "ejs");

function getCoverUrl(isbn, size = "L") {
  if (!isbn) {
    return null;
  }
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

app.get("/", async (req, res) => {
  try {
    const sortBy = req.query.sort || "date_read"; 
    let orderBy = "date_read DESC NULLS LAST";

    if (sortBy === "rating") {
      orderBy = "rating DESC NULLS LAST, title ASC";
    } else if (sortBy === "title") {
      orderBy = "title ASC";
    } else if (sortBy === "date") {
      orderBy = "date_read DESC NULLS LAST, created_at DESC";
    }

    const result = await db.query(
      `SELECT * FROM books ORDER BY ${orderBy}`
    );

    const books = result.rows;

    books.forEach((book) => {
      book.coverUrl = getCoverUrl(book.isbn, "M");
    });

    const totalBooks = books.length;

    res.render("index", {
      books: books,
      totalBooks: totalBooks,
      currentSort: sortBy,
    });
  } catch (err) {
    console.error("Error fetching books:", err);
    res.status(500).send("Error loading books");
  }
});

app.get("/new", (req, res) => {
  res.render("new");
});


app.post("/books", async (req, res) => {
  try {
    const { title, author, isbn, rating, date_read, notes } = req.body;

    if (!title || !author) {
      return res.status(400).send("Title and author are required");
    }

    await db.query(
      `INSERT INTO books (title, author, isbn, rating, date_read, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        title,
        author,
        isbn || null,
        rating ? parseInt(rating) : null,
        date_read || null,
        notes || null,
      ]
    );

    console.log(`Added new book: ${title} by ${author}`);
    res.redirect("/");
  } catch (err) {
    console.error("Error adding book:", err);
    res.status(500).send("Error adding book");
  }
});

app.get("/edit/:id", async (req, res) => {
  try {
    const bookId = req.params.id;

    const result = await db.query("SELECT * FROM books WHERE id = $1", [
      bookId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).send("Book not found");
    }

    const book = result.rows[0];

    if (book.date_read) {
      book.date_read = book.date_read.toISOString().split("T")[0];
    }

    res.render("edit", { book: book });
  } catch (err) {
    console.error("Error fetching book:", err);
    res.status(500).send("Error loading book");
  }
});

app.post("/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const { title, author, isbn, rating, date_read, notes } = req.body;

    if (!title || !author) {
      return res.status(400).send("Title and author are required");
    }

    await db.query(
      `UPDATE books 
       SET title = $1, author = $2, isbn = $3, rating = $4, date_read = $5, notes = $6
       WHERE id = $7`,
      [
        title,
        author,
        isbn || null,
        rating ? parseInt(rating) : null,
        date_read || null,
        notes || null,
        bookId,
      ]
    );

    console.log(`Updated book ID ${bookId}: ${title}`);
    res.redirect("/");
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).send("Error updating book");
  }
});

app.post("/books/:id/delete", async (req, res) => {
  try {
    const bookId = req.params.id;

    const result = await db.query("DELETE FROM books WHERE id = $1", [bookId]);

    if (result.rowCount === 0) {
      return res.status(404).send("Book not found");
    }

    console.log(`Deleted book ID ${bookId}`);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting book:", err);
    res.status(500).send("Error deleting book");
  }
});

app.get("/api/cover/:isbn", async (req, res) => {
  try {
    const isbn = req.params.isbn;
    const coverUrl = getCoverUrl(isbn, "L");

    const response = await axios.head(coverUrl);

    if (response.status === 200) {
      res.json({
        success: true,
        coverUrl: coverUrl,
        isbn: isbn,
      });
    } else {
      res.json({
        success: false,
        message: "Cover not found",
      });
    }
  } catch (err) {
    console.error("Cover fetch error:", err.message);
    res.json({
      success: false,
      message: "Cover not available",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  console.log("\nClosing database connection...");
  await db.end();
  console.log("Database connection closed");
  process.exit(0);
});