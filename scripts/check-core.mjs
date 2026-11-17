import assert from "node:assert/strict";
import {
  blankMedia,
  parseCSV,
  importRows,
  sameMedia,
  exportCSV,
  guessMapping,
  mediaSchema,
} from "../lib/media.ts";
const goodreads =
  'Title,Author,My Rating,Exclusive Shelf,My Review,ISBN13\r\n"A book, with commas",An Author,4,read,"First line\nSecond ""quoted"" line",="9781234567890"\r\nUnrated,Someone,0,to-read,,\r\nCurrent,Someone,0,currently-reading,,';
const gr = importRows(parseCSV(goodreads), { source: "Goodreads", kind: "book", ratingScale: 5 });
assert.equal(gr.items.length, 3);
assert.equal(gr.items[0].score, 80);
assert.equal(gr.items[0].sourceRating, "4/5");
assert.equal(gr.items[0].notes, 'First line\nSecond "quoted" line');
assert.equal(gr.items[0].status, "finished");
assert.equal(gr.items[1].score, null);
assert.equal(gr.items[1].status, "planned");
assert.equal(gr.items[2].status, "progress");
assert.equal(gr.items[0].isbn, "9781234567890");
const cr = importRows(
  parseCSV("Film,Year,Rating,Type\nZero,2001,0,Film\nSeries,2020,99,TV Series\nBad,2000,101,Film"),
  { source: "Criticker", kind: "movie", ratingScale: 100 },
);
assert.equal(cr.items[0].score, 0);
assert.equal(cr.items[0].status, "finished");
assert.equal(cr.items[1].kind, "tv");
assert.equal(cr.errors.length, 1);
const copy = { ...gr.items[0], id: "other" };
assert(sameMedia(gr.items[0], copy));
assert(!sameMedia(gr.items[0], { ...copy, kind: "movie" }));
assert(sameMedia({ ...copy, title: "A Book! with commas" }, copy));
assert(!sameMedia({ ...copy, creator: "Other Writer" }, copy));
assert.throws(() => parseCSV('Title\n"unfinished'), /closing quote/);
assert.equal(parseCSV("\uFEFFTitle\tRating\r\nBook\t80")[1][1], "80");
const roundTrip = importRows(parseCSV(exportCSV(gr.items)), {
  source: "Other",
  kind: "book",
  ratingScale: 100,
});
assert.equal(roundTrip.items[0].notes, gr.items[0].notes);
assert.equal(roundTrip.items[0].score, 80);
assert.equal(roundTrip.items[0].sourceRating, "4/5");
assert.equal(roundTrip.items[2].status, "progress");
assert.equal(
  mediaSchema.safeParse({ ...blankMedia(), title: "A title", score: 101 }).success,
  false,
);
assert.equal(mediaSchema.safeParse({ ...blankMedia(), title: "A title", score: 0 }).success, true);
assert.equal(guessMapping(["Title", "Author", "My Rating"])["score"], "My Rating");
console.log(
  "PASS: Goodreads conversion, unrated books, Criticker zero, TV types, invalid rows, quoted CSV, duplicate matching, round trips, and score validation.",
);
const actualFormat = importRows(
  parseCSV(
    "Rating, Film Name, Year, Date Rated, Date Watched, Mini Review, URL, IMDB ID\n99,Example Series,2014,01 Jan 2026,,,https://www.criticker.com/tv/Example/,tt12345",
  ),
  { source: "Criticker", kind: "movie", ratingScale: 100 },
);
assert.equal(actualFormat.items[0].kind, "tv");
assert.equal(actualFormat.items[0].completedAt, "");
assert.equal(actualFormat.items[0].ratedAt, "2026-01-01");
assert.equal(actualFormat.items[0].sourceId, "tt12345");
// Only the original columns the app still reads are kept on the title.
assert.deepEqual(actualFormat.items[0].metadata, { "IMDB ID": "tt12345" });
console.log(
  "PASS: native Criticker headers, URL-based TV detection, trimmed source metadata, and rating dates kept separate from completion dates.",
);

