import assert from "node:assert/strict";
import { blankMedia } from "../lib/media.ts";
import { overviewRows } from "../lib/overview.mjs";
const options = {
  query: "",
  kind: "all",
  status: "all",
  kindleOnly: false,
  sort: "title",
  ascending: true,
};
const book = {
  ...blankMedia(),
  id: "book",
  title: "A book",
  kind: "book",
  owned: true,
  notes: "Recommended by a friend",
  score: 0,
  status: "finished",
  completedAt: "",
};
const film = {
  ...blankMedia(),
  id: "film",
  title: "B movie",
  kind: "movie",
  score: 100,
  status: "finished",
  year: "2019",
  completedAt: "2026-10-01",
};
const show = {
  ...blankMedia(),
  id: "tv",
  title: "C show",
  kind: "tv",
  score: null,
  status: "progress",
};
const items = [show, film, book];
assert.deepEqual(
  overviewRows(items, options).map((i) => i.id),
  ["book", "film", "tv"],
);
assert.deepEqual(
  overviewRows(items, { ...options, sort: "score", ascending: false }).map((i) => i.id),
  ["film", "book", "tv"],
);
assert.deepEqual(
  overviewRows(items, { ...options, sort: "score", ascending: true }).map((i) => i.id),
  ["book", "film", "tv"],
);
assert.deepEqual(
  overviewRows(items, { ...options, sort: "completedAt", ascending: false }).map((i) => i.id),
  ["film", "book", "tv"],
);
assert.equal(overviewRows(items, { ...options, query: " FRIEND " })[0].id, "book");
assert.equal(overviewRows(items, { ...options, query: "2019" })[0].id, "film");
assert.deepEqual(
  overviewRows(items, { ...options, kindleOnly: true }).map((i) => i.id),
  ["book"],
);
assert.equal(overviewRows(items, { ...options, kind: "tv", status: "finished" }).length, 0);
assert.equal(overviewRows(items, { ...options, kind: "tv", status: "progress" })[0].id, "tv");
assert.deepEqual(
  items.map((i) => i.id),
  ["tv", "film", "book"],
);
console.log(
  "PASS: overview filters compose, search includes notes/year, zero remains a valid rating, missing dates/scores sort last, and source records remain unchanged.",
);
