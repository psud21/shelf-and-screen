import { mediaSchema, sameMedia, type Media } from "./media.ts";

// The rules for changing a library. They are pure functions over the whole list,
// so the same rules apply wherever the list is stored.

export const duplicateMessage =
  "This title is already in your library. Open the existing entry, or use a different title or edition.";

/** Add a new title or replace the one with the same id. Rejects a second copy of a title. */
export function saveItem(items: Media[], input: Media): Media[] {
  const checked = mediaSchema.safeParse(input);
  if (!checked.success)
    throw new Error(
      checked.error.issues.some((issue) => issue.path.includes("episodeTracker"))
        ? "Episode tracking is invalid. Check the season, episode count, and watched episodes."
        : "Some details are invalid. Check the title and the 0–100 score.",
    );
  const item = checked.data;
  if (items.some((existing) => existing.id !== item.id && sameMedia(existing, item)))
    throw new Error(duplicateMessage);
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => (existing.id === item.id ? item : existing))
    : [...items, item];
}

export function removeItem(items: Media[], id: string): Media[] {
  return items.filter((item) => item.id !== id);
}

/** Add only titles that are not already present. Existing entries are never changed. */
export function importItems(
  items: Media[],
  incoming: Media[],
): { items: Media[]; added: number; skipped: number } {
  const next = [...items];
  const ids = new Set(items.map((item) => item.id));
  let added = 0;
  for (const input of incoming) {
    const parsed = mediaSchema.parse(input);
    if (next.some((existing) => sameMedia(existing, parsed))) continue;
    const item = ids.has(parsed.id) ? { ...parsed, id: crypto.randomUUID() } : parsed;
    ids.add(item.id);
    next.push(item);
    added++;
  }
  return { items: next, added, skipped: incoming.length - added };
}

/**
 * Read a library file. The file is a JSON array of titles (the same shape as a
 * full backup); an object with an `items` array is accepted too. Any invalid
 * title stops the read, so a damaged file is never silently trimmed and saved back.
 */
export function parseLibrary(text: string): Media[] {
  if (!text.trim()) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The library file is not valid JSON.");
  }
  const list = Array.isArray(raw) ? raw : (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) throw new Error("The library file should be a JSON list of titles.");
  return list.map((entry, index) => {
    const parsed = mediaSchema.safeParse(entry);
    if (parsed.success) return parsed.data;
    const issue = parsed.error.issues[0];
    const name =
      typeof (entry as { title?: unknown } | null)?.title === "string"
        ? `“${(entry as { title: string }).title}”`
        : `entry ${index + 1}`;
    throw new Error(
      `The library file has a problem with ${name}: ${issue.path.join(".") || "entry"} — ${issue.message}`,
    );
  });
}

/** One title per block and a stable layout, so each save shows up as a small change. */
export function serializeLibrary(items: Media[]): string {
  return JSON.stringify(items, null, 2) + "\n";
}
