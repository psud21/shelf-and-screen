import type { Media } from "./media.ts";
import { splitSeries } from "./media.ts";
import { normalizeText } from "./normalize.mjs";

// Fills in what a title is missing (director, running time, genres, a summary,
// first-published year) from open sources that need no account or key:
// Wikidata and Wikipedia for films and shows, Open Library for books.
// Only empty fields are ever filled; nothing you entered is replaced.

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type Details = Partial<
  Pick<
    Media,
    | "creator"
    | "year"
    | "genre"
    | "summary"
    | "summarySource"
    | "summaryUrl"
    | "runtime"
    | "pageCount"
  >
> & {
  /** Who directed it and who created it; films prefer the first, shows the second. */
  directedBy?: string;
  createdBy?: string;
};
export type LookupOptions = { fetch?: Fetch; headers?: Record<string, string> };

const SUMMARY_LIMIT = 1200;

async function getJson<T>(url: string, options: LookupOptions): Promise<T | null> {
  const request = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init));
  let response: Response;
  try {
    response = await request(url, { headers: options.headers });
  } catch {
    throw new Error("The details service could not be reached. Check your connection.");
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The details service answered with error ${response.status}.`);
  return (await response.json()) as T;
}

/** Trim a description to whole sentences within a sensible length. */
export function tidySummary(text: string, limit = SUMMARY_LIMIT): string {
  let clean = text
    .replace(/\r\n?/g, "\n")
    // Open Library notes such as "----------\nAlso contained in:" end the description.
    .split(/\n\s*-{3,}/)[0]
    // Keep the introduction; a heading such as "### Plot Summary" starts a long write-up.
    .split(/\n\s*#{1,6}\s/)[0]
    .replace(/^\s*\[\d+\]:\s*\S+\s*$/gm, "")
    .replace(/\(\s*\[source\]\[\d+\]\s*\)/gi, "")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]+\)/g, "$1")
    .replace(/\*{1,3}|_{2,3}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= limit) return clean;
  clean = clean.slice(0, limit);
  const end = Math.max(
    clean.lastIndexOf(". "),
    clean.lastIndexOf(".\n"),
    clean.lastIndexOf("? "),
    clean.lastIndexOf("! "),
  );
  return end > limit * 0.5 ? clean.slice(0, end + 1) : clean.replace(/\s+\S*$/, "") + "…";
}

/** Wikidata genre names, such as "thriller film" or "crime television series", as plain genres. */
export function tidyGenres(names: string[], limit = 3): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const plain = name
      .toLowerCase()
      .replace(/\b(film|films|television|tv|series|programme|program|show|genre|fiction)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain || seen.has(plain)) continue;
    seen.add(plain);
    out.push(plain.charAt(0).toUpperCase() + plain.slice(1));
    if (out.length === limit) break;
  }
  return out.join(", ");
}

/* ---------- films and shows: Wikidata, then Wikipedia ---------- */

type WikidataRow = Record<string, { value: string } | undefined>;

/** The IMDb ID a film or show is known by; a season's ID points at its show. */
export function imdbIdFor(item: Pick<Media, "sourceId">): string {
  return item.sourceId?.match(/^(tt\d+)(?:_s\d+)?$/i)?.[1].toLowerCase() ?? "";
}

export async function lookupScreen(
  imdbIds: string[],
  options: LookupOptions = {},
): Promise<Map<string, Details>> {
  const ids = [...new Set(imdbIds.filter((id) => /^tt\d+$/.test(id)))];
  const found = new Map<string, Details>();
  if (!ids.length) return found;
  const query = `SELECT ?imdb (MIN(?rt) AS ?runtime) (SAMPLE(?article) AS ?wiki) (MIN(?date) AS ?released)
  (GROUP_CONCAT(DISTINCT ?dl; separator="|") AS ?directors)
  (GROUP_CONCAT(DISTINCT ?cl; separator="|") AS ?creators)
  (GROUP_CONCAT(DISTINCT ?gl; separator="|") AS ?genres)
WHERE {
  VALUES ?imdb { ${ids.map((id) => `"${id}"`).join(" ")} }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item wdt:P57 ?d . OPTIONAL { ?d rdfs:label ?den . FILTER(LANG(?den) = "en") } OPTIONAL { ?d rdfs:label ?dmul . FILTER(LANG(?dmul) = "mul") } BIND(COALESCE(?den, ?dmul) AS ?dl) }
  OPTIONAL { ?item wdt:P170 ?c . OPTIONAL { ?c rdfs:label ?cen . FILTER(LANG(?cen) = "en") } OPTIONAL { ?c rdfs:label ?cmul . FILTER(LANG(?cmul) = "mul") } BIND(COALESCE(?cen, ?cmul) AS ?cl) }
  OPTIONAL { ?item wdt:P136 ?g . OPTIONAL { ?g rdfs:label ?gen . FILTER(LANG(?gen) = "en") } OPTIONAL { ?g rdfs:label ?gmul . FILTER(LANG(?gmul) = "mul") } BIND(COALESCE(?gen, ?gmul) AS ?gl) }
  OPTIONAL { ?item wdt:P577 ?date . }
  OPTIONAL { ?item p:P2047 ?st . ?st psv:P2047 ?v . ?v wikibase:quantityAmount ?rt ; wikibase:quantityUnit wd:Q7727 . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?imdb`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson<{ results: { bindings: WikidataRow[] } }>(url, options);
  for (const row of data?.results.bindings ?? []) {
    const id = row.imdb?.value;
    if (!id) continue;
    // Many people's names now sit on Wikidata's shared "mul" label instead of "en".
    const names = (value?: string) =>
      (value || "").split("|").filter(Boolean).slice(0, 2).join(", ");
    const runtime = Math.round(Number(row.runtime?.value));
    const details: Details = {};
    if (names(row.directors?.value)) details.directedBy = names(row.directors?.value);
    if (names(row.creators?.value)) details.createdBy = names(row.creators?.value);
    if (runtime > 0 && runtime < 1500) details.runtime = runtime;
    const genre = tidyGenres((row.genres?.value || "").split("|"));
    if (genre) details.genre = genre;
    const year = row.released?.value.match(/^(\d{4})/)?.[1];
    if (year) details.year = year;
    const wiki = row.wiki?.value;
    if (wiki) {
      const title = wiki.split("/wiki/")[1];
      const page = await getJson<{ type?: string; extract?: string }>(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
        options,
      );
      if (page?.extract && page.type !== "disambiguation") {
        details.summary = tidySummary(page.extract);
        details.summarySource = "Wikipedia";
        details.summaryUrl = wiki;
      }
    }
    found.set(id, details);
  }
  return found;
}

/* ---------- books: Open Library ---------- */

// Open Library subjects are free text; only clear genre names are used.
const bookGenres: [RegExp, string][] = [
  [/\bscience fiction\b|\bsci-fi\b/i, "Science fiction"],
  [/\bfantasy\b/i, "Fantasy"],
  [/\bhorror\b/i, "Horror"],
  [/\bthriller|suspense\b/i, "Thriller"],
  [/\bdetective|mystery|crime\b/i, "Mystery"],
  [/\bromance\b/i, "Romance"],
  [/\bhistorical fiction\b/i, "Historical fiction"],
  [/\bbiography|autobiography|memoir\b/i, "Biography"],
  [/\bphilosophy\b/i, "Philosophy"],
  [/\bself-help|self-actualization|success\b/i, "Self-help"],
  [/\bbusiness|management|economics\b/i, "Business"],
  [/\bpsychology\b/i, "Psychology"],
  [/\bpoetry\b/i, "Poetry"],
  [/^history\b|\bhistory, modern\b/i, "History"],
  [/\bscience\b/i, "Science"],
];
export function bookGenre(subjects: string[]): string {
  for (const [pattern, name] of bookGenres)
    if (subjects.some((subject) => pattern.test(subject))) return name;
  return "";
}

type SearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
};

function isbnsOf(item: Pick<Media, "isbn" | "metadata">): string[] {
  return [item.isbn, item.metadata?.ISBN13, item.metadata?.ISBN]
    .map((value) => String(value || "").replace(/[^0-9X]/gi, ""))
    .filter((value) => /^(\d{13}|\d{9}[\dX])$/i.test(value));
}

export async function lookupBook(
  item: Pick<Media, "title" | "creator" | "isbn" | "metadata">,
  options: LookupOptions = {},
): Promise<Details | null> {
  const fields = "key,title,author_name,first_publish_year,number_of_pages_median,subject";
  const title = splitSeries(item.title).title;
  const sameWork = (doc: SearchDoc) => {
    const a = normalizeText(splitSeries(doc.title || "").title);
    const b = normalizeText(title);
    return a && b && (a === b || a.startsWith(b) || b.startsWith(a));
  };
  let doc: SearchDoc | undefined;
  for (const isbn of isbnsOf(item)) {
    const data = await getJson<{ docs?: SearchDoc[] }>(
      `https://openlibrary.org/search.json?isbn=${isbn}&fields=${fields}&limit=1`,
      options,
    );
    doc = data?.docs?.find(sameWork);
    if (doc) break;
  }
  if (!doc) {
    const params = new URLSearchParams({ title, fields, limit: "5" });
    if (item.creator) params.set("author", item.creator);
    const data = await getJson<{ docs?: SearchDoc[] }>(
      `https://openlibrary.org/search.json?${params}`,
      options,
    );
    doc = data?.docs?.find(sameWork);
  }
  if (!doc?.key) return null;
  const details: Details = {};
  if (doc.first_publish_year) details.year = String(doc.first_publish_year);
  if (doc.number_of_pages_median && doc.number_of_pages_median < 30000)
    details.pageCount = doc.number_of_pages_median;
  const genre = bookGenre(doc.subject ?? []);
  if (genre) details.genre = genre;
  const work = await getJson<{ description?: string | { value?: string } }>(
    `https://openlibrary.org${doc.key}.json`,
    options,
  );
  const description =
    typeof work?.description === "string" ? work.description : work?.description?.value;
  if (description && description.trim().length > 40) {
    details.summary = tidySummary(description);
    details.summarySource = "Open Library";
    details.summaryUrl = `https://openlibrary.org${doc.key}`;
  }
  return details;
}

