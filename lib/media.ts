import { z } from "zod";
import { getPageCount } from "./bookshelf.mjs";
import { calendarDate } from "./calendar-date.mjs";
import { normalizeText as normalized } from "./normalize.mjs";
export const episodeTrackerSchema = z
  .object({
    season: z.number().int().min(1).max(1000),
    total: z.number().int().min(1).max(1000),
    watched: z.array(z.number().int().min(1).max(1000)).max(1000),
  })
  .superRefine((tracker, ctx) => {
    if (
      new Set(tracker.watched).size !== tracker.watched.length ||
      tracker.watched.some((number) => number > tracker.total)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Episode marks must be unique and within the season.",
      });
  });
export const mediaSchema = z
  .object({
    // Field order here is the order fields are written to the library file.
    id: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(500),
    creator: z.string().max(300).default(""),
    kind: z.enum(["book", "movie", "tv"]),
    recommendedBy: z.string().max(300).optional(),
    recommendationNote: z.string().max(2000).optional(),
    year: z.string().max(10).default(""),
    status: z.enum(["planned", "progress", "finished", "paused", "dropped"]),
    score: z.number().int().min(0).max(100).nullable(),
    notes: z.string().max(20000).default(""),
    platform: z.string().max(200).default(""),
    owned: z.boolean().default(false),
    progress: z.string().max(100).default(""),
    genre: z.string().max(150).default(""),
    priority: z.boolean().default(false),
    completedAt: z.string().max(10).default(""),
    addedAt: z.string().max(40),
    source: z.string().max(60).default("Manual"),
    sourceRating: z.string().max(100).default(""),
    isbn: z.string().max(30).default(""),
    coverUrl: z.string().max(2000).default(""),
    pageCount: z.number().int().positive().max(30000).nullable().optional(),
    sourceUrl: z.string().max(2000).optional(),
    sourceId: z.string().max(200).optional(),
    ratedAt: z.string().max(10).optional(),
    metadata: z.record(z.string()).optional(),
    nextReleaseTitle: z.string().max(300).optional(),
    nextReleaseDate: z.string().max(10).optional(),
    releaseConfidence: z.enum(["confirmed", "tentative", "tba"]).optional(),
    releaseSource: z.string().max(2000).optional(),
    releaseCheckedAt: z.string().max(10).optional(),
    releaseNote: z.string().max(2000).optional(),
    episodeTracker: episodeTrackerSchema.optional(),
  })
  .superRefine((item, ctx) => {
    if (item.episodeTracker && item.kind !== "tv")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Episode tracking belongs to a TV entry.",
        path: ["episodeTracker"],
      });
  });
