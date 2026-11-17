import { localToday } from "./calendar-date.mjs";
/** @typedef {import('./media').Media} Media */
/** @typedef {{season:number,total:number,watched:number[]}} Tracker */

/** @param {Media} item */
export function episodeSummary(item) {
  const tracker = item.episodeTracker;
  if (!tracker) return null;
  const watched = new Set(tracker.watched),
    next =
      Array.from({ length: tracker.total }, (_, i) => i + 1).find(
        (number) => !watched.has(number),
      ) ?? null;
  return {
    season: tracker.season,
    total: tracker.total,
    count: watched.size,
    last: Math.max(0, ...watched),
    next,
    complete: watched.size === tracker.total,
    percent: Math.round((watched.size / tracker.total) * 100),
  };
}

/** @param {Media} item @param {Tracker} tracker @param {string} today @returns {Media} */
export function withEpisodeTracker(item, tracker, today = localToday()) {
  if (
    item.kind !== "tv" ||
    !Number.isInteger(tracker.season) ||
    tracker.season < 1 ||
    tracker.season > 1000 ||
    !Number.isInteger(tracker.total) ||
    tracker.total < 1 ||
    tracker.total > 1000
  )
    throw new Error("Choose a valid season and 1–1,000 episodes.");
  if (
    tracker.watched.some(
      (number) => !Number.isInteger(number) || number < 1 || number > tracker.total,
    )
  )
    throw new Error("An episode is outside this season.");
  const clean = { ...tracker, watched: [...new Set(tracker.watched)].sort((a, b) => a - b) };
  const complete = clean.watched.length === clean.total,
    last = Math.max(0, ...clean.watched);
  // Setting up or correcting a tracker leaves "On hold" and "Stopped" alone;
  // only watching another episode picks the season back up.
  const shelved = item.status === "paused" || item.status === "dropped";
  const watchedMore = clean.watched.length > (item.episodeTracker?.watched.length ?? Infinity);
  return {
    ...item,
    episodeTracker: clean,
    status: complete
      ? "finished"
      : shelved && !watchedMore
        ? item.status
        : clean.watched.length
          ? "progress"
          : "planned",
    completedAt: complete ? item.completedAt || today : "",
    progress: `Season ${clean.season} · ${clean.watched.length}/${clean.total} watched${last ? ` · Last: E${last}` : ""}`,
  };
}

/** @param {Media} item @param {number} number @param {string} [today] */
export function toggleEpisode(item, number, today) {
  const tracker = item.episodeTracker;
  if (!tracker) throw new Error("Set up episode tracking first.");
  if (!Number.isInteger(number) || number < 1 || number > tracker.total)
    throw new Error("That episode is outside this season.");
  return withEpisodeTracker(
    item,
    {
      ...tracker,
      watched: tracker.watched.includes(number)
        ? tracker.watched.filter((value) => value !== number)
        : [...tracker.watched, number],
    },
    today,
  );
}
