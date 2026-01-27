const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

var posts = [];
var postId = 1;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index.ejs", { posts: posts });
});

app.get("/new", (req, res) => {
  res.render("new.ejs");
});

app.post("/new", (req, res) => {
  const post = {
    id: postId++,
    title: req.body.title,
    content: req.body.content,
    date: new Date().toLocaleDateString()
  };
  posts.push(post);
  res.redirect("/");
});

app.get("/edit/:id", (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  res.render("edit.ejs", { post: post });
});

app.post("/edit/:id", (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  post.title = req.body.title;
  post.content = req.body.content;
  res.redirect("/");
});

app.get("/delete/:id", (req, res) => {
  posts = posts.filter(p => p.id != req.params.id);
  res.redirect("/");
});

app.get("/post/:id", (req, res) => {
  const post = posts.find(p => p.id == req.params.id);
  if (post) {
    res.render("post.ejs", { post: post });
  } else {
    res.redirect("/");
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});