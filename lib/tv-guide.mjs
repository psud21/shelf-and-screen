import { normalizeText as normalize } from "./normalize.mjs";

/** @typedef {import('./media').Media} Media */
/** @typedef {{key:string,title:string,sourceId:string,series:Media[],seasons:{number:number,item:Media}[],entries:Media[]}} TVGroup */

export function splitTVTitle(title) {
  const match = title.trim().match(/^(.*?)\s*(?:[-–—:]\s*|\(\s*)Season\s+([1-9]\d*)\s*\)?$/i);
  const number = match ? Number(match[2]) : null;
  return match && match[1].trim() && Number.isSafeInteger(number)
    ? { title: match[1].trim(), number }
    : { title: title.trim(), number: null };
}
const parentId = (item) => item.sourceId?.match(/^(tt\d+)(?:_s\d+)?$/i)?.[1].toLowerCase() || "";

/** Group for display only. Keep every original record and its independently editable score. @param {Media[]} items @returns {TVGroup[]} */
export function groupTV(items) {
  const records = items
    .filter((item) => item.kind === "tv")
    .map((item) => ({ item, ...splitTVTitle(item.title), sourceId: parentId(item) }));
  /** @type {TVGroup[]} */
  const groups = [];
  function candidates(record) {
    return groups.filter((group) => normalize(group.title) === normalize(record.title));
  }
  function create(record) {
    const group = {
      key: record.item.id,
      title: record.title,
      sourceId: record.sourceId,
      series: [],
      seasons: [],
      entries: [],
    };
    groups.push(group);
    return group;
  }
  for (const record of records.filter((record) => record.number === null)) {
    // Different known IDs (e.g. remakes) remain separate, even with the same title.
    const group =
      (record.sourceId
        ? candidates(record).find((group) => group.sourceId === record.sourceId)
        : undefined) || create(record);
    group.series.push(record.item);
  }
  const seasons = records
    .filter((record) => record.number !== null)
    .sort((a, b) => Number(!!b.sourceId) - Number(!!a.sourceId));
  for (const record of seasons) {
    const matches = candidates(record);
    let group = record.sourceId
      ? matches.find((group) => group.sourceId === record.sourceId)
      : matches.length === 1
        ? matches[0]
        : matches.find((group) => !group.sourceId && !group.series.length);
    if (!group && record.sourceId && matches.length === 1 && !matches[0].sourceId)
      group = matches[0];
    group ||= create(record);
    if (!group.sourceId && record.sourceId) group.sourceId = record.sourceId;
    group.seasons.push({ number: record.number, item: record.item });
  }
  for (const group of groups) {
    group.seasons.sort(
      (a, b) =>
        a.number - b.number ||
        a.item.year.localeCompare(b.item.year) ||
        a.item.id.localeCompare(b.item.id),
    );
    group.entries = [...group.series, ...group.seasons.map((season) => season.item)];
  }
  return groups;
}

/** @param {TVGroup} group @returns {Media[]} */
export function tvReleases(group) {
  return group.entries
    .filter((item) => item.nextReleaseTitle?.trim())
    .sort((a, b) => (a.nextReleaseDate || "9999").localeCompare(b.nextReleaseDate || "9999"));
}

/** @param {Media[]} items @param {{query?:string,status?:string,sort?:string}} options @returns {TVGroup[]} */
export function tvGuideRows(items, { query = "", status = "all", sort = "title" } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return groupTV(items)
    .filter(
      (group) =>
        (status === "all" ||
          (status === "upcoming" && tvReleases(group).length > 0) ||
          (status === "unrated"
            ? (group.series[0]?.score ?? null) === null
            : group.entries.some((item) => item.status === status))) &&
        (!needle ||
          group.entries.some((item) =>
            `${group.title} ${item.title} ${item.creator} ${item.notes} ${item.platform} ${item.genre} ${item.year} ${item.progress} ${item.nextReleaseTitle || ""} ${item.releaseNote || ""}`
              .toLocaleLowerCase()
              .includes(needle),
          )),
    )
    .sort((a, b) => {
      const byTitle = a.title.localeCompare(b.title) || a.key.localeCompare(b.key);
      if (sort === "title") return byTitle;
      const value = (group) =>
        sort === "score"
          ? (group.series[0]?.score ?? null)
          : tvReleases(group).find((item) => item.nextReleaseDate)?.nextReleaseDate || null;
      const av = value(a),
        bv = value(b);
      if (av === null && bv !== null) return 1;
      if (av !== null && bv === null) return -1;
      return (
        (sort === "score"
          ? Number(bv) - Number(av)
          : String(av ?? "").localeCompare(String(bv ?? ""))) || byTitle
      );
    });
}

/** @param {TVGroup} group */
export function nextSeasonNumber(group) {
  return Math.max(0, ...group.seasons.map((season) => season.number)) + 1;
}
