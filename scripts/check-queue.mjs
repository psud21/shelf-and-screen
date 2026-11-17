import assert from "node:assert/strict";
import { blankMedia, mediaSchema, exportCSV, importRows, parseCSV } from "../lib/media.ts";
import { queueItems, prepareRecommendation } from "../lib/queue.ts";
import { goodreadsExport, critickerExport } from "../lib/service-exports.ts";

const a = {
  ...blankMedia(),
  id: "book",
  title: "Dune",
  kind: "book",
  creator: "Frank Herbert",
  status: "planned",
  owned: true,
  isbn: "9780441172719",
  sourceId: "44767458",
  notes: "Private library note",
  score: 80,
  addedAt: "2026-09-01T00:00:00Z",
};
const b = {
  ...blankMedia(),
  id: "movie",
  title: "Arrival",
  kind: "movie",
  status: "planned",
  recommendedBy: "Zoë",
  recommendationNote: "Thoughtful sci-fi, with “great” language ideas.\nWatch together.",
  priority: true,
  addedAt: "2026-10-20T00:00:00Z",
  sourceId: "tt2543164",
};
const c = {
  ...blankMedia(),
  id: "tv",
  title: "The Bear",
  kind: "tv",
  status: "planned",
  addedAt: "2026-10-31T00:00:00Z",
};
const finished = { ...b, id: "seen", title: "Already seen", status: "finished", score: 92 };
const ongoing = { ...c, id: "ongoing", title: "Already watching", status: "progress" };
const items = [a, b, c, finished, ongoing],
  before = JSON.stringify(items);
assert.deepEqual(
  queueItems(items).map((i) => i.id),
  ["movie", "tv", "book"],
);
assert.deepEqual(
  queueItems(items, { sort: "newest" }).map((i) => i.id),
  ["tv", "movie", "book"],
);
assert.deepEqual(
  queueItems(items, { sort: "title" }).map((i) => i.id),
  ["movie", "book", "tv"],
);
assert.deepEqual(
  queueItems(items, { query: "ZOE" }).map((i) => i.id),
  ["movie"],
);
assert.deepEqual(
  queueItems(items, { query: "language ideas" }).map((i) => i.id),
  ["movie"],
);
assert.deepEqual(
  queueItems(items, { kind: "book" }).map((i) => i.id),
  ["book"],
);
assert.deepEqual(
  queueItems(items, { recommendedOnly: true }).map((i) => i.id),
  ["movie"],
);
assert.equal(queueItems(items, { query: "no matching item" }).length, 0);
assert.equal(queueItems([{ ...b, status: "progress" }]).length, 0);

const created = prepareRecommendation(items, {
  ...blankMedia(),
  kind: "tv",
  title: "  New show  ",
  recommendedBy: "  Pat  ",
  recommendationNote: " Try this. ",
  score: 93,
});
assert.equal(created.title, "New show");
assert.equal(created.recommendedBy, "Pat");
assert.equal(created.status, "planned");
assert.equal(created.score, null);
const merge = prepareRecommendation(items, {
  ...blankMedia(),
  title: "Dune",
  kind: "book",
  recommendedBy: "Chris",
  recommendationNote: "For the world building.",
  priority: true,
});
assert.equal(merge.id, "book");
assert.equal(merge.owned, true);
assert.equal(merge.isbn, a.isbn);
assert.equal(merge.sourceId, a.sourceId);
assert.equal(merge.notes, a.notes);
assert.equal(merge.score, 80);
assert.equal(merge.addedAt, a.addedAt);
assert.equal(merge.recommendedBy, "Chris");
assert.equal(merge.priority, true);
const again = prepareRecommendation([merge], {
  ...blankMedia(),
  title: "Dune",
  kind: "book",
  recommendedBy: "Sam",
  recommendationNote: "For the politics.",
});
assert.equal(again.recommendedBy, "Chris; Sam");
assert.equal(again.recommendationNote, "For the world building.\n\nFor the politics.");
const duplicate = prepareRecommendation([again], {
  ...blankMedia(),
  title: "Dune",
  kind: "book",
  recommendedBy: "Chris",
  recommendationNote: "For the world building.",
});
assert.equal(duplicate.recommendedBy, again.recommendedBy);
assert.equal(duplicate.recommendationNote, again.recommendationNote);
assert.throws(
  () => prepareRecommendation(items, { ...finished, id: "another" }),
  /already marked Finished/,
);
assert.throws(
  () => prepareRecommendation(items, { ...ongoing, id: "another" }),
  /already marked In progress/,
);
assert.throws(() => prepareRecommendation([], { ...blankMedia(), title: " " }));
assert.equal(mediaSchema.safeParse({ ...b, recommendedBy: "x".repeat(301) }).success, false);
assert.equal(mediaSchema.safeParse({ ...b, recommendationNote: "x".repeat(2001) }).success, false);
assert.equal(
  mediaSchema.safeParse({
    ...blankMedia(),
    title: "Old record",
    recommendedBy: undefined,
    recommendationNote: undefined,
  }).success,
  true,
);
const restored = importRows(parseCSV(exportCSV([b])), {
  source: "Other / backup",
  kind: "movie",
  ratingScale: 100,
}).items[0];
assert.equal(restored.recommendedBy, b.recommendedBy);
assert.equal(restored.recommendationNote, b.recommendationNote);
assert.equal(restored.status, "planned");
assert.equal(restored.priority, true);
assert.equal(
  mediaSchema.parse(JSON.parse(JSON.stringify(b))).recommendationNote,
  b.recommendationNote,
);
assert(
  !goodreadsExport([
    { ...a, recommendedBy: "Private friend", recommendationNote: "Private recommendation" },
  ]).files[0].csv.includes("Private friend"),
);
assert(
  !critickerExport([{ ...b, score: 90, recommendedBy: "Private friend" }]).files[0].csv.includes(
    "Private friend",
  ),
);
assert.equal(JSON.stringify(items), before, "Queue operations must not mutate library entries.");
console.log(
  "PASS: mixed-media queue, priority/newest/title sorting, recommender search, recommendation filter, starting titles, duplicate merging, preserved ratings/identifiers, finished-title protection, field limits, backward compatibility, and backup round trips.",
);
