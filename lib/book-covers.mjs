/** A link is only used as artwork when it is a secure web address. */
export function artworkUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : "";
}

/**
 * Where to look for a book's cover, best first: the link saved on the book, then
 * Open Library lookups by the edition's ISBNs.
 * @param {import('./media').Media} book
 * @returns {string[]}
 */
export function bookCoverCandidates(book) {
  const isbns = [book.isbn, book.metadata?.ISBN13, book.metadata?.ISBN]
    .map((value) => String(value || "").replace(/[^0-9X]/gi, ""))
    .filter((value) => /^(\d{13}|[\dX]{10})$/i.test(value));
  return [
    ...new Set(
      [
        artworkUrl(book.coverUrl),
        ...isbns.map((isbn) => `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`),
      ].filter(Boolean),
    ),
  ];
}
