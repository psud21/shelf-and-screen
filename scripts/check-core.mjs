import assert from "node:assert/strict";
import {
  blankMedia,
  parseCSV,
  importRows,
  sameMedia,
  exportCSV,
  guessMapping,
  mediaSchema,
  runtimeLabel,
  seriesLabel,
  splitSeries,
  yearLabel,
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

// Series are split out of Goodreads-style book titles, and matching ignores them.
assert.deepEqual(splitSeries("Words of Radiance (The Stormlight Archive, #2)"), {
  title: "Words of Radiance",
  series: "The Stormlight Archive",
  number: "2",
});
assert.deepEqual(splitSeries("The Big Sleep (Philip Marlowe, #1)").series, "Philip Marlowe");
assert.deepEqual(splitSeries("Tress of the Emerald Sea (The Cosmere #1)").number, "1");
assert.deepEqual(splitSeries("Hollow Kingdom (Hollow Kingdom, #0.5)").number, "0.5");
assert.deepEqual(splitSeries("The Expanse (The Expanse, #1-3)").number, "1-3");
assert.deepEqual(splitSeries("Meditations (Illustrated)"), {
  title: "Meditations (Illustrated)",
  series: "",
  number: "",
});
assert.equal(
  seriesLabel({ kind: "book", series: "The Stormlight Archive", seriesNumber: "2" }),
  "The Stormlight Archive, Book 2",
);
assert.equal(
  seriesLabel({ kind: "book", series: "The Expanse", seriesNumber: "1-3" }),
  "The Expanse, Books 1-3",
);
assert.equal(seriesLabel({ kind: "book" }), "");
assert.equal(runtimeLabel(132), "2 h 12 min");
assert.equal(runtimeLabel(120), "2 h");
assert.equal(runtimeLabel(45), "45 min");
assert.equal(yearLabel("-700"), "700 BC");
assert.equal(yearLabel("1938"), "1938");
const plain = {
  ...blankMedia(),
  title: "Words of Radiance",
  creator: "Brandon Sanderson",
  kind: "book",
};
assert.ok(
  sameMedia(plain, { ...plain, id: "x", title: "Words of Radiance (The Stormlight Archive, #2)" }),
);

const goodreadsYears = importRows(
  parseCSV(
    'Book Id,Title,Author,My Rating,Year Published,Original Publication Year,Exclusive Shelf\n1,"Words of Radiance (The Stormlight Archive, #2)",Brandon Sanderson,4,2015,2014,read\n2,Rebecca,Daphne du Maurier,5,2013,1938,read\n',
  ),
  { source: "Goodreads", kind: "book", ratingScale: 5 },
).items;
assert.equal(goodreadsYears[0].title, "Words of Radiance");
assert.equal(goodreadsYears[0].series, "The Stormlight Archive");
assert.equal(goodreadsYears[0].seriesNumber, "2");
assert.equal(goodreadsYears[0].year, "2014");
assert.equal(goodreadsYears[1].year, "1938");
assert.equal(goodreadsYears[1].series, undefined);
const withSeries = {
  ...plain,
  series: "The Stormlight Archive",
  seriesNumber: "2",
  summary: "Second book.",
  runtime: undefined,
};
const again = importRows(parseCSV(exportCSV([withSeries])), {
  source: "Other",
  kind: "book",
  ratingScale: 100,
}).items[0];
assert.equal(again.series, "The Stormlight Archive");
assert.equal(again.seriesNumber, "2");
assert.equal(again.summary, "Second book.");
const film = importRows(parseCSV("Title,Type,Runtime\nParasite,Movie,132\n"), {
  source: "Other",
  kind: "movie",
  ratingScale: 100,
}).items[0];
assert.equal(film.runtime, 132);
console.log(
  "PASS: series split from book titles, original publication years preferred, and series, summary and runtime round-trip.",
);
