import assert from "node:assert/strict";
import { blankMedia } from "../lib/media.ts";
import {
  bookGenre,
  fillInDetails,
  fillMissing,
  imdbIdFor,
  lookupBook,
  lookupScreen,
  tidyGenres,
  tidySummary,
} from "../lib/metadata.ts";

// A stand-in for the three services, answering from a table of URL patterns.
function fakeWeb(routes) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    for (const [pattern, body] of routes)
      if (pattern.test(url))
        return body === 404
          ? new Response("{}", { status: 404 })
          : new Response(JSON.stringify(typeof body === "function" ? body(url) : body), {
              status: 200,
            });
    throw new Error(`unexpected request ${url}`);
  };
  return { fetch, calls };
}

/* ---------- tidying ---------- */
assert.equal(
  tidySummary(
    "A *great* book ([source][1]).\r\n\r\n[1]: https://example.com\r\n----------\nAlso contained in:\n- Something",
  ),
  "A great book.",
);
assert.equal(
  tidySummary("See [the author](https://example.com) and [this][2]."),
  "See the author and this.",
);
assert.equal(
  tidySummary("*A Game of Thrones is the first novel**.\n\n### Plot Summary\n\nLong write-up."),
  "A Game of Thrones is the first novel.",
);
const long = "One sentence here. ".repeat(100);
const short = tidySummary(long, 200);
assert.ok(short.length <= 200 && short.endsWith("."));
assert.equal(
  tidyGenres([
    "crime television series",
    "police television drama",
    "drama television series",
    "Crime film",
  ]),
  "Crime, Police drama, Drama",
);
assert.equal(
  tidyGenres(["black comedy", "comedy drama", "thriller film", "drama film"]),
  "Black comedy, Comedy drama, Thriller",
);
assert.equal(bookGenre(["Fiction", "Fiction, fantasy, epic", "Magic"]), "Fantasy");
assert.equal(bookGenre(["Fiction", "General"]), "");
assert.equal(imdbIdFor({ sourceId: "tt2356777_s1" }), "tt2356777");
assert.equal(imdbIdFor({ sourceId: "" }), "");

/* ---------- filling never replaces what is there ---------- */
const film = {
  ...blankMedia(),
  kind: "movie",
  title: "Parasite",
  year: "2019",
  sourceId: "tt6751668",
};
const details = {
  creator: "Bong Joon-ho",
  year: "2020",
  genre: "Thriller",
  runtime: 132,
  summary: "A family…",
  summarySource: "Wikipedia",
  summaryUrl: "https://en.wikipedia.org/wiki/Parasite_(2019_film)",
};
const filled = fillMissing(film, details);
assert.deepEqual(filled.filled, ["director", "genre", "running time", "summary"]);
assert.equal(filled.item.year, "2019");
assert.equal(filled.item.runtime, 132);
const mine = { ...film, creator: "Someone", genre: "Mine", summary: "My words" };
assert.deepEqual(fillMissing(mine, details).item.summary, "My words");
assert.deepEqual(fillMissing(mine, details).filled, ["running time"]);
assert.equal(fillMissing({ ...film, kind: "tv" }, details).item.runtime, undefined);
assert.equal(film.creator, "");

