import assert from "node:assert/strict";
import { blankMedia, mediaSchema, exportCSV, parseCSV, importRows } from "../lib/media.ts";
import {
  getPageCount,
  readingFraction,
  spineAppearance,
  packShelves,
  sortBooks,
} from "../lib/bookshelf.mjs";

const book = {
  ...blankMedia(),
  title: "A book",
  status: "progress",
  metadata: { "Number of Pages": "400" },
  progress: "Page 120 of 400",
};
assert.equal(getPageCount(book), 400);
assert.equal(getPageCount({ ...book, pageCount: 700 }), 700);
assert.equal(getPageCount({ ...book, pageCount: null }), null);
assert.equal(readingFraction(book), 0.3);
assert.equal(readingFraction({ ...book, progress: "25%" }), 0.25);
assert.equal(readingFraction({ ...book, progress: "Page 100" }), 0.25);
assert.equal(readingFraction({ ...book, progress: "Page 100", pageCount: null }), null);
assert.equal(readingFraction({ ...book, progress: "Chapter 3" }), null);
assert.equal(readingFraction({ ...book, progress: "130%" }), 1);
assert.equal(readingFraction({ ...book, status: "planned" }), null);
// Spine colour is a bookcloth chosen by title: steady across ratings, varied across titles.
assert.equal(
  spineAppearance({ ...book, score: 0 }).color,
  spineAppearance({ ...book, score: null }).color,
);
assert.match(spineAppearance(book).color, /^var\(--cloth-[1-8]\)$/);
assert.ok(
  new Set(
    ["Dune", "Emma", "Ulysses", "Beloved", "Middlemarch", "Persuasion"].map(
      (title) => spineAppearance({ ...book, title }).color,
    ),
  ).size >= 3,
);
assert(
  spineAppearance({ ...book, pageCount: 900 }).height >
    spineAppearance({ ...book, pageCount: 100 }).height,
);
assert.equal(mediaSchema.safeParse({ ...book, pageCount: 0 }).success, false);
assert.equal(mediaSchema.safeParse({ ...book, pageCount: 12.5 }).success, false);
assert.equal(mediaSchema.safeParse({ ...book, pageCount: null }).success, true);
const roundtrip = importRows(parseCSV(exportCSV([book])), {
  source: "Other",
  kind: "book",
  ratingScale: 100,
});
assert.equal(getPageCount(roundtrip.items[0]), 400);
const zero = { ...book, id: "zero", title: "Zero", score: 0 },
  unrated = { ...book, id: "none", title: "Unrated", score: null },
  high = { ...book, id: "high", title: "High", score: 100 };
assert.deepEqual(
  sortBooks([unrated, zero, high], "score").map((b) => b.id),
  ["high", "zero", "none"],
);
assert.deepEqual(
  sortBooks([unrated, high, zero], "score", true).map((b) => b.id),
  ["zero", "high", "none"],
);
const many = Array.from({ length: 127 }, (_, i) => ({
  ...book,
  id: String(i),
  pageCount: i % 2 ? 1000 : 100,
}));
for (const width of [260, 312, 650, 1120, 1760, 2400]) {
  const rows = packShelves(many, width);
  assert.deepEqual(
    rows.flat().map((b) => b.id),
    many.map((b) => b.id),
  );
  for (const [index, row] of rows.entries()) {
    const used = row.reduce((sum, b) => sum + spineAppearance(b).width, 0) + (row.length - 1) * 5;
    assert(used <= width - 40, `${width}px shelf overflowed`);
    const nextBook = rows[index + 1]?.[0];
    if (nextBook)
      assert(
        used + 5 + spineAppearance(nextBook).width > width - 40,
        `${width}px shelf left room for another book`,
      );
  }
}
assert(
  packShelves(many, 1120)[0].length > 12,
  "Desktop shelves must not retain the old 12-book cap.",
);
assert(
  packShelves(many, 1760)[0].length > packShelves(many, 1120)[0].length,
  "Wider shelves should show more books.",
);
console.log(
  "PASS: legacy page counts, overrides, progress interpretation, 0 vs unrated, page validation, CSV round trips, rating sorts, and all 127 books packed at phone/tablet/desktop widths.",
);
