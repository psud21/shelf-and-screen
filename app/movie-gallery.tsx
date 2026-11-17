import MediaNavigation from "./media-navigation";

import { useMemo, useState } from "react";
import {
  ArrowUp,
  Bookmark,
  Clapperboard,
  Download,
  LoaderCircle,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { blankMedia, statusNames, type Media } from "../lib/media";
import { movieRows, moviePosterFor } from "../lib/movie-gallery.mjs";
import "./movie-gallery.css";
import MovieDetail from "./movie-detail";
import { ConnectButton, StorageLabel } from "./hub-context";

type Props = {
  items: Media[];
  loading: boolean;
  error: string;
  demo: boolean;
  connected: boolean;
  onNavigate: (kind: string) => void;
  onEdit: (item: Media) => void;
  onSave: (item: Media) => Promise<Media>;
  onImport: () => void;
  onExport: () => void;
  onStart: () => void;
  onRetry: () => void;
};
const posterFor = (item: Media): string => moviePosterFor(item);
function PosterImage({ item }: { item: Media }) {
  const src = posterFor(item),
    [failed, setFailed] = useState("");
  return (
    <>
      {src && failed !== src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : (
        <span className="mg-fallback">
          <Clapperboard size={28} strokeWidth={1} />
          <strong>{item.title}</strong>
          <small>{item.year || "Movie"}</small>
        </span>
      )}
    </>
  );
}

export default function MovieGallery(props: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("score");
  const movies = useMemo(() => props.items.filter((item) => item.kind === "movie"), [props.items]);
  const rows = useMemo(
    () => movieRows(movies, { query, status, sort }) as Media[],
    [movies, query, status, sort],
  );
  const rated = movies.filter((item) => item.score !== null);
  const average = rated.length
    ? Math.round(rated.reduce((sum, item) => sum + item.score!, 0) / rated.length)
    : null;
  const filtered = !!(query || status !== "all");
  const selected = movies.find((item) => item.id === selectedId),
    selectedIndex = rows.findIndex((item) => item.id === selectedId);
  const addMovie = () => props.onEdit({ ...blankMedia(), kind: "movie" });
  return (
    <div className="bookshelf-page movie-gallery-page">
      <MediaNavigation current="movie" onNavigate={props.onNavigate} />
      <main className="mg-main">
        <div className="mg-heading">
          <div>
            <span className="mg-eyebrow">THE SCREEN COLLECTION</span>
            <h1>Movies</h1>
            <p>
              {props.loading ? (
                "Opening your collection…"
              ) : (
                <>
                  {movies.length} films <span>·</span>{" "}
                  {movies.filter((item) => item.status === "finished").length} watched{" "}
                  {average !== null && (
                    <>
                      <span>·</span> {average}/100 average
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="mg-actions">
            <button
              className="bs-icon"
              disabled={props.loading || !!props.error}
              onClick={props.onImport}
              aria-label="Import library"
              title="Import library"
            >
              <Upload size={17} />
            </button>
            <button
              className="bs-icon"
              disabled={props.loading || !!props.error}
              onClick={props.onExport}
              aria-label="Export library"
              title="Export library"
            >
              <Download size={17} />
            </button>
            <button className="bs-add" onClick={addMovie} disabled={props.loading || !!props.error}>
              <Plus size={16} />
              Add movie
            </button>
          </div>
        </div>
        {props.demo && !props.loading && (
          <div className="mg-sample">
            <span>Sample library · edits stay in this demo.</span>
            {props.connected ? (
              <button onClick={props.onStart}>Open my library</button>
            ) : (
              <ConnectButton />
            )}
          </div>
        )}
        {props.error && (
          <div className="bs-error" role="alert">
            {props.error}
            <button onClick={props.onRetry}>Try again</button>
          </div>
        )}
        <div className="mg-toolbar">
          <div className="mg-controls">
            <label className="mg-search">
              <Search size={17} />
              <input
                aria-label="Search movies"
                value={query}
                placeholder="Find a film, director, or note…"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label="Clear movie search" onClick={() => setQuery("")}>
                  <X size={16} />
                </button>
              )}
            </label>
            <label>
              <span className="sr-only">Movie status</span>
              <select
                aria-label="Filter movies"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All movies</option>
                <option value="planned">Up next</option>
                <option value="finished">Watched</option>
                <option value="progress">In progress</option>
                <option value="paused">On hold</option>
                <option value="dropped">Stopped</option>
                <option value="unrated">Unrated</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sort movies</span>
              <select
                aria-label="Sort movies"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="score">Highest rated</option>
                <option value="year">Newest releases</option>
                <option value="oldest">Oldest releases</option>
                <option value="title">Title A–Z</option>
                <option value="recent">Recently added</option>
              </select>
            </label>
          </div>
          <div className="mg-results">
            <span aria-live="polite">
              {props.loading
                ? "Loading…"
                : `${rows.length} ${rows.length === 1 ? "film" : "films"}${filtered ? ` of ${movies.length}` : " in your collection"}`}
            </span>
            {filtered ? (
              <button
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                Clear filters
              </button>
            ) : (
              <span>Choose a poster to step into the film</span>
            )}
          </div>
        </div>
        <section className="mg-grid" aria-label="Movie poster gallery" aria-busy={props.loading}>
          {props.loading ? (
            <div className="mg-empty">
              <LoaderCircle size={24} className="spin" />
              <p>Loading your movies…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="mg-empty">
              <Clapperboard size={30} strokeWidth={1} />
              <h2>{filtered ? "No matching films" : "Make room for movie night"}</h2>
              <p>
                {filtered
                  ? "Try another search or change the filters."
                  : "Add a movie or import your watchlist."}
              </p>
              {filtered ? (
                <button
                  className="bs-edit"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Show all movies
                </button>
              ) : (
                <button className="bs-add" onClick={addMovie}>
                  <Plus size={16} />
                  Add movie
                </button>
              )}
            </div>
          ) : (
            rows.map((item) => (
              <button
                className="mg-card"
                data-media-id={item.id}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                aria-haspopup="dialog"
                aria-label={`View ${item.title}`}
                title={item.title}
              >
                <span className="mg-poster">
                  <PosterImage item={item} />
                  {item.priority && (
                    <span className="mg-priority" title="Top of my list">
                      <Bookmark size={13} fill="currentColor" />
                    </span>
                  )}
                  <span className={`mg-rating ${item.score === null ? "mg-unrated" : ""}`}>
                    {item.score === null ? (
                      "Unrated"
                    ) : (
                      <>
                        {item.score}
                        <small>/100</small>
                      </>
                    )}
                  </span>
                  <span className="mg-edit-hint">View film & notes</span>
                </span>
                <span className="mg-title">{item.title}</span>
                <span className="mg-meta">
                  {item.year || "Year unknown"}
                  <span>·</span>
                  {item.status === "finished" ? "Watched" : statusNames[item.status]}
                </span>
              </button>
            ))
          )}
        </section>
        {!props.loading && rows.length > 0 && (
          <div className="mg-end">
            <span>
              You’re all caught up · {rows.length} {rows.length === 1 ? "film" : "films"}
            </span>
            <button onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}>
              Back to top <ArrowUp size={14} />
            </button>
          </div>
        )}
        <footer className="mg-footer">
          <span>{props.demo ? "Sample collection" : <StorageLabel />}</span>
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            Poster artwork from TMDB
          </a>
        </footer>
      </main>
      {selected && (
        <MovieDetail
          item={selected}
          poster={<PosterImage key={selected.id} item={selected} />}
          artwork={posterFor(selected)}
          demo={props.demo}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setSelectedId(null);
            props.onEdit(selected);
          }}
          onSave={props.onSave}
          onPrevious={
            selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined
          }
          onNext={
            selectedIndex >= 0 && selectedIndex + 1 < rows.length
              ? () => setSelectedId(rows[selectedIndex + 1].id)
              : undefined
          }
        />
      )}
    </div>
  );
}
