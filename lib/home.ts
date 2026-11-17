import { finishedOn, type Media } from "./media.ts";
import { queueItems } from "./queue.ts";
import { getPageCount, readingFraction } from "./bookshelf.mjs";
import { episodeSummary } from "./episodes.mjs";
import { splitTVTitle } from "./tv-guide.mjs";

// What the home screen shows, worked out from the library. Pure functions, so
// every section is tested without a browser.

export { finishedOn };

/** A season entry ("Andor - Season 2") rather than the show itself. */
const isSeason = (item: Media) => item.kind === "tv" && splitTVTitle(item.title).number !== null;

export type InProgress = { item: Media; fraction: number | null; detail: string };

/** What you're reading or watching now, most recently touched first. */
export function inProgress(items: Media[]): InProgress[] {
  return items
    .filter((item) => item.status === "progress")
    .sort((a, b) => (b.completedAt || b.addedAt).localeCompare(a.completedAt || a.addedAt))
    .map((item) => {
      if (item.kind === "tv" && item.episodeTracker) {
        const summary = episodeSummary(item)!;
        return {
          item,
          fraction: summary.count / summary.total,
          detail: summary.next
            ? `Season ${summary.season} · next: episode ${summary.next}`
            : `Season ${summary.season} complete`,
        };
      }
      const fraction = item.kind === "book" ? readingFraction(item) : null;
      return { item, fraction, detail: item.progress };
    });
}

/** The front of the queue: priorities first, then the newest additions. */
export function upNext(items: Media[], limit = 12): Media[] {
  return queueItems(items, { sort: "priority" }).slice(0, limit);
}

/** Finished titles with a date, newest first. */
export function recentlyFinished(items: Media[], limit = 12): Media[] {
  return items
    .filter((item) => item.status === "finished" && finishedOn(item))
    .sort((a, b) => finishedOn(b).localeCompare(finishedOn(a)) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** The highest-rated titles across books, films and shows (shows, not their seasons). */
export function favourites(items: Media[], limit = 12, minimum = 90): Media[] {
  return items
    .filter((item) => item.score !== null && item.score >= minimum && !isSeason(item))
    .sort(
      (a, b) =>
        b.score! - a.score! ||
        finishedOn(b).localeCompare(finishedOn(a)) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

/** Releases you're waiting for: dated ones soonest first, then those still to be announced. */
export function upcomingReleases(items: Media[], today: string): Media[] {
  return items
    .filter((item) => item.nextReleaseTitle?.trim())
    .filter((item) => !item.nextReleaseDate || item.nextReleaseDate >= today)
    .sort(
      (a, b) =>
        (a.nextReleaseDate || "9999").localeCompare(b.nextReleaseDate || "9999") ||
        a.title.localeCompare(b.title),
    );
}

export type YearStats = {
  year: string;
  books: number;
  films: number;
  shows: number;
  pages: number;
  minutes: number;
  average: number | null;
};

/**
 * What you finished in a calendar year. When nothing is dated in the given year
 * yet, the most recent year that has something is used instead.
 */
export function yearStats(items: Media[], year: string): YearStats | null {
  const finished = items.filter((item) => item.status === "finished" && finishedOn(item));
  if (!finished.length) return null;
  const years = finished.map((item) => finishedOn(item).slice(0, 4)).sort();
  const chosen = years.includes(year) ? year : years.at(-1)!;
  const inYear = finished.filter((item) => finishedOn(item).startsWith(chosen));
  const rated = inYear.filter((item) => item.score !== null);
  return {
    year: chosen,
    books: inYear.filter((item) => item.kind === "book").length,
    films: inYear.filter((item) => item.kind === "movie").length,
    shows: inYear.filter((item) => item.kind === "tv").length,
    pages: inYear
      .filter((item) => item.kind === "book")
      .reduce((sum, item) => sum + (getPageCount(item) ?? 0), 0),
    minutes: inYear
      .filter((item) => item.kind === "movie")
      .reduce((sum, item) => sum + (item.runtime ?? 0), 0),
    average: rated.length
      ? Math.round(rated.reduce((sum, item) => sum + item.score!, 0) / rated.length)
      : null,
  };
}