/** Copy found details into the empty fields of a title. Returns the names of fields filled. */
export function fillMissing(item: Media, details: Details): { item: Media; filled: string[] } {
  const next: Media = { ...item };
  const filled: string[] = [];
  const empty = (value: unknown) => value === undefined || value === null || value === "";
  const person =
    details.creator ||
    (item.kind === "movie"
      ? details.directedBy || details.createdBy
      : details.createdBy || details.directedBy);
  if (empty(item.creator) && person) {
    next.creator = person;
    filled.push(item.kind === "movie" ? "director" : item.kind === "tv" ? "creator" : "author");
  }
  if (empty(item.year) && details.year) {
    next.year = details.year;
    filled.push("year");
  }
  if (empty(item.genre) && details.genre) {
    next.genre = details.genre;
    filled.push("genre");
  }
  if (item.kind === "movie" && empty(item.runtime) && details.runtime) {
    next.runtime = details.runtime;
    filled.push("running time");
  }
  if (
    item.kind === "book" &&
    empty(item.pageCount) &&
    empty(item.metadata?.["Number of Pages"]) &&
    details.pageCount
  ) {
    next.pageCount = details.pageCount;
    filled.push("page count");
  }
  if (empty(item.summary) && details.summary) {
    next.summary = details.summary;
    next.summarySource = details.summarySource;
    next.summaryUrl = details.summaryUrl;
    filled.push("summary");
  }
  return { item: next, filled };
}

/** Look up and fill one title. */
export async function fillInDetails(
  item: Media,
  options: LookupOptions = {},
): Promise<{ item: Media; filled: string[] }> {
  if (item.kind === "book") {
    const details = await lookupBook(item, options);
    return details ? fillMissing(item, details) : { item, filled: [] };
  }
  const id = imdbIdFor(item);
  if (!id)
    throw new Error(
      "Add the title’s IMDb ID in Title & details first, so the right title is found.",
    );
  const details = (await lookupScreen([id], options)).get(id);
  return details ? fillMissing(item, details) : { item, filled: [] };
}
