import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { BookOpen, CalendarDays, Pencil, Tablet } from "lucide-react";
import { statusNames, type Media } from "../lib/media";
import { getPageCount, spineAppearance } from "../lib/bookshelf.mjs";
import StoryDialog from "./story-dialog";
import "./book-reveal.css";

export type BookOrigin = { x: number; y: number; width: number; height: number };
export default function BookReveal({
  book,
  cover,
  origin,
  onClose,
  onEdit,
}: {
  book: Media;
  cover: ReactNode;
  origin: BookOrigin;
  onClose: () => void;
  onEdit: () => void;
}) {
  const object = useRef<HTMLDivElement>(null),
    art = spineAppearance(book),
    pages = getPageCount(book);
  useEffect(() => {
    let animation: Animation | undefined;
    const frame = requestAnimationFrame(() => {
      const element = object.current;
      if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const rect = element.getBoundingClientRect(),
        dx = origin.x + origin.width / 2 - (rect.left + rect.width / 2),
        dy = origin.y + origin.height / 2 - (rect.top + rect.height / 2);
      const scale = Math.max(0.55, Math.min(1, origin.height / 270));
      animation = element.animate(
        [
          { transform: `translate3d(${dx}px,${dy}px,0) rotateY(-84deg) scale(${scale})` },
          { transform: "translate3d(0,-7px,25px) rotateY(-13deg) scale(1.02)", offset: 0.78 },
          { transform: "rotateY(-9deg)" },
        ],
        { duration: 650, easing: "cubic-bezier(.18,.75,.2,1)", fill: "both" },
      );
    });
    return () => {
      cancelAnimationFrame(frame);
      animation?.cancel();
    };
  }, [book.id, origin]);
  return (
    <StoryDialog
      label={`${book.title} · book details`}
      className="book-reveal-dialog"
      onClose={onClose}
    >
      <div className="book-reveal-layout">
        <div
          className="book-reveal-stage"
          style={{ "--book-color": art.color, "--book-ink": art.ink } as CSSProperties}
        >
          <span className="book-reveal-halo" />
          <div className="book-object" ref={object}>
            <div className="book-jacket">{cover}</div>
            <div className="book-side">
              <span>{book.title}</span>
            </div>
            <div className="book-page-edge" />
          </div>
          <span className="book-object-shadow" />
          <span className="book-reveal-caption">
            <BookOpen size={13} />
            FROM YOUR BOOKSHELF
          </span>
        </div>
        <div className="book-reveal-copy">
          <span className="story-kicker">A STORY ON YOUR SHELF</span>
          <h2>{book.title}</h2>
          <p className="story-meta">
            {book.creator || "Author not added"}
            {pages ? ` · ${pages.toLocaleString()} pages` : ""}
          </p>
          <div className="book-reveal-score">
            <span className={`story-score ${book.score === null ? "is-unrated" : ""}`}>
              {book.score === null ? (
                "Not rated yet"
              ) : (
                <>
                  {book.score}
                  <small>/100</small>
                </>
              )}
            </span>
            <span className="story-status">{statusNames[book.status]}</span>
            {book.owned && (
              <span className="story-status">
                <Tablet size={11} />
                Kindle
              </span>
            )}
          </div>
          {book.progress && <p className="book-reveal-progress">{book.progress}</p>}
          <div className="book-reveal-note">
            <div className="story-note-label">YOUR NOTES</div>
            <p className="story-notes">
              {book.notes ||
                "What stayed with you? Add a note, a favorite passage, or a reason to read this next."}
            </p>
          </div>
          {book.nextReleaseTitle && (
            <p className="book-reveal-release">
              <CalendarDays size={15} />
              <span>
                {book.nextReleaseTitle}
                <small>{book.nextReleaseDate || "Date TBA"}</small>
              </span>
            </p>
          )}
          <button className="story-action is-primary" onClick={onEdit}>
            <Pencil size={14} />
            Update rating & notes
          </button>
        </div>
      </div>
    </StoryDialog>
  );
}
