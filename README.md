# Shelf & Screen

A personal library for books, movies and TV, rated on one 0–100 scale.

It is a static web page with no server of its own. The page contains no library
data: your library is one JSON file that you keep, either in a private GitHub
repository or in your browser.

## What it does

- Bookshelves with spines sized by page count, plus movie and TV poster galleries.
- One overall score per show, optional season history, and an episode tracker.
- A queue of recommendations, with who recommended each title and why.
- A searchable, sortable overview of everything.
- Imports from Goodreads, Criticker, and any CSV or TSV with column matching.
- Exports for Goodreads and Criticker, a spreadsheet CSV, and a full JSON backup.

## Where the library is kept

Choose this from the storage button at the top right of the page.

**A GitHub repository (recommended).** The library is a single file, `library.json`
by default, in a private repository you own. Every device that has the access token
sees the same library, and each save is a commit, so the repository's history shows
every change and lets you restore an older version.

1. Create a private repository to hold the file.
2. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
   limited to **only that repository**, with the repository permission
   **Contents: Read and write**.
3. Open the storage button, enter the repository's owner and name, and paste the token.

The token is stored only in the browser you paste it into, and is sent only to
`api.github.com`. Treat it like a password: use a token restricted to the one
repository, and revoke it on GitHub if a device is lost.

If two devices save at the same time, the second save is re-applied on top of the
first instead of overwriting it. When GitHub cannot be reached, the page shows the
last copy it loaded and pauses changes until it reconnects.

**This browser only.** The library is stored in the browser's own storage. Nothing
leaves the device, other devices do not see it, and clearing the browser's site
data erases it. Download a full backup from Export regularly if you use this.

## The library file

`library.json` is a JSON list with one entry per title — the same shape as the
"full backup" download. Field definitions and limits are in
[`lib/media.ts`](lib/media.ts). Artwork is a link stored on each title (`coverUrl`);
books with an ISBN fall back to an Open Library cover lookup.

Images load directly from the sites that host them (Open Library, TMDB, or
wherever a link you paste points), so those sites can see which images your
browser requests.

## Service exports

Export → Goodreads or Criticker downloads a CSV to upload on that service's import
page. It is a one-way file transfer, not account sync, and it never changes the
library. Notes are only included when "include my notes" is ticked, because reviews
may be public on those services. Rules live in
[`lib/service-exports.ts`](lib/service-exports.ts) and are checked by
`scripts/check-service-exports.mjs`.

- **Goodreads:** the native library-export columns (`Book Id, Title, Author, ISBN,
ISBN13, My Rating, Date Read, Date Added, Bookshelves, Exclusive Shelf`, plus
  `My Review` with notes). Scores round to the nearest quarter star, from 1 to 5;
  unrated exports as 0. Up next / In progress / Finished map to to-read /
  currently-reading / read; On hold adds an `on-hold` shelf and Stopped a
  `did-not-finish` shelf. Goodreads needs an ISBN, so books without one are listed
  for attention and left out. Files hold at most 499 books, as Goodreads recommends
  fewer than 500. Importing can replace ratings already on Goodreads.
- **Criticker:** a header row, then IMDb ID, the exact 0–100 rating, an optional
  `YYYY-MM-DD` watched date and an optional minireview. Season IDs such as
  `tt8712204_s2` are kept. Unrated titles are left out, and titles with a missing or
  duplicate IMDb ID are listed for attention. Files stay within Criticker's
  5,000-line limit, counting multi-line reviews. Criticker skips ratings it already
  has, so changes to existing ratings must be made there.

## Development

Requires Node.js 22.18 or newer.

```
npm install
npm run dev        # local preview at http://localhost:5173
npm test           # every scripts/check-*.mjs
npm run typecheck
npm run build      # static site in dist/
npm run format     # Prettier
```

Layout:

- `app/` — the screens (React).
- `lib/` — the rules, with no screen code: validation and import/export
  (`media.ts`, `service-exports.ts`), library changes (`library.ts`), storage
  (`storage.ts`), and the sorting and grouping behind each screen.
- `scripts/` — the checks run by `npm test`.

## Publishing

Pushing to `main` runs the checks and publishes `dist/` to GitHub Pages through
[`.github/workflows/publish.yml`](.github/workflows/publish.yml). In the
repository's settings, set **Pages → Source** to **GitHub Actions** once.

The build uses relative paths, so the same `dist/` folder also works on any other
static host or under any address.
