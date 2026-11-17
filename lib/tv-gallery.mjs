import { artworkUrl } from "./book-covers.mjs";
import { compareValues } from "./normalize.mjs";
import { tvGuideRows } from "./tv-guide.mjs";

export function tvGroupYear(group) {
  return (
    group.series[0]?.year || group.seasons.find((season) => season.number === 1)?.item.year || ""
  );
}

/** One gallery card per show. Only the overall show score is used. */
export function tvGalleryRows(items, { query = "", status = "all", sort = "score" } = {}) {
  const value = (group) =>
    sort === "score"
      ? (group.series[0]?.score ?? null)
      : sort === "year" || sort === "oldest"
        ? Number(tvGroupYear(group)) || null
        : sort === "release"
          ? group.entries
              .filter((item) => item.nextReleaseDate)
              .map((item) => item.nextReleaseDate)
              .sort()[0] || null
          : group.series[0]?.addedAt ||
            group.entries
              .map((item) => item.addedAt)
              .filter(Boolean)
              .sort()
              .at(-1) ||
            null;
  // tvGuideRows already returns the shows in title order.
  const rows = tvGuideRows(items, { query, status, sort: "title" });
  if (sort === "title") return rows;
  const ascending = sort === "oldest" || sort === "release";
  const byTitle = (a, b) => a.title.localeCompare(b.title) || a.key.localeCompare(b.key);
  return rows.sort((a, b) => compareValues(value(a), value(b), ascending) || byTitle(a, b));
}

/** A show's poster is the image link saved on the show, or failing that on one of its seasons. */
export function tvPosterFor(group) {
  for (const item of group.entries) {
    const url = artworkUrl(item.coverUrl);
    if (url) return url;
  }
  return "";
}