export type Media = z.infer<typeof mediaSchema>;
export const typeNames = { book: "Book", movie: "Movie", tv: "TV show" };
export const statusNames = {
  planned: "Up next",
  progress: "In progress",
  finished: "Finished",
  paused: "On hold",
  dropped: "Stopped",
};
export function blankMedia(): Media {
  return {
    id: crypto.randomUUID(),
    title: "",
    creator: "",
    kind: "book",
    year: "",
    status: "planned",
    score: null,
    notes: "",
    platform: "",
    owned: false,
    progress: "",
    genre: "",
    priority: false,
    completedAt: "",
    addedAt: new Date().toISOString(),
    source: "Manual",
    recommendedBy: "",
    recommendationNote: "",
    sourceRating: "",
    isbn: "",
    coverUrl: "",
  };
}
export function sameMedia(a: Media, b: Media) {
  if (a.kind !== b.kind || normalized(a.title) !== normalized(b.title)) return false;
  if (a.kind === "book")
    return !a.creator || !b.creator || normalized(a.creator) === normalized(b.creator);
  return !a.year || !b.year || a.year === b.year;
}
export function parseCSV(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const firstLine = text.split(/\r?\n/)[0];
  const delim = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell.length === 0) quoted = !quoted;
      else cell += c;
    } else if (c === delim && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted)
    throw new Error("A quoted field is missing its closing quote. Please check the CSV file.");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export type ImportOptions = {
  source: string;
  kind: Media["kind"];
  ratingScale: number;
  mapping?: Record<string, string>;
};
export const importFields = [
  "title",
  "creator",
  "kind",
  "year",
  "score",
  "status",
  "notes",
  "platform",
  "owned",
  "progress",
  "genre",
  "completedAt",
  "isbn",
  "pageCount",
  "sourceRating",
  "sourceUrl",
  "sourceId",
  "ratedAt",
  "addedAt",
  "nextReleaseTitle",
  "nextReleaseDate",
  "releaseConfidence",
  "releaseSource",
  "releaseCheckedAt",
  "releaseNote",
  "episodeTracker",
  "recommendedBy",
  "recommendationNote",
  "priority",
  "coverUrl",
];
// Only the original-file columns the app still reads are kept on each title.
const keptMetadata = new Set(["isbn", "isbn13", "book id", "imdb id", "number of pages"]);
const aliases: Record<string, string[]> = {
  priority: ["priority", "top of my list"],
  recommendedBy: ["recommendedby", "recommended by", "recommender"],
  recommendationNote: ["recommendationnote", "recommendation note", "recommendation reason"],
  episodeTracker: ["episodetracker", "episode tracker", "episode tracking"],
  title: [
    "title",
    "name",
    "film",
    "film name",
    "filmname",
    "movie",
    "book title",
    "original title",
  ],
  creator: ["creator", "author", "director", "creators"],
  kind: ["kind", "type", "media type", "title type"],
  year: ["year", "release year", "year published", "original publication year"],
  score: ["score", "my rating", "rating", "rank", "ranking", "your rating", "your score"],
  status: ["status", "exclusive shelf", "shelf", "watch status"],
  notes: ["notes", "my review", "review", "mini review", "minireview", "description"],
  platform: ["platform", "where", "service", "format", "binding"],
  owned: ["owned", "owned copies", "kindle"],
  progress: ["progress"],
  genre: ["genre", "genres"],
  completedAt: ["completedat", "completed at", "date read", "date watched", "date finished"],
  ratedAt: ["ratedat", "date rated", "rated"],
  addedAt: ["addedat", "date added"],
  sourceUrl: ["sourceurl", "url", "link"],
  sourceId: ["sourceid", "book id", "imdb id"],
  nextReleaseTitle: ["nextreleasetitle", "next release"],
  nextReleaseDate: ["nextreleasedate", "expected release date"],
  releaseConfidence: ["releaseconfidence", "date status"],
  releaseSource: ["releasesource", "release source"],
  releaseCheckedAt: ["releasecheckedat", "last checked"],
  releaseNote: ["releasenote", "release notes"],
  pageCount: ["pagecount", "page count", "number of pages", "pages"],
  isbn: ["isbn13", "isbn"],
  sourceRating: ["sourcerating", "original rating"],
  coverUrl: ["coverurl", "cover url", "cover", "poster", "poster url", "artwork"],
};
// What a "type" column or a source link says about the kind of title. A link only
// counts through its section (…/tv/…, …/film/…), never through words in the title.
function detectKind(typeText: string, link: string, fallback: Media["kind"]): Media["kind"] {
  const type = typeText.toLowerCase();
  if (/\btv\b|series|episode|season|show/.test(type)) return "tv";
  if (/movie|film/.test(type)) return "movie";
  if (/book|audio|novel/.test(type)) return "book";
  const section = /^https?:\/\/[^/]+\/(tv|film|movie|book)s?\//i.exec(link)?.[1].toLowerCase();
  if (section === "tv") return "tv";
  if (section === "film" || section === "movie") return "movie";
  if (section === "book") return "book";
  return fallback;
}
export function guessMapping(headers: string[]) {
  const m: Record<string, string> = {};
  for (const [field, names] of Object.entries(aliases)) {
    const h = headers.find((h) => names.includes(h.toLowerCase().trim()));
    if (h) m[field] = h;
  }
  return m;
}
export function importRows(
  rows: string[][],
  opts: ImportOptions,
): { items: Media[]; errors: string[] } {
  if (rows.length < 2) throw new Error("This file needs a header row and at least one title.");
  const headers = rows[0];
  const map = opts.mapping ?? guessMapping(headers);
  if (!map.title) throw new Error("Choose the column containing the title.");
  const items: Media[] = [];
  const errors: string[] = [];
  rows.slice(1).forEach((row, i) => {
    const get = (field: string) => {
      const n = headers.indexOf(map[field]);
      const value = n < 0 ? "" : (row[n] ?? "").trim();
      // Undo the apostrophe this app's own CSV export puts in front of text that a
      // spreadsheet would otherwise run as a formula.
      return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
    };
    const title = get("title");
    if (!title) {
      errors.push(`Row ${i + 2}: no title`);
      return;
    }
    const raw = get("score");
    let score: number | null = null;
    let episodeTracker: unknown = undefined;
    if (get("episodeTracker")) {
      try {
        episodeTracker = JSON.parse(get("episodeTracker"));
      } catch {
        errors.push(`Row ${i + 2}: episode tracking is not valid JSON.`);
        return;
      }
    }
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > opts.ratingScale) {
        errors.push(`Row ${i + 2}: rating must be between 0 and ${opts.ratingScale}`);
        return;
      }
      if (!(opts.source === "Goodreads" && n === 0))
        score = Math.round((n / opts.ratingScale) * 100);
    }
    const kind = detectKind(get("kind"), get("sourceUrl"), opts.kind);
    const s = get("status").toLowerCase();
    let status: Media["status"] = "planned";
    if (/currently|progress|reading|watching/.test(s) && !s.includes("to-")) status = "progress";
    else if (["read", "watched", "finished", "completed", "seen"].includes(s)) status = "finished";
    else if (/hold|paused/.test(s)) status = "paused";
    else if (/drop|stop|dnf|did-not-finish/.test(s)) status = "dropped";
    else if (!s && score !== null) status = "finished";
    const safeDate = (value: string): string => calendarDate(value);
    const cover = get("coverUrl");
    const owned = get("owned");
    const item = {
      ...blankMedia(),
      ...(episodeTracker !== undefined ? { episodeTracker } : {}),
      nextReleaseTitle: get("nextReleaseTitle"),
      nextReleaseDate: safeDate(get("nextReleaseDate")),
      releaseConfidence: ["confirmed", "tentative", "tba"].includes(get("releaseConfidence"))
        ? get("releaseConfidence")
        : "tba",
      releaseSource: get("releaseSource"),
      releaseCheckedAt: safeDate(get("releaseCheckedAt")),
      releaseNote: get("releaseNote"),
      metadata: Object.fromEntries(
        headers
          .map((h, n) => [h.trim(), (row[n] ?? "").trim()])
          .filter(([name, value]) => value && keptMetadata.has(name.toLowerCase())),
      ),
      sourceUrl: get("sourceUrl"),
      sourceId: get("sourceId"),
      ratedAt: safeDate(get("ratedAt")),
      ...(safeDate(get("addedAt"))
        ? { addedAt: new Date(safeDate(get("addedAt")) + "T12:00:00Z").toISOString() }
        : {}),
      recommendedBy: get("recommendedBy"),
      recommendationNote: get("recommendationNote"),
      priority: /^(true|yes|1|high)$/i.test(get("priority")),
      title,
      kind,
      pageCount: get("pageCount") ? Number(get("pageCount")) : undefined,
      creator: get("creator"),
      year: get("year"),
      score,
      status,
      notes: get("notes"),
      platform: get("platform"),
      owned: opts.source !== "Goodreads" && /^(true|yes|kindle|[1-9]\d*)$/i.test(owned),
      progress: get("progress"),
      genre: get("genre"),
      completedAt: safeDate(get("completedAt")),
      coverUrl: /^https:\/\//i.test(cover) ? cover : "",
      isbn: get("isbn").replace(/[^0-9X]/gi, ""),
      source: opts.source,
      sourceRating: get("sourceRating") || (raw !== "" ? `${raw}/${opts.ratingScale}` : ""),
    };
    const check = mediaSchema.safeParse(item);
    if (check.success) items.push(check.data);
    else errors.push(`Row ${i + 2}: ${check.error.issues[0].message}`);
  });
  return { items, errors };
}
export function exportCSV(items: Media[]) {
  const fields = [
    "title",
    "creator",
    "kind",
    "year",
    "score",
    "status",
    "notes",
    "platform",
    "owned",
    "progress",
    "genre",
    "completedAt",
    "isbn",
    "pageCount",
    "sourceRating",
    "sourceUrl",
    "sourceId",
    "ratedAt",
    "addedAt",
    "nextReleaseTitle",
    "nextReleaseDate",
    "releaseConfidence",
    "releaseSource",
    "releaseCheckedAt",
    "releaseNote",
    "episodeTracker",
    "recommendedBy",
    "recommendationNote",
    "priority",
    "coverUrl",
  ] as const;
  const quote = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [
    fields.join(","),
    ...items.map((m) =>
      fields
        .map((k) =>
          quote(
            k === "pageCount"
              ? getPageCount(m)
              : k === "episodeTracker"
                ? m.episodeTracker
                  ? JSON.stringify(m.episodeTracker)
                  : ""
                : m[k],
          ),
        )
        .join(","),
    ),
  ].join("\r\n");
}
