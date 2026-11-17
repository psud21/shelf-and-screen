// Tidy and enrich a library file in one pass:
//
//   node scripts/backfill-library.mjs <library.json> [--goodreads <export.csv>] [--write]
//
// - Books from a Goodreads export get the work's original publication year
//   instead of the edition's (matched by Goodreads Book Id, then title and author).
// - Series are split out of Goodreads-style book titles.
// - Empty fields are filled from Open Library, Wikidata and Wikipedia.
// Nothing already entered is replaced, apart from the corrected book years.
// Without --write it only prints what would change.
import { readFileSync, writeFileSync } from "node:fs";
import { parseCSV, splitSeries } from "../lib/media.ts";
import { parseLibrary, serializeLibrary } from "../lib/library.ts";
import { fillMissing, imdbIdFor, lookupBook, lookupScreen } from "../lib/metadata.ts";
import { normalizeText } from "../lib/normalize.mjs";
import { splitTVTitle } from "../lib/tv-guide.mjs";

const args = process.argv.slice(2);
const file = args.find(
  (arg) => !arg.startsWith("--") && args[args.indexOf(arg) - 1] !== "--goodreads",
);
const goodreadsFile = args.includes("--goodreads") ? args[args.indexOf("--goodreads") + 1] : "";
const write = args.includes("--write");
if (!file) {
  console.error(
    "Usage: node scripts/backfill-library.mjs <library.json> [--goodreads <export.csv>] [--write]",
  );
  process.exit(64);
}
const options = { headers: { "User-Agent": "ShelfAndScreen/1.0 (personal library tool)" } };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const before = parseLibrary(readFileSync(file, "utf8"));
const items = before.map((item) => ({ ...item }));
const changes = new Map(); // id -> list of changed fields
const note = (item, field) => changes.set(item.id, [...(changes.get(item.id) ?? []), field]);

/* 1. Original publication years from the Goodreads export. */
if (goodreadsFile) {
  const rows = parseCSV(readFileSync(goodreadsFile, "utf8"));
  const header = rows[0].map((name) => name.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const byId = new Map();
  const byName = new Map();
  for (const row of rows.slice(1)) {
    const year = (row[col("original publication year")] || "").trim();
    if (!/^-?\d{1,4}$/.test(year)) continue;
    byId.set((row[col("book id")] || "").trim(), year);
    const title = normalizeText(splitSeries(row[col("title")] || "").title);
    byName.set(`${title}|${normalizeText(row[col("author")] || "")}`, year);
  }
  for (const item of items.filter((entry) => entry.kind === "book")) {
    const year =
      byId.get(item.metadata?.["Book Id"] || "") ||
      byName.get(`${normalizeText(splitSeries(item.title).title)}|${normalizeText(item.creator)}`);
    if (year && year !== item.year) {
      item.year = year;
      note(item, "year");
    }
  }
}

/* 2. Series out of book titles. */
for (const item of items.filter((entry) => entry.kind === "book" && !entry.series)) {
  const split = splitSeries(item.title);
  if (!split.series) continue;
  note(item, "series");
  item.title = split.title;
  item.series = split.series;
  item.seriesNumber = split.number || undefined;
}

/* 3. Films and shows: one Wikidata query per batch of IMDb IDs. */
const screen = items.filter((item) => item.kind !== "book" && imdbIdFor(item));
const ids = [...new Set(screen.map(imdbIdFor))];
const found = new Map();
for (let offset = 0; offset < ids.length; offset += 40) {
  for (const [id, details] of await lookupScreen(ids.slice(offset, offset + 40), options))
    found.set(id, details);
  await pause(500);
}
for (const item of screen) {
  let details = found.get(imdbIdFor(item));
  if (!details) continue;
  // A season shares its show's people and genres, but not the show's summary or year.
  if (item.kind === "tv" && splitTVTitle(item.title).number !== null)
    details = {
      createdBy: details.createdBy,
      directedBy: details.directedBy,
      genre: details.genre,
    };
  const result = fillMissing(item, details);
  Object.assign(item, result.item);
  result.filled.forEach((field) => note(item, field));
}

/* 4. Books: Open Library, one at a time. */
const books = items.filter((item) => item.kind === "book");
let missed = 0;
for (const [index, item] of books.entries()) {
  process.stdout.write(`\rLooking up books ${index + 1}/${books.length}…`);
  try {
    const details = await lookupBook(item, options);
    if (!details) missed++;
    else {
      // The Goodreads year is already the original one; keep it.
      if (item.year) delete details.year;
      const result = fillMissing(item, details);
      Object.assign(item, result.item);
      result.filled.forEach((field) => note(item, field));
    }
  } catch (cause) {
    console.log(`\n  ${item.title}: ${cause.message}`);
  }
  await pause(250);
}
process.stdout.write("\n");

/* Report. */
const after = parseLibrary(serializeLibrary(items));
if (after.length !== before.length || after.some((item, n) => item.id !== before[n].id))
  throw new Error("Titles were added, removed or reordered; nothing written.");
const tally = {};
for (const fields of changes.values())
  for (const field of fields) tally[field] = (tally[field] ?? 0) + 1;
const count = (kind) => items.filter((item) => item.kind === kind).length;
console.log(
  `${items.length} titles (${count("book")} books, ${count("movie")} movies, ${count("tv")} TV entries)`,
);
console.log(`${changes.size} titles changed. Fields changed:`, tally);
console.log(`${missed} books not found on Open Library.`);
for (const [id, fields] of [...changes].slice(0, 12)) {
  const item = items.find((entry) => entry.id === id);
  console.log(`  ${item.kind}: ${item.title}: ${fields.join(", ")}`);
}
if (changes.size > 12) console.log(`  …and ${changes.size - 12} more`);
const size = (list) => Math.round(Buffer.byteLength(serializeLibrary(list)) / 1024);
console.log(`File size: ${size(before)} KB before, ${size(items)} KB after`);
if (write) {
  writeFileSync(file, serializeLibrary(items));
  console.log(`Written to ${file}`);
} else console.log("Dry run: nothing written. Add --write to save.");
