import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blankMedia, parseCSV, importRows } from "../lib/media.ts";
import {
  bookIdentifiers,
  critickerExport,
  goodreadsExport,
  goodreadsStars,
} from "../lib/service-exports.ts";

const book = {
  ...blankMedia(),
  title: "A book, with “quotes”",
  creator: "Someone",
  kind: "book",
  isbn: "0141439513",
  status: "finished",
  score: 89,
  completedAt: "2026-10-23",
  addedAt: "2023-10-12T01:00:00Z",
  notes: 'Private\n"review"',
  source: "Goodreads",
  sourceId: "42",
};
const movie = {
  ...book,
  kind: "movie",
  title: "Movie",
  score: 0,
  source: "Criticker",
  sourceId: "tt1431045",
  completedAt: "2025-01-27",
};
const inputs = [
  book,
  {
    ...book,
    id: "unrated",
    isbn: "",
    score: null,
    status: "planned",
    metadata: { ISBN: '="0141439513"', ISBN13: '="9780141439518"' },
  },
  { ...book, id: "paused", status: "paused" },
  { ...book, id: "missing", isbn: "" },
  { ...book, id: "dnf", status: "dropped" },
  movie,
];
const snapshot = JSON.stringify(inputs);
const gr = goodreadsExport(inputs);
const rows = parseCSV(gr.files[0].csv),
  headers = rows[0];
assert.deepEqual(headers, [
  "Book Id",
  "Title",
  "Author",
  "ISBN",
  "ISBN13",
  "My Rating",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "Exclusive Shelf",
]);
assert.equal(gr.count, 4);
assert.equal(gr.issues.length, 1);
assert.deepEqual(rows[1], [
  "42",
  book.title,
  "Someone",
  "0141439513",
  "",
  "4.5",
  "2026/10/23",
  "2023/10/12",
  "read",
  "read",
]);
assert.equal(rows[2][4], "9780141439518");
assert.equal(rows[2][5], "0");
assert.equal(rows[2][6], "");
assert.equal(rows[3][8], "currently-reading, on-hold");
assert.equal(rows[4][8], "to-read, did-not-finish");
assert.equal(rows[4][6], "");
assert(!gr.files[0].csv.includes("Private"));
const withNotes = parseCSV(goodreadsExport([book], true).files[0].csv);
assert.equal(withNotes[0].at(-1), "My Review");
assert.equal(withNotes[1].at(-1), book.notes);
assert.deepEqual(
  [null, 0, 20, 22, 23, 29, 30, 49, 50, 69, 70, 85, 89, 90, 100].map(goodreadsStars),
  [0, 1, 1, 1, 1.25, 1.5, 1.5, 2.5, 2.5, 3.5, 3.5, 4.25, 4.5, 4.5, 5],
);
const restored = importRows(rows, { source: "Goodreads", kind: "book", ratingScale: 5 }).items;
assert.equal(restored[0].score, 90);
assert.equal(restored[0].isbn, "0141439513");
assert.equal(restored[0].status, "finished");
assert.equal(restored[1].score, null);
assert.equal(
  parseCSV(goodreadsExport([{ ...book, completedAt: "2026-02-30" }]).files[0].csv)[1][6],
  "",
);
assert.deepEqual(
  bookIdentifiers({ ...book, isbn: "9780141439518", metadata: { ISBN: "0000000000" } }),
  { isbn10: "", isbn13: "9780141439518" },
);
assert.equal(goodreadsExport([{ ...book, isbn: "" }]).files.length, 0);
assert.deepEqual(
  goodreadsExport(Array.from({ length: 500 }, () => book)).files.map((file) => file.count),
  [499, 1],
);

