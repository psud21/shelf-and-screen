import assert from "node:assert/strict";
import { blankMedia } from "../lib/media.ts";
import {
  favourites,
  finishedOn,
  inProgress,
  recentlyFinished,
  upNext,
  upcomingReleases,
  yearStats,
} from "../lib/home.ts";

let n = 0;
const make = (extra) => ({
  ...blankMedia(),
  id: `id-${++n}`,
  addedAt: `2026-01-${String(n).padStart(2, "0")}T12:00:00.000Z`,
  ...extra,
});

const reading = make({
  kind: "book",
  title: "Neuromancer",
  status: "progress",
  progress: "Page 100 of 400",
});
const watching = make({
  kind: "tv",
  title: "Andor - Season 2",
  status: "progress",
  episodeTracker: { season: 2, total: 12, watched: [1, 2, 3] },
});
const listening = make({ kind: "book", title: "No progress", status: "progress" });
const now = inProgress([
  make({ kind: "movie", title: "Done", status: "finished" }),
  reading,
  watching,
  listening,
]);
assert.deepEqual(
  now.map((entry) => entry.item.title),
  ["No progress", "Andor - Season 2", "Neuromancer"],
);
assert.equal(now[1].fraction, 0.25);
assert.equal(now[1].detail, "Season 2 · next: episode 4");
assert.equal(now[2].fraction, 0.25);
assert.equal(now[2].detail, "Page 100 of 400");
assert.equal(now[0].fraction, null);

// The queue order is the Queue screen's: priorities first, then newest added.
const queued = [
  make({ kind: "book", title: "Old", status: "planned" }),
  make({ kind: "movie", title: "Newer", status: "planned" }),
  make({ kind: "tv", title: "Starred", status: "planned", priority: true }),
];
assert.deepEqual(
  upNext([...queued, reading]).map((item) => item.title),
  ["Starred", "Newer", "Old"],
);
assert.equal(upNext(queued, 2).length, 2);

// Finished: completion date, else rating date; undated titles are left out.
const films = [
  make({
    kind: "movie",
    title: "Rated only",
    status: "finished",
    score: 95,
    ratedAt: "2026-03-01",
  }),
  make({
    kind: "movie",
    title: "Watched",
    status: "finished",
    score: 80,
    completedAt: "2026-05-02",
    runtime: 120,
  }),
  make({ kind: "movie", title: "Undated", status: "finished", score: 99 }),
  make({
    kind: "book",
    title: "Old book",
    status: "finished",
    score: 70,
    completedAt: "2025-12-31",
    pageCount: 300,
  }),
  make({
    kind: "book",
    title: "New book",
    status: "finished",
    score: null,
    completedAt: "2026-02-10",
    pageCount: 250,
  }),
  make({ kind: "tv", title: "Show", status: "finished", score: 92, completedAt: "2026-04-04" }),
  make({
    kind: "tv",
    title: "Show - Season 1",
    status: "finished",
    score: 97,
    completedAt: "2026-04-01",
  }),
];
assert.equal(finishedOn(films[0]), "2026-03-01");
assert.equal(finishedOn(make({ completedAt: "soon" })), "");
assert.deepEqual(
  recentlyFinished(films).map((item) => item.title),
  ["Watched", "Show", "Show - Season 1", "Rated only", "New book", "Old book"],
);

// Favourites: highest first, ties by most recent; seasons are left to their show.
assert.deepEqual(
  favourites(films).map((item) => item.title),
  ["Undated", "Rated only", "Show"],
);
assert.deepEqual(
  favourites(films, 12, 0)
    .map((item) => item.title)
    .at(-1),
  "Old book",
);

// The year in numbers, and the fallback to the latest year with anything finished.
assert.deepEqual(yearStats(films, "2026"), {
  year: "2026",
  books: 1,
  films: 2,
  shows: 2,
  pages: 250,
  minutes: 120,
  average: 91,
});
assert.equal(yearStats(films, "2027").year, "2026");
assert.equal(yearStats(films, "2025").books, 1);
assert.equal(yearStats([reading], "2026"), null);

// Releases: past dates drop off, dated ones come first, then "to be announced".
const releases = [
  make({ title: "TBA", nextReleaseTitle: "Season 3" }),
  make({ title: "Later", nextReleaseTitle: "Book 7", nextReleaseDate: "2027-05-01" }),
  make({ title: "Soon", nextReleaseTitle: "Season 7", nextReleaseDate: "2026-12-01" }),
  make({ title: "Gone", nextReleaseTitle: "Season 2", nextReleaseDate: "2026-01-01" }),
  make({ title: "Blank", nextReleaseTitle: "  " }),
];
assert.deepEqual(
  upcomingReleases(releases, "2026-11-16").map((item) => item.title),
  ["Soon", "Later", "TBA"],
);

console.log(
  "PASS: in progress with reading and episode progress, queue order, recent finishes by date, favourites without seasons, yearly totals with fallback, and upcoming releases.",
);
