import assert from "node:assert/strict";
import { artworkUrl, bookCoverCandidates } from "../lib/book-covers.mjs";

const book = {
  title: "A Book (Series, #1)",
  creator: "An Author",
  isbn: "9781234567890",
  coverUrl: "",
  metadata: { ISBN: '="123456789X"' },
};
const original = JSON.stringify(book);
const lookups = [
  "https://covers.openlibrary.org/b/isbn/9781234567890-M.jpg?default=false",
  "https://covers.openlibrary.org/b/isbn/123456789X-M.jpg?default=false",
];

// The saved link comes first, then lookups by each ISBN the book has.
assert.deepEqual(bookCoverCandidates(book), lookups);
assert.deepEqual(bookCoverCandidates({ ...book, coverUrl: "https://example.com/custom.jpg" }), [
  "https://example.com/custom.jpg",
  ...lookups,
]);
// Anything that is not a secure web address is ignored.
assert.deepEqual(bookCoverCandidates({ ...book, coverUrl: "javascript:invalid" }), lookups);
assert.deepEqual(bookCoverCandidates({ ...book, coverUrl: "http://example.com/x.jpg" }), lookups);
assert.deepEqual(bookCoverCandidates({ ...book, isbn: "", metadata: {} }), []);
assert.deepEqual(
  bookCoverCandidates({ ...book, isbn: "9781234567890", metadata: { ISBN13: "9781234567890" } }),
  [lookups[0]],
);
assert.equal(artworkUrl("  https://example.com/a.jpg "), "https://example.com/a.jpg");
assert.equal(artworkUrl(undefined), "");
assert.equal(JSON.stringify(book), original);
console.log(
  "PASS: saved cover link first, ISBN lookups after, no repeats, unsafe links ignored, and unchanged book records.",
);
