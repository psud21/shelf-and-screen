import { finishedOn } from "./media.ts";
import { compareValues } from "./normalize.mjs";
import { groupTV } from "./tv-guide.mjs";

/** @typedef {import('./media').Media} Media */

/**
 * Rows for the All titles table. A show that has its own entry stands for its
 * seasons, so each show appears once; a season without a show entry keeps its row.
 * @param {Media[]} items
 * @param {{query:string, kind:string, status:string, kindleOnly:boolean, sort:'title'|'kind'|'score'|'completedAt', ascending:boolean}} options
 * @returns {Media[]} */
export function overviewRows(items, options) {
  const query = options.query.trim().toLocaleLowerCase();
  const folded = new Set(
    groupTV(items)
      .filter((group) => group.series.length > 0)
      .flatMap((group) => group.seasons.map((season) => season.item.id)),
  );
  const value = (item) => (options.sort === "completedAt" ? finishedOn(item) : item[options.sort]);
  return items
    .filter(
      (item) =>
        !folded.has(item.id) &&
        (options.kind === "all" || item.kind === options.kind) &&
        (options.status === "all" || item.status === options.status) &&
        (!options.kindleOnly || (item.kind === "book" && item.owned)) &&
        (!query ||
          `${item.title} ${item.creator} ${item.notes} ${item.genre} ${item.platform} ${item.year} ${item.series ?? ""}`
            .toLocaleLowerCase()
            .includes(query)),
    )
    .sort(
      (a, b) =>
        compareValues(value(a), value(b), options.ascending) || a.title.localeCompare(b.title),
    );
}
