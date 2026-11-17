import assert from "node:assert/strict";
import { localToday } from "../lib/calendar-date.mjs";
assert.equal(localToday(new Date(2026, 9, 18, 23, 59)), "2026-10-18");
assert.equal(localToday(new Date(2026, 9, 19, 0, 1)), "2026-10-19");
import { blankMedia, exportCSV, importRows, mediaSchema, parseCSV } from "../lib/media.ts";
import { episodeSummary, toggleEpisode, withEpisodeTracker } from "../lib/episodes.mjs";
const item = {
  ...blankMedia(),
  kind: "tv",
  title: "Episode fixture - Season 2",
  score: 0,
  notes: 'Keep this note, with "quotes"\nand a second line.',
  source: "Criticker",
  sourceRating: "0/100",
  nextReleaseTitle: "Season 3",
  nextReleaseDate: "",
  status: "planned",
};
const original = JSON.stringify(item);
const configured = withEpisodeTracker(item, { season: 2, total: 3, watched: [] }, "2026-10-18");
assert.equal(configured.status, "planned");
assert.equal(episodeSummary(configured).next, 1);
const third = toggleEpisode(configured, 3, "2026-10-18");
assert.equal(third.status, "progress");
assert.equal(episodeSummary(third).next, 1);
assert.equal(episodeSummary(third).last, 3);
const first = toggleEpisode(third, 1, "2026-10-18");
assert.equal(episodeSummary(first).next, 2);
assert.deepEqual(first.episodeTracker.watched, [1, 3]);
const complete = toggleEpisode(first, 2, "2026-10-18");
assert.equal(complete.status, "finished");
assert.equal(complete.completedAt, "2026-10-18");
assert.equal(episodeSummary(complete).complete, true);
assert.equal(episodeSummary(complete).next, null);
const undone = toggleEpisode(complete, 2, "2026-10-19");
assert.equal(undone.status, "progress");
assert.equal(undone.completedAt, "");
assert.equal(episodeSummary(undone).next, 2);
const oldComplete = withEpisodeTracker(
  { ...item, status: "finished", completedAt: "2024-05-01" },
  { season: 2, total: 3, watched: [1, 2, 3] },
  "2026-10-18",
);
assert.equal(oldComplete.completedAt, "2024-05-01");
// A season put on hold stays on hold while its tracker is set up or corrected,
// and resumes only when another episode is watched.
const onHold = withEpisodeTracker(
  { ...item, status: "paused" },
  { season: 2, total: 5, watched: [1, 2] },
  "2026-10-18",
);
assert.equal(onHold.status, "paused");
assert.equal(toggleEpisode(onHold, 2, "2026-10-18").status, "paused");
assert.equal(
  withEpisodeTracker({ ...item, status: "dropped" }, { season: 2, total: 5, watched: [] }).status,
  "dropped",
);
assert.equal(toggleEpisode(onHold, 3, "2026-10-18").status, "progress");
assert.equal(
  toggleEpisode(toggleEpisode(toggleEpisode(onHold, 3), 4), 5, "2026-10-18").status,
  "finished",
);
for (const result of [configured, third, first, complete, undone]) {
  assert.equal(result.score, 0);
  assert.equal(result.notes, item.notes);
  assert.equal(result.sourceRating, item.sourceRating);
  assert.equal(result.nextReleaseTitle, item.nextReleaseTitle);
  assert(mediaSchema.safeParse(result).success);
}
assert.equal(JSON.stringify(item), original);
assert.throws(() => toggleEpisode(first, 4));
assert.throws(() => withEpisodeTracker(item, { season: 0, total: 10, watched: [] }));
for (const tracker of [
  { season: 1, total: 0, watched: [] },
  { season: 1, total: 3, watched: [1, 1] },
  { season: 1, total: 3, watched: [4] },
  { season: 1, total: 3, watched: [1.5] },
])
  assert.equal(mediaSchema.safeParse({ ...item, episodeTracker: tracker }).success, false);
assert.equal(
  mediaSchema.safeParse({ ...item, kind: "book", episodeTracker: configured.episodeTracker })
    .success,
  false,
);
const restored = importRows(parseCSV(exportCSV([first])), {
  source: "Other",
  kind: "tv",
  ratingScale: 100,
});
assert.equal(restored.errors.length, 0);
assert.deepEqual(restored.items[0].episodeTracker, first.episodeTracker);
assert.equal(restored.items[0].notes, item.notes);
assert.equal(restored.items[0].score, 0);
assert.deepEqual(
  mediaSchema.parse(JSON.parse(JSON.stringify(first))).episodeTracker,
  first.episodeTracker,
);
const invalid = importRows(parseCSV("title,kind,episodeTracker\nBad,tv,not-json"), {
  source: "Other",
  kind: "tv",
  ratingScale: 100,
});
assert.equal(invalid.items.length, 0);
assert.equal(invalid.errors.length, 1);
console.log(
  "PASS: individual episodes, gaps, completion/undo, historical completion dates, zero scores and notes, validation, and full CSV/JSON backup round trips.",
);
