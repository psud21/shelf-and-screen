import type { Media } from "./media";

// Goodreads headers match its native library CSV. Criticker's custom importer
// reads columns by position: IMDb ID, 0–100 rating, watched date, minireview.
export const goodreadsHeaders = [
  "Book Id",
  "Title",
  "Author",
  "ISBN",
  "ISBN13",
  "My Rating",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "Exclusive Shelf",
];
export const critickerHeaders = ["imdb_id", "rating", "date_watched", "minireview"];
export type ExportIssue = { item: Media; reason: string };
export type ExportFile = { csv: string; count: number };

function quote(value: unknown) {
  let text = String(value ?? "");
  // Quoting alone does not stop spreadsheet formulas in downloaded text cells.
  if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
function csv(headers: string[], rows: unknown[][]) {
  return [headers.join(","), ...rows.map((row) => row.map(quote).join(","))].join("\r\n");
}
function metadata(item: Media, name: string) {
  return (
    Object.entries(item.metadata || {}).find(
      ([key]) => key.trim().toLowerCase() === name.toLowerCase(),
    )?.[1] || ""
  );
}
function identifier(value: string) {
  return value
    .trim()
    .replace(/^="(.*)"$/, "$1")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}
function isbn(value: string) {
  const clean = identifier(value);
  return /^(?:\d{9}[\dX]|\d{13})$/.test(clean) ? clean : "";
}
export function bookIdentifiers(item: Media) {
  const current = isbn(item.isbn);
  // An edited edition ISBN takes precedence over identifiers in an old import.
  if (current)
    return {
      isbn10: current.length === 10 ? current : "",
      isbn13: current.length === 13 ? current : "",
    };
  const isbn10 = isbn(metadata(item, "ISBN"));
  const isbn13 = isbn(metadata(item, "ISBN13"));
  return { isbn10: isbn10.length === 10 ? isbn10 : "", isbn13: isbn13.length === 13 ? isbn13 : "" };
}
// Use calendar dates, never a timezone conversion or a fabricated read date.
function date(value: string) {
  const match = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:$|T)/.exec(value);
  if (!match) return "";
  const result = `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(`${result}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result
    ? result
    : "";
}
export function goodreadsStars(score: number | null) {
  return score === null ? 0 : Math.max(1, Math.min(5, Math.round(score / 5) / 4));
}
export function goodreadsExport(items: Media[], includeNotes = false) {
  const books = items.filter((item) => item.kind === "book");
  const issues: ExportIssue[] = [];
  const rows: unknown[][] = [];
  books.forEach((item) => {
    const ids = bookIdentifiers(item);
    if (!ids.isbn10 && !ids.isbn13) {
      issues.push({
        item,
        reason:
          "Not exported: Goodreads requires an ISBN. Add one in Title & details, or add this book directly on Goodreads.",
      });
      return;
    }
    const shelf =
      item.status === "finished"
        ? "read"
        : item.status === "progress" || item.status === "paused"
          ? "currently-reading"
          : "to-read";
    const tags =
      item.status === "paused" ? "on-hold" : item.status === "dropped" ? "did-not-finish" : "";
    const originalBookId =
      metadata(item, "Book Id") || (/goodreads/i.test(item.source) ? item.sourceId || "" : "");
    const row = [
      /^\d+$/.test(originalBookId) ? originalBookId : "",
      item.title,
      item.creator,
      ids.isbn10 || ids.isbn13,
      ids.isbn13,
      goodreadsStars(item.score),
      item.status === "finished" ? date(item.completedAt).replaceAll("-", "/") : "",
      date(item.addedAt).replaceAll("-", "/"),
      [shelf, tags].filter(Boolean).join(", "),
      shelf,
    ];
    if (includeNotes) row.push(item.notes);
    rows.push(row);
  });
  const headers = [...goodreadsHeaders, ...(includeNotes ? ["My Review"] : [])];
  const files: ExportFile[] = [];
  // Goodreads recommends fewer than 500 books in each import file.
  for (let offset = 0; offset < rows.length; offset += 499) {
    const batch = rows.slice(offset, offset + 499);
    files.push({ csv: csv(headers, batch), count: batch.length });
  }
  return {
    files,
    count: rows.length,
    total: books.length,
    issues,
    adjustedShelves: books.filter((item) => item.status === "paused" || item.status === "dropped")
      .length,
  };
}
export function imdbId(item: Media) {
  const value = (item.sourceId || metadata(item, "IMDB ID")).trim();
  if (/^tt\d+(?:_s[1-9]\d*)?$/i.test(value)) return value.toLowerCase();
  if (value) return "";
  const url = item.sourceUrl || "";
  // Only use actual IMDb links; a title or a Criticker slug isn't an IMDb ID.
  return (
    /^https?:\/\/(?:www\.)?imdb\.com\/title\/(tt\d+)(?:[/?#]|$)/i.exec(url)?.[1].toLowerCase() || ""
  );
}
export function critickerExport(items: Media[], includeNotes = false) {
  const screen = items.filter((item) => item.kind !== "book");
  const rated = screen.filter((item) => item.score !== null);
  const issues: ExportIssue[] = [];
  const ids = rated.map(imdbId);
  const files: ExportFile[] = [];
  let rows: unknown[][] = [],
    lines = 1,
    count = 0;
  function flush() {
    if (rows.length) files.push({ csv: csv(critickerHeaders, rows), count: rows.length });
    rows = [];
    lines = 1;
  }
  rated.forEach((item, index) => {
    const id = ids[index];
    if (!id) {
      issues.push({
        item,
        reason: "Add an IMDb ID in Title & details before exporting this rating.",
      });
      return;
    }
    if (ids.indexOf(id) !== ids.lastIndexOf(id)) {
      issues.push({
        item,
        reason: `More than one entry uses ${id}. Resolve the duplicate IMDb ID before exporting.`,
      });
      return;
    }
    const review = includeNotes ? item.notes : "";
    // Count physical lines too, so multiline reviews respect the 5,000-line cap.
    const rowLines = 1 + (review.match(/\r\n|\r|\n/g) || []).length;
    if (rowLines > 4999) {
      issues.push({
        item,
        reason: "This review exceeds Criticker’s file limit. Exclude notes or shorten the review.",
      });
      return;
    }
    if (lines + rowLines > 5000) flush();
    rows.push([id, item.score, date(item.completedAt), review]);
    lines += rowLines;
    count++;
  });
  flush();
  return { files, count, issues, unrated: screen.length - rated.length };
}
