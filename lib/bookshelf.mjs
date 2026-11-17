import { compareValues } from "./normalize.mjs";

/** @typedef {import('./media').Media} Media */

/** @param {Media} book @returns {number | null} */
export function getPageCount(book) {
  const raw = book.pageCount !== undefined ? book.pageCount : book.metadata?.["Number of Pages"];
  if (raw === "" || raw === null || raw === undefined) return null;
  const pages = Number(raw);
  return Number.isInteger(pages) && pages > 0 && pages <= 30000 ? pages : null;
}

/** @param {Media} book @returns {number | null} */
export function readingFraction(book) {
  if (book.status !== "progress") return null;
  const percent = book.progress.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) return Math.min(1, Math.max(0, Number(percent[1]) / 100));
  const ratio = book.progress.match(/(\d[\d,]*)\s*(?:of|\/)\s*(\d[\d,]*)/i);
  if (ratio) {
    const total = Number(ratio[2].replaceAll(",", ""));
    if (total > 0) return Math.min(1, Number(ratio[1].replaceAll(",", "")) / total);
  }
  const page = book.progress.match(/(?:page|p\.)\s*(\d[\d,]*)/i);
  const total = getPageCount(book);
  return page && total ? Math.min(1, Number(page[1].replaceAll(",", "")) / total) : null;
}

/** Compact shelf label; complete titles remain in accessible labels and details. */
export function spineTitle(title) {
  const withoutSeries = title.replace(/\s+\([^)]*\)\s*$/, "").trim();
  const subtitle = withoutSeries.indexOf(":");
  const main =
    withoutSeries.length > 48 && subtitle >= 8
      ? withoutSeries.slice(0, subtitle).trim()
      : withoutSeries;
  return main || title;
}

export const ratingColors = ["#59451f", "#7e6025", "#bc902c", "#e9b943", "#ffe08a"];

/** @param {Media} book */
export function spineAppearance(book) {
  const pages = getPageCount(book);
  const band = book.score === null ? -1 : Math.min(4, Math.max(0, Math.ceil(book.score / 20) - 1));
  const height = pages === null ? 198 : Math.round(148 + (Math.min(pages, 1400) / 1400) * 132);
  const baseWidth = pages !== null && pages > 800 ? 44 : pages !== null && pages < 220 ? 34 : 38;
  const columns = Math.ceil((spineTitle(book.title).length * 7) / Math.max(100, height - 40));
  return {
    height,
    width: Math.max(baseWidth, Math.min(100, columns * 15 + 12)),
    color: band === -1 ? "#30343e" : ratingColors[band],
    ink: band < 2 ? "#f3eee0" : "#19160d",
    fraction: readingFraction(book),
  };
}

/** Pack variable-width spines into rails without overflow, including on phones.
 * @param {Media[]} books @param {number} width @returns {Media[][]} */
export function packShelves(books, width) {
  const capacity = Math.max(44, width - 40);
  /** @type {Media[][]} */
  const rows = [];
  /** @type {Media[]} */
  let row = [];
  let used = 0;
  for (const book of books) {
    const space = spineAppearance(book).width + (row.length ? 5 : 0);
    if (row.length && used + space > capacity) {
      rows.push(row);
      row = [];
      used = 0;
    }
    used += spineAppearance(book).width + (row.length ? 5 : 0);
    row.push(book);
  }
  if (row.length) rows.push(row);
  return rows;
}

/** @param {Media[]} books @param {'date'|'score'|'pages'|'genre'} sort @param {boolean} ascending */
export function sortBooks(books, sort, ascending = false) {
  const value = (book) =>
    sort === "pages"
      ? getPageCount(book)
      : sort === "score"
        ? book.score
        : sort === "genre"
          ? book.genre
          : book.completedAt;
  return [...books].sort(
    (a, b) => compareValues(value(a), value(b), ascending) || a.title.localeCompare(b.title),
  );
}