// These are the positions and season syntax from the user's Criticker import instructions.
const season = {
  ...movie,
  id: "season",
  kind: "tv",
  sourceId: "tt8712204_s2",
  score: 60,
  notes: "A review for the second season of Batwoman",
};
const result = critickerExport(
  [
    movie,
    season,
    { ...movie, id: "missing-imdb", sourceId: "" },
    { ...movie, id: "not-rated", score: null },
    book,
  ],
  true,
);
assert.equal(result.count, 2);
assert.equal(result.unrated, 1);
assert.equal(result.issues.length, 1);
const crRows = parseCSV(result.files[0].csv);
assert.deepEqual(crRows[0], ["imdb_id", "rating", "date_watched", "minireview"]);
assert.deepEqual(crRows[1], ["tt1431045", "0", "2025-01-27", movie.notes]);
assert.equal(crRows[2][0], "tt8712204_s2");
assert.equal(crRows[2][1], "60");
assert.equal(parseCSV(critickerExport([movie]).files[0].csv)[1][3], "");
assert.equal(critickerExport([{ ...movie, sourceId: "wrong" }]).count, 0);
assert.equal(critickerExport([movie, { ...movie, id: "duplicate" }]).issues.length, 2);
assert.equal(
  critickerExport([{ ...movie, sourceId: "", sourceUrl: "https://www.imdb.com/title/tt1431045/" }])
    .count,
  1,
);
assert.equal(
  critickerExport([{ ...movie, sourceId: "", sourceUrl: "https://evil.example/title/tt1431045/" }])
    .count,
  0,
);
assert.equal(
  parseCSV(critickerExport([{ ...movie, completedAt: "2026-02-30" }]).files[0].csv)[1][2],
  "",
);
const many = Array.from({ length: 5000 }, (_, index) => ({
  ...movie,
  id: `m${index}`,
  sourceId: `tt${index + 10000}`,
}));
const batches = critickerExport(many);
assert.deepEqual(
  batches.files.map((file) => file.count),
  [4999, 1],
);
for (const file of batches.files) {
  assert(file.csv.split(/\r\n|\r|\n/).length <= 5000);
  assert.equal(parseCSV(file.csv)[0][0], "imdb_id");
}
const multiline = critickerExport(
  [
    { ...movie, notes: "line\n".repeat(4990) },
    { ...season, notes: "line\n".repeat(20) },
  ],
  true,
);
assert.equal(multiline.files.length, 2);
assert.equal(critickerExport([{ ...movie, notes: "\n".repeat(5000) }], true).issues.length, 1);
assert.equal(
  JSON.stringify(inputs),
  snapshot,
  "Export must not mutate hub records or original scores.",
);
console.log(
  "PASS: Goodreads native columns, stars, shelves, dates, ISBNs, optional reviews; Criticker positional fields, exact zero/100 scores, seasons, missing/duplicate IDs, and 5,000-line batches.",
);

// Optional local contract check against the user's original native exports.
if (process.argv[2] && process.argv[3]) {
  const originalBooks = importRows(parseCSV(readFileSync(process.argv[2], "utf8")), {
    source: "Goodreads",
    kind: "book",
    ratingScale: 5,
  }).items;
  const originalScreen = importRows(parseCSV(readFileSync(process.argv[3], "utf8")), {
    source: "Criticker",
    kind: "movie",
    ratingScale: 100,
  }).items;
  const nativeGrHeaders = parseCSV(readFileSync(process.argv[2], "utf8"))[0];
  for (const header of headers)
    assert(nativeGrHeaders.includes(header), `Unknown Goodreads header: ${header}`);
  const eligibleBooks = originalBooks.filter((item) => {
    const ids = bookIdentifiers(item);
    return ids.isbn10 || ids.isbn13;
  });
  const exportedBooks = goodreadsExport(originalBooks).files.flatMap(
    (file) =>
      importRows(parseCSV(file.csv), { source: "Goodreads", kind: "book", ratingScale: 5 }).items,
  );
  assert.deepEqual(
    exportedBooks.map((item) => item.score),
    eligibleBooks.map((item) => (item.score === null ? null : goodreadsStars(item.score) * 20)),
  );
  const exportedScreen = critickerExport(originalScreen);
  assert.equal(exportedScreen.issues.length, 0);
  assert.equal(exportedScreen.count, originalScreen.filter((item) => item.score !== null).length);
  const exportedRows = exportedScreen.files.flatMap((file) => parseCSV(file.csv).slice(1));
  assert.deepEqual(
    exportedRows.map((row) => Number(row[1])),
    originalScreen.filter((item) => item.score !== null).map((item) => item.score),
  );
  assert.deepEqual(
    exportedBooks.map((item) => item.score),
    eligibleBooks.map((item) => item.score),
  );
  console.log(
    `PASS: native user-file contracts (${exportedBooks.length}/${originalBooks.length} books have an ISBN; ${exportedScreen.count} movie/TV ratings). Goodreads quarter stars and Criticker scores match the originals.`,
  );
}
