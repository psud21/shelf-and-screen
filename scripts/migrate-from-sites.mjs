// One-off migration from the original hosted version of Shelf & Screen.
//
//   node scripts/migrate-from-sites.mjs <full-backup.json> <old Website folder> <output library.json>
//
// The old app shipped its artwork as built-in catalogs matched to titles at display
// time. This moves each matched image link onto the title itself, drops the unused
// copy of every original import row, and writes a library file the app can open.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mediaSchema } from "../lib/media.ts";
import { parseLibrary, serializeLibrary } from "../lib/library.ts";

const [backupPath, websitePath, outputPath] = process.argv.slice(2);
if (!backupPath || !websitePath || !outputPath) {
  console.error(
    "Usage: node scripts/migrate-from-sites.mjs <full-backup.json> <old Website folder> <output library.json>",
  );
  process.exit(64);
}
const website = resolve(websitePath);
const old = (file) => import(pathToFileURL(join(website, "lib", file)).href);
const catalog = (file) => JSON.parse(readFileSync(join(website, "lib", file), "utf8"));
const secure = (url) => (typeof url === "string" && /^https:\/\//i.test(url) ? url : "");

const [{ bookCoverCandidates }, { moviePosterFor }, { tvPosterFor }, { groupTV }] =
  await Promise.all([
    old("book-covers.mjs"),
    old("movie-gallery.mjs"),
    old("tv-gallery.mjs"),
    old("tv-guide.mjs"),
  ]);
const covers = catalog("book-covers.json");
const moviePosters = catalog("movie-posters.json");
const tvPosters = catalog("tv-posters.json");
// Built-in artwork was stored as a local file path; find the web address it came from.
const remote = new Map(
  [covers, moviePosters, tvPosters].flatMap((entries) =>
    Object.values(entries).map((entry) => [entry.src, secure(entry.imageUrl)]),
  ),
);

const before = readFileSync(backupPath, "utf8");
const items = parseLibrary(before);
const artwork = new Map();
for (const item of items) {
  if (secure(item.coverUrl)) continue;
  const local =
    item.kind === "book"
      ? bookCoverCandidates(item, covers).find((candidate) => candidate.startsWith("/book-covers/"))
      : item.kind === "movie"
        ? moviePosterFor(item, moviePosters)
        : "";
  if (local && remote.get(local)) artwork.set(item.id, remote.get(local));
}
for (const group of groupTV(items)) {
  if (group.entries.some((item) => secure(item.coverUrl))) continue;
  const local = tvPosterFor(group, tvPosters);
  // The show's own entry carries the poster; a show with only seasons uses the first one.
  if (local && remote.get(local)) artwork.set(group.entries[0].id, remote.get(local));
}

const kept = new Set(["isbn", "isbn13", "book id", "imdb id", "number of pages"]);
const migrated = items.map((item) => {
  const metadata = Object.fromEntries(
    Object.entries(item.metadata || {})
      .map(([name, value]) => [name.trim(), String(value).trim()])
      .filter(([name, value]) => value && kept.has(name.toLowerCase())),
  );
  const next = { ...item, coverUrl: artwork.get(item.id) || item.coverUrl || "" };
  if (Object.keys(metadata).length) next.metadata = metadata;
  else delete next.metadata;
  return mediaSchema.parse(next);
});

const output = serializeLibrary(migrated);
writeFileSync(outputPath, output);
const count = (kind, list = migrated) => list.filter((item) => item.kind === kind).length;
const withArt = migrated.filter((item) => secure(item.coverUrl));
console.log(
  `${migrated.length} titles: ${count("book")} books, ${count("movie")} movies, ${count("tv")} TV`,
);
console.log(
  `Artwork links: ${count("book", withArt)} books, ${count("movie", withArt)} movies, ${count("tv", withArt)} TV entries`,
);
console.log(
  `File size: ${Math.round(Buffer.byteLength(before) / 1024)} KB before, ${Math.round(Buffer.byteLength(output) / 1024)} KB after`,
);
