import MediaNavigation from "./media-navigation";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Tablet,
  Upload,
  X,
} from "lucide-react";
import { type Media, seriesLabel, statusNames, yearLabel } from "../lib/media";
import {
  getPageCount,
  packShelves,
  ratingColors,
  sortBooks,
  spineAppearance,
  spineTitle,
} from "../lib/bookshelf.mjs";
import "./bookshelf.css";
import BookCover from "./book-cover";
import BookReveal, { type BookOrigin } from "./book-reveal";
import { ConnectButton, StorageLabel } from "./hub-context";

type Shelf = "all" | "planned" | "progress" | "finished" | "paused" | "kindle";
type Sort = "date" | "score" | "pages" | "genre";
type Props = {
  books: Media[];
  query: string;
  shelf: Shelf;
  loading: boolean;
  error: string;
  demo: boolean;
  connected: boolean;
  onQuery: (query: string) => void;
  onShelf: (shelf: Shelf) => void;
  onNavigate: (kind: string) => void;
  onEdit: (book?: Media) => void;
  onImport: () => void;
  onExport: () => void;
  onStart: () => void;
  onSample: () => void;
  onRetry: () => void;
};

export default function Bookshelf(props: Props) {
  const [sort, setSort] = useState<Sort>("date"),
    [ascending, setAscending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [previewId, setPreviewId] = useState<string | null>(null);
  const [page, setPage] = useState(0),
    [width, setWidth] = useState(1120);
  const [titlePosition, setTitlePosition] = useState({
    left: 16,
    top: 0,
    width: 320,
    below: false,
  });
  const stage = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState<{ id: string; origin: BookOrigin } | null>(null);
  const openedBook = reveal ? props.books.find((book) => book.id === reveal.id) : undefined;
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPage(0);
    setPreviewId(null);
  }, [props.query, props.shelf, sort, ascending, width]);

  function preview(
    book: Media,
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect(),
      tooltipWidth = Math.min(420, window.innerWidth - 32),
      below = rect.top < 160;
    setTitlePosition({
      left: Math.max(
        16,
        Math.min(
          window.innerWidth - tooltipWidth - 16,
          rect.left + rect.width / 2 - tooltipWidth / 2,
        ),
      ),
      top: below ? rect.bottom + 10 : rect.top - 10,
      width: tooltipWidth,
      below,
    });
    setPreviewId(book.id);
  }
  useEffect(() => {
    const hide = () => setPreviewId(null);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, []);

  const books = useMemo(
    () =>
      sortBooks(
        props.books.filter((book) => {
          const shelfMatch =
            props.shelf === "all" ||
            (props.shelf === "kindle" && book.owned) ||
            (props.shelf === "paused" && (book.status === "paused" || book.status === "dropped")) ||
            props.shelf === book.status;
          return (
            shelfMatch &&
            `${book.title} ${book.creator} ${book.notes} ${book.genre}`
              .toLowerCase()
              .includes(props.query.toLowerCase())
          );
        }),
        sort,
        ascending,
      ),
    [props.books, props.shelf, props.query, sort, ascending],
  );
  const rows = useMemo(() => packShelves(books, width), [books, width]);
  const pages = Math.max(1, Math.ceil(rows.length / 2));
  const currentPage = Math.min(page, pages - 1);
  const visibleRows = rows.slice(currentPage * 2, currentPage * 2 + 2);
  const visibleBooks = visibleRows.flat();
  const selected = visibleBooks.find((book) => book.id === selectedId) || visibleBooks[0];
  const active = visibleBooks.find((book) => book.id === previewId) || selected;
  const finished = props.books.filter((book) => book.status === "finished").length;
  const progress = props.books.filter((book) => book.status === "progress").length;
  const rated = props.books.filter((book) => book.score !== null);
  const average = rated.length
    ? Math.round(rated.reduce((sum, book) => sum + book.score!, 0) / rated.length)
    : null;
  const visibleStart = rows.slice(0, currentPage * 2).reduce((sum, row) => sum + row.length, 0) + 1;
  const activePages = active ? getPageCount(active) : null;
  const completed =
    active?.completedAt && /^\d{4}-\d{2}-\d{2}$/.test(active.completedAt)
      ? new Date(active.completedAt + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
      : "";

  return (
    <div className="bookshelf-page">
      <MediaNavigation current="book" onNavigate={props.onNavigate} />
      <main className="bs-main">
        {props.error && (
          <div className="bs-error" role="alert">
            {props.error}
            <button onClick={props.onRetry}>Try again</button>
          </div>
        )}
        <div className="bs-heading">
          <div>
            <span className="collection-eyebrow">THE READING COLLECTION</span>
            <h1>Books</h1>
            <p>
              {finished} finished <span>·</span> {progress} in progress <span>·</span> average{" "}
              {average === null ? "unrated" : `${average}/100`}
            </p>
          </div>
          <div className="bs-actions">
            <button
              className="bs-icon"
              aria-label="Import your library"
              disabled={props.loading || !!props.error}
              onClick={props.onImport}
            >
              <Upload size={18} />
            </button>
            <button
              className="bs-icon"
              aria-label="Export your library"
              disabled={props.loading || !!props.error}
              onClick={props.onExport}
            >
              <Download size={18} />
            </button>
            <button
              className="bs-add"
              disabled={props.loading || !!props.error}
              onClick={() => props.onEdit()}
            >
              <Plus size={16} />
              Add book
            </button>
          </div>
        </div>
        <div className="bs-toolbar">
          <div className="bs-sorts" role="group" aria-label="Sort books">
            {(
              [
                { id: "date", label: "Date read" },
                { id: "score", label: "Rating" },
                { id: "pages", label: "Length" },
                { id: "genre", label: "Genre" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                aria-pressed={sort === option.id}
                onClick={() => {
                  if (sort === option.id) setAscending(!ascending);
                  else {
                    setSort(option.id);
                    setAscending(option.id === "genre");
                  }
                }}
              >
                {option.label}
                {sort === option.id &&
                  (ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </button>
            ))}
          </div>
          <div className="bs-find">
            <label className="bs-search">
              <Search size={16} />
              <input
                aria-label="Search books"
                value={props.query}
                placeholder="Find a book…"
                onChange={(event) => props.onQuery(event.target.value)}
              />
              {props.query && (
                <button aria-label="Clear book search" onClick={() => props.onQuery("")}>
                  <X size={14} />
                </button>
              )}
            </label>
            <label className="bs-filter">
              <span className="sr-only">Book shelf</span>
              <select
                aria-label="Book shelf"
                value={props.shelf}
                onChange={(event) => props.onShelf(event.target.value as Shelf)}
              >
                <option value="all">All books</option>
                <option value="planned">Want to read</option>
                <option value="progress">In progress</option>
                <option value="finished">Finished</option>
                <option value="kindle">Owned on Kindle</option>
                <option value="paused">On hold & stopped</option>
              </select>
            </label>
          </div>
        </div>
        <div className="bs-stage" ref={stage} aria-busy={props.loading}>
          {props.loading ? (
            <div className="bs-empty">
              <LoaderCircle size={24} className="spin" />
              <p>Making room on your shelves…</p>
            </div>
          ) : !books.length ? (
            <div className="bs-empty">
              <BookOpen size={35} />
              <h2>{props.query ? "No books found" : "A shelf waiting for your next story"}</h2>
              <p>
                {props.query
                  ? "Try another title, author, or note."
                  : "Add a book or import your Goodreads collection."}
              </p>
              <button
                className="bs-add"
                disabled={props.loading || !!props.error}
                onClick={props.onImport}
              >
                <Upload size={16} />
                Import books
              </button>
            </div>
          ) : (
            visibleRows.map((row, index) => (
              <div
                className="bs-rail"
                key={index}
                aria-label={`Bookshelf ${currentPage * 2 + index + 1}`}
                onMouseLeave={() => setPreviewId(null)}
              >
                {row.map((book) => {
                  const art = spineAppearance(book),
                    reading = book.status === "progress",
                    unrated = book.score === null;
                  const style = {
                    "--bs-height": `${art.height}px`,
                    "--bs-width": `${art.width}px`,
                    "--bs-color": art.color,
                    "--bs-spine-ink": art.ink,
                    "--bs-progress": `${Math.round((art.fraction ?? 0) * 100)}%`,
                  } as CSSProperties;
                  return (
                    <button
                      key={book.id}
                      data-media-id={book.id}
                      style={style}
                      className={`bs-spine ${reading ? "is-reading" : ""} ${unrated ? "is-unrated" : ""} ${active?.id === book.id ? "is-active" : ""}`}
                      aria-label={`${book.title}, ${book.score === null ? "unrated" : `${book.score} out of 100`}, ${statusNames[book.status]}`}
                      aria-pressed={selected?.id === book.id}
                      aria-describedby={previewId === book.id ? "bs-title-tooltip" : undefined}
                      onMouseEnter={(event) => preview(book, event)}
                      onFocus={(event) => preview(book, event)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setPreviewId(null);
                      }}
                      onBlur={() => setPreviewId(null)}
                      onClick={(event) => {
                        setSelectedId(book.id);
                        setPreviewId(null);
                        const rect = event.currentTarget.getBoundingClientRect();
                        setReveal({
                          id: book.id,
                          origin: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        });
                      }}
                      aria-haspopup="dialog"
                    >
                      <span className="bs-spine-fill" />
                      <span className="bs-spine-title">{spineTitle(book.title)}</span>
                      {book.owned && (
                        <Tablet
                          className="bs-spine-kindle"
                          size={11}
                          aria-label="Owned on Kindle"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="bs-shelf-meta">
          <div className="bs-legend">
            <span>Rated 0</span>
            <span className="bs-swatches" aria-hidden="true">
              {ratingColors.map((color) => (
                <span style={{ background: color }} key={color} />
              ))}
            </span>
            <span>100</span>
            <span className="bs-legend-unrated" />
            Unrated
          </div>
          <p>
            Height = pages <span>·</span> outlined and filled = in progress <span>·</span> unknown
            length = standard height
          </p>
        </div>
        {books.length > 0 && (
          <nav className="bs-pagination" aria-label="Bookshelf pages">
            <span>
              {visibleStart}–{visibleStart + visibleBooks.length - 1} of {books.length} books
            </span>
            <div>
              <button
                aria-label="Previous shelves"
                disabled={currentPage === 0}
                onClick={() => {
                  setPage(currentPage - 1);
                  setPreviewId(null);
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {currentPage + 1} of {pages}
              </span>
              <button
                aria-label="Next shelves"
                disabled={currentPage + 1 >= pages}
                onClick={() => {
                  setPage(currentPage + 1);
                  setPreviewId(null);
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </nav>
        )}
        {active && !props.loading && (
          <section className="bs-detail" aria-label="Selected book" aria-live="polite">
            <BookCover key={active.id} book={active} />
            <div className="bs-detail-copy">
              <div className="bs-detail-title">
                <h2>{active.title}</h2>
                {active.owned && (
                  <span>
                    <Tablet size={13} />
                    Kindle
                  </span>
                )}
              </div>
              {active.series && <p className="story-series">{seriesLabel(active)}</p>}
              <p>
                {[
                  active.creator || "Author not added",
                  yearLabel(active.year),
                  activePages ? `${activePages.toLocaleString()} pages` : "",
                  active.status === "finished" && completed
                    ? `Finished ${completed}`
                    : statusNames[active.status],
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="bs-detail-rating">
                {active.score !== null ? (
                  <>
                    <strong>{active.score}</strong>
                    <span>/100</span>
                  </>
                ) : (
                  <span>Not rated yet</span>
                )}
                {active.status === "progress" && active.progress && (
                  <span className="bs-detail-progress">{active.progress}</span>
                )}
              </div>
              {active.genre && <span className="bs-detail-genre">{active.genre}</span>}
              {active.notes ? (
                <p className="bs-book-notes">{active.notes}</p>
              ) : (
                active.summary && <p className="bs-book-notes bs-book-summary">{active.summary}</p>
              )}
              {active.nextReleaseTitle && (
                <p className="bs-detail-release">
                  <CalendarDays size={14} />
                  {active.nextReleaseTitle} <span>·</span> {active.nextReleaseDate || "Date TBA"}
                </p>
              )}
              <button className="bs-edit" onClick={() => props.onEdit(active)}>
                <Pencil size={14} />
                Update book
              </button>
            </div>
          </section>
        )}
        <div className="bs-account-line">
          {props.loading ? (
            <span>
              <LoaderCircle size={14} className="spin" />
              Opening your collection…
            </span>
          ) : props.demo ? (
            <>
              <span>Sample library · changes stay in this demo</span>
              {props.connected ? (
                <button onClick={props.onStart}>
                  Open my library <ChevronRight size={14} />
                </button>
              ) : (
                <ConnectButton />
              )}
            </>
          ) : (
            <>
              <span>
                <span className="bs-private-dot" />
                <StorageLabel />
              </span>
              <button onClick={props.onSample}>Explore sample</button>
            </>
          )}
        </div>
        <footer className="bs-footer">
          <span>Select a spine to pull out its cover, rating, and notes.</span>
          <span className="bs-cover-credits">
            Covers:{" "}
            <a href="https://openlibrary.org/dev/docs/api/covers" target="_blank" rel="noreferrer">
              Open Library
            </a>
          </span>
        </footer>
      </main>
      {previewId && active && !reveal && (
        <div
          id="bs-title-tooltip"
          role="tooltip"
          className={`bs-title-tooltip ${titlePosition.below ? "is-below" : ""}`}
          style={{ left: titlePosition.left, top: titlePosition.top, width: titlePosition.width }}
        >
          <strong>{active.title}</strong>
          <span>{active.creator || "Author not added"}</span>
        </div>
      )}
      {openedBook && reveal && (
        <BookReveal
          book={openedBook}
          cover={<BookCover key={openedBook.id} book={openedBook} />}
          origin={reveal.origin}
          onClose={() => setReveal(null)}
          onEdit={() => {
            setReveal(null);
            props.onEdit(openedBook);
          }}
        />
      )}
    </div>
  );
}
