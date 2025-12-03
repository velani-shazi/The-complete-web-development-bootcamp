import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const port = 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

function getCoverUrl(isbn, size = "L") {
  if (!isbn) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
  try {
    const sortBy = req.query.sort || "date_read";

    let orderBy = { column: "date_read", ascending: false, nullsFirst: false };

    if (sortBy === "rating") {
      orderBy = { column: "rating", ascending: false, nullsFirst: false };
    } else if (sortBy === "title") {
      orderBy = { column: "title", ascending: true };
    } else if (sortBy === "date") {
      orderBy = { column: "created_at", ascending: false };
    }

    const { data: books, error } = await supabase
      .from("books")
      .select("*")
      .order(orderBy.column, {
        ascending: orderBy.ascending,
        nullsFirst: orderBy.nullsFirst,
      });

    if (error) throw error;

    books.forEach((b) => (b.coverUrl = getCoverUrl(b.isbn, "M")));

    res.render("index", {
      books,
      totalBooks: books.length,
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

    const { error } = await supabase.from("books").insert([
      {
        title,
        author,
        isbn: isbn || null,
        rating: rating ? parseInt(rating) : null,
        date_read: date_read || null,
        notes: notes || null,
      },
    ]);

    if (error) throw error;

    res.redirect("/");
  } catch (err) {
    console.error("Error adding book:", err);
    res.status(500).send("Error adding book");
  }
});

app.get("/edit/:id", async (req, res) => {
  try {
    const bookId = req.params.id;

    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).send("Book not found");

    const book = data;
    if (book.date_read)
      book.date_read = book.date_read.split("T")[0];

    res.render("edit", { book });
  } catch (err) {
    console.error("Error fetching book:", err);
    res.status(500).send("Error loading book");
  }
});

app.post("/books/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const { title, author, isbn, rating, date_read, notes } = req.body;

    const { error } = await supabase
      .from("books")
      .update({
        title,
        author,
        isbn: isbn || null,
        rating: rating ? parseInt(rating) : null,
        date_read: date_read || null,
        notes: notes || null,
      })
      .eq("id", bookId);

    if (error) throw error;

    res.redirect("/");
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).send("Error updating book");
  }
});

app.post("/books/:id/delete", async (req, res) => {
  try {
    const bookId = req.params.id;

    const { error } = await supabase.from("books").delete().eq("id", bookId);

    if (error) throw error;

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
      res.json({ success: true, coverUrl, isbn });
    } else {
      res.json({ success: false, message: "Cover not found" });
    }
  } catch {
    res.json({ success: false, message: "Cover not available" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});