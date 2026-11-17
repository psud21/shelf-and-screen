import assert from "node:assert/strict";
import { groupTV } from "../lib/tv-guide.mjs";
import { tvGalleryRows, tvGroupYear, tvPosterFor } from "../lib/tv-gallery.mjs";

const entry = (id, title, score, extra = {}) => ({
  id,
  title,
  kind: "tv",
  score,
  year: "2022",
  status: "finished",
  addedAt: "2026-01-01",
  notes: "",
  creator: "",
  platform: "",
  genre: "",
  progress: "",
  coverUrl: "",
  ...extra,
});
const data = [
  entry("a", "A Show", 0, { sourceId: "tt1" }),
  entry("a1", "A Show - Season 1", 100, {
    sourceId: "tt1_s1",
    status: "progress",
    notes: "Finale",
  }),
  entry("b", "B Show", 90, { year: "2025" }),
  entry("c1", "C Show - Season 1", 95, { year: "2010", sourceId: "tt3_s1" }),
  entry("d", "D Show", null, { year: "" }),
];
const before = JSON.stringify(data);
assert.deepEqual(
  tvGalleryRows(data).map((group) => group.title),
  ["B Show", "A Show", "C Show", "D Show"],
);
assert.deepEqual(
  tvGalleryRows(data, { status: "unrated" }).map((group) => group.title),
  ["C Show", "D Show"],
);
assert.deepEqual(
  tvGalleryRows(data, { query: "FINALE" }).map((group) => group.title),
  ["A Show"],
);
assert.deepEqual(
  tvGalleryRows(data, { sort: "year" }).map((group) => group.title),
  ["B Show", "A Show", "C Show", "D Show"],
);
assert.deepEqual(
  tvGalleryRows(data, { sort: "oldest" }).map((group) => group.title),
  ["C Show", "A Show", "B Show", "D Show"],
);
const groups = groupTV(data),
  a = groups.find((group) => group.title === "A Show"),
  c = groups.find((group) => group.title === "C Show");
assert.equal(tvGroupYear(c), "2010");
// A show's poster is the link saved on the show, or failing that on one of its seasons.
assert.equal(tvPosterFor(a), "");
const withPoster = (items, id, coverUrl) =>
  groupTV(items.map((item) => (item.id === id ? { ...item, coverUrl } : item)));
assert.equal(
  tvPosterFor(
    withPoster(data, "a", "https://example.com/show.jpg").find((g) => g.title === "A Show"),
  ),
  "https://example.com/show.jpg",
);
assert.equal(
  tvPosterFor(
    withPoster(data, "a1", "https://example.com/season.jpg").find((g) => g.title === "A Show"),
  ),
  "https://example.com/season.jpg",
);
assert.equal(
  tvPosterFor(
    withPoster(data, "c1", "https://example.com/c.jpg").find((g) => g.title === "C Show"),
  ),
  "https://example.com/c.jpg",
);
assert.equal(
  tvPosterFor(
    withPoster(data, "a", "http://example.com/insecure.jpg").find((g) => g.title === "A Show"),
  ),
  "",
);
assert.equal(JSON.stringify(data), before);
console.log(
  "PASS: one TV card per show, overall ratings only, zero vs unrated, season-note search, premiere-year sorts, posters from the show or its seasons, and unchanged source records.",
);