/* ---------- films and shows ---------- */
const sparql = {
  results: {
    bindings: [
      {
        imdb: { value: "tt6751668" },
        runtime: { value: "132" },
        released: { value: "2019-05-21T00:00:00Z" },
        wiki: { value: "https://en.wikipedia.org/wiki/Parasite_(2019_film)" },
        directors: { value: "Bong Joon-ho" },
        creators: { value: "" },
        genres: { value: "black comedy|thriller film" },
      },
      {
        imdb: { value: "tt0306414" },
        directors: { value: "Ernest Dickerson|Clark Johnson" },
        creators: { value: "David Simon" },
        genres: { value: "crime television series" },
      },
    ],
  },
};
const web = fakeWeb([
  [/query\.wikidata\.org/, sparql],
  [
    /wikipedia\.org\/api\/rest_v1\/page\/summary\/Parasite_\(2019_film\)$/,
    { type: "standard", extract: "Parasite is a 2019 film." },
  ],
]);
const screen = await lookupScreen(["tt6751668", "tt0306414", "tt6751668", "not-an-id"], {
  fetch: web.fetch,
});
assert.equal(screen.get("tt6751668").directedBy, "Bong Joon-ho");
assert.equal(screen.get("tt6751668").runtime, 132);
assert.equal(screen.get("tt6751668").genre, "Black comedy, Thriller");
assert.equal(screen.get("tt6751668").summary, "Parasite is a 2019 film.");
assert.equal(screen.get("tt0306414").createdBy, "David Simon");
assert.equal(screen.get("tt0306414").summary, undefined);
assert.equal(web.calls.filter((url) => url.includes("wikidata")).length, 1);
assert.ok(decodeURIComponent(web.calls[0]).includes('"tt6751668" "tt0306414" }'));
const season = await fillInDetails(
  { ...film, kind: "tv", title: "The Wire - Season 1", sourceId: "tt0306414_s1" },
  { fetch: web.fetch },
);
assert.equal(season.item.creator, "David Simon");
assert.equal(
  fillMissing({ ...film, kind: "tv" }, { directedBy: "A", createdBy: "B" }).item.creator,
  "B",
);
assert.equal(fillMissing(film, { directedBy: "A", createdBy: "B" }).item.creator, "A");
await assert.rejects(fillInDetails({ ...film, sourceId: "" }), /IMDb ID/);

/* ---------- books ---------- */
const book = {
  ...blankMedia(),
  kind: "book",
  title: "Words of Radiance (The Stormlight Archive, #2)",
  creator: "Brandon Sanderson",
  isbn: "",
  metadata: { ISBN13: '="9780765365286"' },
};
const books = fakeWeb([
  [
    /search\.json\?isbn=9780765365286/,
    {
      docs: [
        {
          key: "/works/OL1W",
          title: "Words of Radiance",
          first_publish_year: 2014,
          number_of_pages_median: 1088,
          subject: ["Fantasy fiction"],
        },
      ],
    },
  ],
  [
    /works\/OL1W\.json/,
    { description: { value: "The sequel to The Way of Kings, about a war on a shattered world." } },
  ],
  [/search\.json\?title=Ransom/, { docs: [{ key: "/works/OL9W", title: "A Different Book" }] }],
  [
    /search\.json\?title=Rebecca/,
    { docs: [{ key: "/works/OL2W", title: "Rebecca", first_publish_year: 1938 }] },
  ],
  [/works\/OL2W\.json/, { description: "Short." }],
]);
const radiance = await lookupBook(book, { fetch: books.fetch });
assert.deepEqual(radiance, {
  year: "2014",
  pageCount: 1088,
  genre: "Fantasy",
  summary: "The sequel to The Way of Kings, about a war on a shattered world.",
  summarySource: "Open Library",
  summaryUrl: "https://openlibrary.org/works/OL1W",
});
// A search hit for a different title is never used.
assert.equal(
  await lookupBook({ ...book, title: "Ransom", metadata: {} }, { fetch: books.fetch }),
  null,
);
// A description too short to be useful is skipped; the year still counts.
assert.deepEqual(
  await lookupBook({ ...book, title: "Rebecca", metadata: {} }, { fetch: books.fetch }),
  { year: "1938" },
);

// Network failures are reported plainly.
await assert.rejects(
  lookupBook(book, {
    fetch: async () => {
      throw new TypeError("Failed to fetch");
    },
  }),
  /could not be reached/,
);
await assert.rejects(
  lookupScreen(["tt1"], { fetch: async () => new Response("", { status: 503 }) }),
  /error 503/,
);

console.log(
  "PASS: summaries and genres tidied, only empty fields filled, films and shows from Wikidata and Wikipedia, books from Open Library with title checks, and clear errors.",
);
