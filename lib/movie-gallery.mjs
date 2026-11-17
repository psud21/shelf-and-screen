import { artworkUrl } from "./book-covers.mjs";
import { compareValues } from "./normalize.mjs";

/** A movie's poster is the image link saved on the title. */
export function moviePosterFor(item) {
  return artworkUrl(item.coverUrl);
}

/** Filter and sort a copy of the movie collection; unrated/unknown values stay last. */
export function movieRows(items, { query = "", status = "all", sort = "score" } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const value = (item) =>
    sort === "score"
      ? item.score
      : sort === "year" || sort === "oldest"
        ? Number(item.year) || null
        : item.addedAt || null;
  return items
    .filter(
      (item) =>
        item.kind === "movie" &&
        (status === "all" ||
          (status === "unrated" ? item.score === null : item.status === status)) &&
        (!needle ||
          `${item.title} ${item.year} ${item.creator} ${item.genre} ${item.notes} ${item.platform}`
            .toLocaleLowerCase()
            .includes(needle)),
    )
    .sort((a, b) =>
      sort === "title"
        ? byTitle(a, b)
        : compareValues(value(a), value(b), sort === "oldest") || byTitle(a, b),
    );
}
