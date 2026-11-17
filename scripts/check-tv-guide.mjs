import assert from "node:assert/strict";
import {
  groupTV,
  nextSeasonNumber,
  splitTVTitle,
  tvGuideRows,
  tvReleases,
} from "../lib/tv-guide.mjs";

const item = (id, title, score, sourceId = "", year = "2022", extra = {}) => ({
  id,
  title,
  kind: "tv",
  score,
  sourceId,
  year,
  status: "finished",
  notes: "",
  creator: "",
  platform: "",
  genre: "",
  progress: "",
  ...extra,
});
const library = [
  item("overall", "A Show", 83, "tt123"),
  item("s10", "A Show - Season 10", 0, "tt123_s10", "2026"),
  item("s2", "A Show - Season 2", 88, "tt123_s2", "2025", { notes: "A remarkable finale" }),
  item("s1", "A Show - Season 1", 78, "tt123_s1"),
  item("manual", "A Show - Season 3", null, "", "2025", {
    status: "progress",
    progress: "Episode 4",
  }),
  item("only", "B Show - Season 4", 99, "tt456_s4", "2024"),
  item("unknown", "C Show", null, "", "", { nextReleaseTitle: "Season 2" }),
  item("dated", "D Show", 0, "", "2024", {
    nextReleaseTitle: "Season 3",
    nextReleaseDate: "2027-01-01",
  }),
  { ...item("book", "A Show - Season 1", 100), kind: "book" },
];
const original = JSON.stringify(library),
  groups = groupTV(library),
  a = groups.find((g) => g.title === "A Show");
assert.equal(groups.length, 4);
assert.deepEqual(
  a.seasons.map((s) => s.number),
  [1, 2, 3, 10],
);
assert.equal(nextSeasonNumber(a), 11);
assert.equal(a.series[0].score, 83);
assert.equal(a.seasons.at(-1).item.score, 0);
assert.equal(groups.find((g) => g.title === "B Show").series.length, 0);
assert.deepEqual(
  groups.flatMap((g) => g.entries.map((i) => i.id)).sort(),
  library
    .filter((i) => i.kind === "tv")
    .map((i) => i.id)
    .sort(),
);
assert.deepEqual(
  tvGuideRows(library, { query: " REMARKABLE ", status: "progress" }).map((g) => g.title),
  ["A Show"],
);
assert.equal(tvGuideRows(library, { query: "finale" })[0].seasons.length, 4);
assert.deepEqual(
  tvGuideRows(library, { query: "Season 3" }).map((g) => g.title),
  ["A Show", "D Show"],
);
assert.deepEqual(
  tvGuideRows(library, { sort: "score" }).map((g) => g.title),
  ["A Show", "D Show", "B Show", "C Show"],
);
assert.deepEqual(
  tvGuideRows(library, { status: "unrated" }).map((g) => g.title),
  ["B Show", "C Show"],
);
assert.deepEqual(
  tvGuideRows(library, { status: "upcoming", sort: "release" }).map((g) => g.title),
  ["D Show", "C Show"],
);
assert.equal(tvReleases(groups.find((g) => g.title === "C Show"))[0].nextReleaseDate, undefined);
assert.equal(JSON.stringify(library), original);
for (const title of ["A Show — Season 2", "A Show: Season 2", "A Show (Season 2)"])
  assert.deepEqual(splitTVTitle(title), { title: "A Show", number: 2 });
assert.deepEqual(splitTVTitle("Season of the Witch"), {
  title: "Season of the Witch",
  number: null,
});

const remakes = groupTV([
  item("old", "Same Name", 70, "tt100", "2013"),
  item("new", "Same Name", 80, "tt200", "2020"),
  item("new-season", "Same Name - Season 1", 85, "tt200_s1", "2020"),
]);
assert.equal(remakes.length, 2);
assert.equal(remakes.find((g) => g.series[0].id === "old").seasons.length, 0);
assert.equal(remakes.find((g) => g.series[0].id === "new").seasons[0].item.id, "new-season");
const ambiguouslyNamed = groupTV([
  item("old", "Same Name", 70, "tt100", "2013"),
  item("new", "Same Name", 80, "tt200", "2020"),
  item("unlinked", "Same Name - Season 2", 40),
]);
assert.equal(ambiguouslyNamed.length, 3);
assert.ok(
  ambiguouslyNamed.find((g) => g.seasons.some((s) => s.item.id === "unlinked")).series.length === 0,
);
console.log(
  "PASS: TV series/season grouping preserves every record, scores and years; manual seasons join unique shows; remakes stay separate; search/status filters compose; unknown dates and scores sort last; zero remains rated.",
);
