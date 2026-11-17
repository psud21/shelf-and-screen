const pad = (number) => String(number).padStart(2, "0");

/** A calendar date in the viewer's local timezone, for dates they finish a title. */
export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Read a date written in a file ("2026/10/17", "14 Sep 2024", an ISO timestamp)
 * as the calendar day it names. The day never shifts with the reader's timezone.
 * @param {string} value
 * @returns {string} YYYY-MM-DD, or "" when the text is not a real date
 */
export function calendarDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const numeric = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[T\s])/.exec(text);
  if (numeric) {
    const [year, month, day] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    const real =
      check.getUTCFullYear() === year &&
      check.getUTCMonth() === month - 1 &&
      check.getUTCDate() === day;
    return real ? `${numeric[1]}-${pad(month)}-${pad(day)}` : "";
  }
  // Written-out dates have no timezone, so the engine reads them as local time.
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : localToday(parsed);
}
