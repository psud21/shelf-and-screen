import { compareValues } from "./normalize.mjs";

/** @typedef {import('./media').Media} Media */

/** @param {Media[]} items
 * @param {{query:string, kind:string, status:string, kindleOnly:boolean, sort:'title'|'kind'|'score'|'completedAt', ascending:boolean}} options
 * @returns {Media[]} */
export function overviewRows(items, options) {
  const query = options.query.trim().toLocaleLowerCase();
  return items
    .filter(
      (item) =>
        (options.kind === "all" || item.kind === options.kind) &&
        (options.status === "all" || item.status === options.status) &&
        (!options.kindleOnly || (item.kind === "book" && item.owned)) &&
        (!query ||
          `${item.title} ${item.creator} ${item.notes} ${item.genre} ${item.platform} ${item.year}`
            .toLocaleLowerCase()
            .includes(query)),
    )
    .sort(
      (a, b) =>
        compareValues(a[options.sort], b[options.sort], options.ascending) ||
        a.title.localeCompare(b.title),
    );
}
