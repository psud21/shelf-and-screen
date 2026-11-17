import assert from "node:assert/strict";
import { movieRows, moviePosterFor } from "../lib/movie-gallery.mjs";

const items = [
  {
    kind: "movie",
    title: "Zero",
    year: "2000",
    status: "finished",
    score: 0,
    notes: "rewatch",
    addedAt: "2025-01-01",
  },
  {
    kind: "movie",
    title: "Unrated",
    year: "",
    status: "planned",
    score: null,
    addedAt: "2026-01-01",
  },
  {
    kind: "movie",
    title: "Favorite",
    year: "2020",
    status: "finished",
    score: 98,
    addedAt: "2024-01-01",
  },
  { kind: "book", title: "Book", year: "2025", status: "finished", score: 100 },
];
const before = JSON.stringify(items);
assert.deepEqual(
  movieRows(items).map((i) => i.title),
  ["Favorite", "Zero", "Unrated"],
);
assert.deepEqual(
  movieRows(items, { status: "unrated" }).map((i) => i.title),
  ["Unrated"],
);
assert.deepEqual(
  movieRows(items, { query: "  REWATCH ", status: "finished" }).map((i) => i.title),
  ["Zero"],
);
assert.deepEqual(
  movieRows(items, { query: "2000" }).map((i) => i.title),
  ["Zero"],
);
assert.deepEqual(
  movieRows(items, { sort: "year" }).map((i) => i.title),
  ["Favorite", "Zero", "Unrated"],
);
assert.deepEqual(
  movieRows(items, { sort: "oldest" }).map((i) => i.title),
  ["Zero", "Favorite", "Unrated"],
);
assert.deepEqual(
  movieRows(items, { sort: "recent" }).map((i) => i.title),
  ["Unrated", "Zero", "Favorite"],
);
assert.equal(JSON.stringify(items), before);
console.log(
  "PASS: movie search/status filters compose, zero remains rated, unknown years/scores stay last, and source data is unchanged.",
);

const film = { title: "Parasite", year: "2019", sourceId: "tt6751668", coverUrl: "" };
assert.equal(moviePosterFor(film), "");
assert.equal(
  moviePosterFor({ ...film, coverUrl: "https://example.com/preferred.jpg" }),
  "https://example.com/preferred.jpg",
);
assert.equal(moviePosterFor({ ...film, coverUrl: "javascript:alert(1)" }), "");
assert.equal(moviePosterFor({ ...film, coverUrl: "/local/file.jpg" }), "");
console.log("PASS: posters come only from a secure image link saved on the title.");