// A film is not mistaken for TV because of a word in its title or link.
const kinds = importRows(
  parseCSV(
    [
      "Rating, Film Name, Year, Date Rated, Date Watched, Mini Review, URL, IMDB ID",
      "90,Star Wars: Episode IV,1977,,,,https://www.criticker.com/film/Star-Wars-Episode-IV-A-New-Hope/,tt0076759",
      "80,A Series of Unfortunate Events,2004,,,,https://www.criticker.com/film/A-Series-of-Unfortunate-Events/,tt0339291",
      "85,The Wire,2002,,,,https://www.criticker.com/tv/The-Wire/,tt0306414",
      "70,No Link,2001,,,,,",
    ].join("\n"),
  ),
  { source: "Criticker", kind: "movie", ratingScale: 100 },
);
assert.deepEqual(
  kinds.items.map((item) => item.kind),
  ["movie", "movie", "tv", "movie"],
);
const typed = importRows(
  parseCSV("Title,Type\nOne,TV Series\nTwo,Feature Film\nThree,Audiobook\nFour,\n"),
  { source: "Other", kind: "book", ratingScale: 100 },
);
assert.deepEqual(
  typed.items.map((item) => item.kind),
  ["tv", "movie", "book", "book"],
);

// Dates in a file mean the calendar day written, in every timezone.
const dated = (zone) => {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return importRows(
      parseCSV(
        'Title,Date Read,Date Added,Date Rated\nA,2026/10/17,"Oct 3, 2026",14 Sep 2024\nB,2026-02-30,,\n',
      ),
      { source: "Goodreads", kind: "book", ratingScale: 5 },
    ).items;
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
};
for (const zone of ["America/Los_Angeles", "UTC", "Asia/Tokyo", "Pacific/Auckland"]) {
  const [a, b] = dated(zone);
  assert.equal(a.completedAt, "2026-10-17", zone);
  assert.equal(a.addedAt.slice(0, 10), "2026-10-03", zone);
  assert.equal(a.ratedAt, "2024-09-14", zone);
  assert.equal(b.completedAt, "", zone);
}

// Text a spreadsheet could run as a formula survives an export and re-import unchanged,
// and so does a title's cover link.
const tricky = {
  ...blankMedia(),
  title: "+1",
  kind: "movie",
  notes: "- loved the ending\n=not a formula",
  creator: "@someone",
  coverUrl: "https://example.com/poster.jpg",
};
const exported = exportCSV([tricky]);
assert.ok(exported.includes(`"'+1"`));
const back = importRows(parseCSV(exported), { source: "Other", kind: "movie", ratingScale: 100 })
  .items[0];
assert.equal(back.title, "+1");
assert.equal(back.notes, tricky.notes);
assert.equal(back.creator, "@someone");
assert.equal(back.coverUrl, "https://example.com/poster.jpg");
assert.equal(
  importRows(parseCSV("Title,Cover\nX,javascript:alert(1)\n"), {
    source: "Other",
    kind: "book",
    ratingScale: 100,
  }).items[0].coverUrl,
  "",
);
console.log(
  "PASS: films with TV-like words stay films, dates keep their calendar day in every timezone, and formula-like text and cover links round-trip.",
);
const releaseItem = {
  ...blankMedia(),
  title: "Next release test",
  nextReleaseTitle: "Season 7",
  nextReleaseDate: "2027-04-10",
  releaseConfidence: "tentative",
  releaseSource: "https://example.com/announcement",
  releaseCheckedAt: "2026-10-17",
  releaseNote: "An estimate, subject to change.",
};
const releaseRoundtrip = importRows(parseCSV(exportCSV([releaseItem])), {
  source: "Other",
  kind: "tv",
  ratingScale: 100,
});
assert.equal(releaseRoundtrip.items[0].nextReleaseDate, "2027-04-10");
assert.equal(releaseRoundtrip.items[0].releaseConfidence, "tentative");
assert.equal(releaseRoundtrip.items[0].releaseSource, "https://example.com/announcement");
console.log("PASS: release dates, confidence, and source links survive CSV export and import.");
