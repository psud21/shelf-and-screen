import { useState } from "react";
import { Clapperboard, Tv } from "lucide-react";
import type { Media } from "../lib/media";
import { moviePosterFor } from "../lib/movie-gallery.mjs";
import { tvPosterFor } from "../lib/tv-gallery.mjs";
import { groupTV, type TVGroup } from "../lib/tv-guide.mjs";
import BookCover from "./book-cover";

export default function MediaThumbnail({ item, group }: { item: Media; group?: TVGroup }) {
  const [failed, setFailed] = useState("");
  if (item.kind === "book") return <BookCover book={item} />;
  const src =
    item.kind === "movie" ? moviePosterFor(item) : tvPosterFor(group || groupTV([item])[0]);
  const Icon = item.kind === "tv" ? Tv : Clapperboard;
  return src && failed !== src ? (
    <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
  ) : (
    <span className="media-thumbnail-fallback">
      <Icon size={17} strokeWidth={1.4} />
    </span>
  );
}
