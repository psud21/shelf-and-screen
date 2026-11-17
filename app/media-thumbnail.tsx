import { useState } from "react";
import type { Media } from "../lib/media";
import { moviePosterFor } from "../lib/movie-gallery.mjs";
import { tvPosterFor } from "../lib/tv-gallery.mjs";
import { groupTV, type TVGroup } from "../lib/tv-guide.mjs";
import BookCover from "./book-cover";
import GeneratedCover from "./generated-cover";

export default function MediaThumbnail({ item, group }: { item: Media; group?: TVGroup }) {
  const [failed, setFailed] = useState("");
  if (item.kind === "book") return <BookCover book={item} />;
  const src =
    item.kind === "movie" ? moviePosterFor(item) : tvPosterFor(group || groupTV([item])[0]);
  return src && failed !== src ? (
    <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
  ) : (
    <GeneratedCover item={item} />
  );
}
