import type { Media } from "../lib/media";
import { splitSeries } from "../lib/media";
import { clothFor } from "../lib/cloth.mjs";
import "./generated-cover.css";

/**
 * A typeset cover for a title with no artwork: cloth colour, a gilt frame, the
 * title in the serif and the author or year beneath. It scales from a full
 * cover down to a thumbnail, where only the first letter remains.
 */
export default function GeneratedCover({
  item,
}: {
  item: Pick<Media, "title" | "creator" | "kind" | "year">;
}) {
  const title = item.kind === "book" ? splitSeries(item.title).title : item.title;
  const byline = item.kind === "book" ? item.creator : item.year;
  return (
    <span
      className={`generated-cover is-${item.kind}`}
      style={{ background: `var(--cloth-${clothFor(item.title)})` }}
      aria-hidden="true"
    >
      <span className="generated-cover-frame">
        <span className="generated-cover-kind">
          {item.kind === "book" ? "" : item.kind === "tv" ? "Series" : "Film"}
        </span>
        <span className="generated-cover-title">{title}</span>
        <span className="generated-cover-initial">{title.trim().charAt(0)}</span>
        {byline && <span className="generated-cover-byline">{byline}</span>}
      </span>
    </span>
  );
}
