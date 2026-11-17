import assert from "node:assert/strict";
import { blankMedia } from "../lib/media.ts";
import {
  duplicateMessage,
  importItems,
  parseLibrary,
  removeItem,
  saveItem,
  serializeLibrary,
} from "../lib/library.ts";

const book = { ...blankMedia(), title: "Piranesi", creator: "Susanna Clarke", kind: "book" };
const film = { ...blankMedia(), title: "Arrival", kind: "movie", year: "2016" };

// Saving adds new titles, replaces by id, and never mutates the list it was given.
const one = saveItem([], book);
assert.equal(one.length, 1);
const original = [...one];
const rated = saveItem(one, { ...book, score: 96, status: "finished" });
assert.equal(rated.length, 1);
assert.equal(rated[0].score, 96);
assert.deepEqual(one, original);
assert.equal(one[0].score, null);

// A second copy of the same title is refused; a different edition year is allowed.
assert.throws(
  () =>
    saveItem(one, { ...blankMedia(), title: "piranesi!", creator: "Susanna Clarke", kind: "book" }),
  { message: duplicateMessage },
);
const films = saveItem(saveItem([], film), {
  ...blankMedia(),
  title: "Arrival",
  kind: "movie",
  year: "1996",
});
assert.equal(films.length, 2);
assert.throws(() => saveItem([], { ...book, title: "  " }));
assert.throws(() => saveItem([], { ...book, score: 101 }));

// Imports only add; existing ratings stay, repeats inside the file are skipped,
// and a clashing id gets a fresh one instead of overwriting.
const incoming = [
  { ...blankMedia(), title: "Piranesi", creator: "Susanna Clarke", kind: "book", score: 10 },
  { ...film },
  { ...film, id: crypto.randomUUID() },
  { ...blankMedia(), id: rated[0].id, title: "Station Eleven", kind: "tv", year: "2021" },
];
const imported = importItems(rated, incoming);
assert.equal(imported.added, 2);
assert.equal(imported.skipped, 2);
assert.equal(imported.items.length, 3);
assert.equal(imported.items[0].score, 96);
assert.equal(new Set(imported.items.map((item) => item.id)).size, 3);

assert.deepEqual(
  removeItem(imported.items, rated[0].id).map((item) => item.title),
  ["Arrival", "Station Eleven"],
);

// The file format round-trips, accepts a backup-style list or an { items } wrapper,
// and refuses a damaged file instead of quietly dropping titles.
const text = serializeLibrary(imported.items);
assert.deepEqual(parseLibrary(text), imported.items);
assert.deepEqual(parseLibrary(JSON.stringify({ items: imported.items })), imported.items);
assert.deepEqual(parseLibrary(""), []);
assert.throws(() => parseLibrary("{not json"), /not valid JSON/);
assert.throws(() => parseLibrary('{"hello":1}'), /list of titles/);
assert.throws(
  () => parseLibrary(JSON.stringify([imported.items[0], { ...film, score: 400 }])),
  /“Arrival”.*score/s,
);
const unicode = saveItem([], { ...book, title: "Amélie — 千と千尋", notes: "emoji 🎬 ok" });
assert.deepEqual(parseLibrary(serializeLibrary(unicode)), unicode);

console.log(
  "PASS: save, replace, duplicate refusal, add-only imports, removal, and a strict library file round trip.",
);
