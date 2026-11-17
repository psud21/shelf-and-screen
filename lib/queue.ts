import { mediaSchema, sameMedia, statusNames, type Media } from "./media.ts";

export type QueueOptions = {
  query?: string;
  kind?: string;
  recommendedOnly?: boolean;
  sort?: string;
};
const searchText = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export function queueItems(
  items: Media[],
  { query = "", kind = "all", recommendedOnly = false, sort = "priority" }: QueueOptions = {},
) {
  const search = searchText(query.trim());
  return items
    .filter(
      (item) =>
        item.status === "planned" &&
        (kind === "all" || item.kind === kind) &&
        (!recommendedOnly || !!(item.recommendedBy?.trim() || item.recommendationNote?.trim())) &&
        (!search ||
          searchText(
            [item.title, item.creator, item.recommendedBy, item.recommendationNote, item.platform]
              .filter(Boolean)
              .join(" "),
          ).includes(search)),
    )
    .sort((a, b) => {
      if (sort === "priority" && a.priority !== b.priority)
        return Number(b.priority) - Number(a.priority);
      if (sort === "title") return a.title.localeCompare(b.title);
      return b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title);
    });
}

// Recommending an existing queued title adds context to that same entry. Library
// identifiers, ownership, ratings and reading history must survive this shortcut.
export function prepareRecommendation(items: Media[], draft: Media) {
  if (!draft.title.trim()) throw new Error("Add a title before saving this recommendation.");
  const incoming = mediaSchema.parse({
    ...draft,
    title: draft.title.trim(),
    creator: draft.creator.trim(),
    recommendedBy: draft.recommendedBy?.trim() || "",
    recommendationNote: draft.recommendationNote?.trim() || "",
    status: "planned",
    score: null,
  });
  const existing = items.find((item) => sameMedia(item, incoming));
  if (!existing) return incoming;
  if (existing.status !== "planned")
    throw new Error(
      `“${existing.title}” is already marked ${statusNames[existing.status]}. Open it in your library to change its status.`,
    );
  const combine = (oldText: string | undefined, newText: string | undefined, separator: string) => {
    if (!newText) return oldText || "";
    if (!oldText) return newText;
    return oldText
      .split(separator)
      .some((part) => part.trim().toLowerCase() === newText.toLowerCase())
      ? oldText
      : oldText + separator + newText;
  };
  const merged = {
    ...existing,
    recommendedBy: combine(existing.recommendedBy, incoming.recommendedBy, "; "),
    recommendationNote: combine(existing.recommendationNote, incoming.recommendationNote, "\n\n"),
    priority: existing.priority || incoming.priority,
  };
  const parsed = mediaSchema.safeParse(merged);
  if (!parsed.success)
    throw new Error(
      "This recommendation is too long to combine with the existing one. Open the title to edit its recommendation.",
    );
  return parsed.data;
}
