/**
 * The one identity key used to compare titles and names: case, spacing and
 * punctuation are ignored, and letters from any script are kept.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Shared ordering for sortable columns: unknown values always sort last, numbers
 * compare numerically and everything else alphabetically.
 * @param {string | number | null | undefined} a
 * @param {string | number | null | undefined} b
 * @param {boolean} [ascending]
 * @returns {number}
 */
export function compareValues(a, b, ascending = true) {
  const av = a === undefined || a === "" ? null : a;
  const bv = b === undefined || b === "" ? null : b;
  if (av === null && bv !== null) return 1;
  if (av !== null && bv === null) return -1;
  const result =
    typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av ?? "").localeCompare(String(bv ?? ""));
  return ascending ? result : -result;
}
