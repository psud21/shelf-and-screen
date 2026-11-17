import MediaNavigation from "./media-navigation";
import MediaThumbnail from "./media-thumbnail";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Tablet,
  Tv,
  Upload,
  X,
} from "lucide-react";
import { finishedOn, seriesLabel, statusNames, typeNames, type Media } from "../lib/media";
import { groupTV } from "../lib/tv-guide.mjs";
import { overviewRows } from "../lib/overview.mjs";
import "./overview.css";
import { ConnectButton, StorageLabel } from "./hub-context";
import { RowPlaceholders } from "./placeholders";

type Sort = "title" | "kind" | "score" | "completedAt";
type Props = {
  items: Media[];
  loading: boolean;
  error: string;
  demo: boolean;
  connected: boolean;
  onNavigate: (kind: string) => void;
  onEdit: (item?: Media) => void;
  onImport: () => void;
  onExport: () => void;
  onStart: () => void;
  onSample: () => void;
  onRetry: () => void;
};
const icons = { book: BookOpen, movie: Clapperboard, tv: Tv };
function dateLabel(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

export default function Overview(props: Props) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [status, setStatus] = useState("all"),
    [kindleOnly, setKindleOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("title"),
    [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(50);
  useEffect(() => setPage(0), [query, kind, status, kindleOnly, sort, ascending, pageSize]);
  const tvGroups = useMemo(() => groupTV(props.items), [props.items]);
  const groupsByEntry = useMemo(
    () =>
      new Map(tvGroups.flatMap((group) => group.entries.map((item) => [item.id, group] as const))),
    [tvGroups],
  );
  const seasonCount = (item: Media) => {
    const group = groupsByEntry.get(item.id);
    const count = group && group.series[0]?.id === item.id ? group.seasons.length : 0;
    return count ? `${count} ${count === 1 ? "season" : "seasons"}` : "";
  };
  const rows = useMemo(
    () => overviewRows(props.items, { query, kind, status, kindleOnly, sort, ascending }),
    [props.items, query, kind, status, kindleOnly, sort, ascending],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize)),
    currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const filtered = !!(query || kind !== "all" || status !== "all" || kindleOnly);
  function changeSort(next: Sort) {
    if (next === sort) setAscending(!ascending);
    else {
      setSort(next);
      setAscending(next === "title" || next === "kind");
    }
  }
  function heading(key: Sort, label: string, className = "") {
    const selected = sort === key;
    return (
      <th
        scope="col"
        className={className}
        aria-sort={selected ? (ascending ? "ascending" : "descending") : "none"}
      >
        <button onClick={() => changeSort(key)}>
          {label}
          {selected ? (
            ascending ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            )
          ) : (
            <ArrowUpDown size={12} />
          )}
        </button>
      </th>
    );
  }

  return (
    <div className="bookshelf-page overview-page">
      <MediaNavigation current="all" onNavigate={props.onNavigate} />
      <main className="ov-main">
        <div className="ov-heading">
          <div>
            <span className="collection-eyebrow">YOUR PERSONAL CATALOG</span>
            <h1>All titles</h1>
            <p>
              {props.loading ? (
                "Opening your collection…"
              ) : (
                <>
                  {props.items.length} entries <span>·</span>{" "}
                  {props.items.filter((item) => item.kind === "book").length} books <span>·</span>{" "}
                  {props.items.filter((item) => item.kind === "movie").length} movies <span>·</span>{" "}
                  {tvGroups.length} TV shows
                </>
              )}
            </p>
          </div>
          <div className="ov-actions">
            <button
              className="ov-secondary"
              disabled={props.loading || !!props.error}
              onClick={props.onImport}
            >
              <Upload size={15} />
              Import
            </button>
            <button
              className="ov-secondary"
              disabled={props.loading || !!props.error}
              onClick={props.onExport}
            >
              <Download size={15} />
              Export
            </button>
            <button
              className="bs-add"
              disabled={props.loading || !!props.error}
              onClick={() => props.onEdit()}
            >
              <Plus size={16} />
              Add title
            </button>
          </div>
        </div>
        {props.demo && !props.loading && (
          <div className="ov-sample">
            <span>Sample library · edits stay in this demo.</span>
            {props.connected ? (
              <button onClick={props.onStart}>
                Open my library <ChevronRight size={14} />
              </button>
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
        <div className="ov-toolbar">
          <label className="ov-search">
            <Search size={17} />
            <input
              aria-label="Search overview"
              value={query}
              placeholder="Search titles, creators, or notes…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Clear overview search" onClick={() => setQuery("")}>
                <X size={15} />
              </button>
            )}
          </label>
          <label>
            <span className="sr-only">Media type</span>
            <select
              aria-label="Filter media type"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All media</option>
              <option value="book">Books</option>
              <option value="movie">Movies</option>
              <option value="tv">TV shows</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select
              aria-label="Filter status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="ov-kindle">
            <input
              type="checkbox"
              checked={kindleOnly}
              onChange={(event) => setKindleOnly(event.target.checked)}
            />
            <Tablet size={14} />
            Kindle owned
          </label>
          {filtered && (
            <button
              className="ov-clear"
              onClick={() => {
                setQuery("");
                setKind("all");
                setStatus("all");
                setKindleOnly(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="ov-table-wrap">
          <table className="ov-table" aria-label="Media collection" aria-busy={props.loading}>
            <thead>
              <tr>
                {heading("title", "Title", "ov-title-col")}
                {heading("kind", "Type", "ov-type-col")}
                <th scope="col" className="ov-status-col">
                  Status
                </th>
                {heading("score", "My rating", "ov-rating-col")}
                <th scope="col" className="ov-progress-col">
                  Genre
                </th>
                {heading("completedAt", "Finished", "ov-date-col")}
                <th scope="col" className="ov-edit-col">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {props.loading ? (
                <tr>
                  <td colSpan={7}>
                    <RowPlaceholders variant="table" count={8} />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ov-empty">
                    <BookOpen size={26} />
                    <strong>
                      {filtered ? "No matching titles" : "Your collection starts here"}
                    </strong>
                    <span>
                      {filtered
                        ? "Try changing the search or filters."
                        : "Add a title or import a list you already have."}
                    </span>
                  </td>
                </tr>
              ) : (
                visible.map((item) => {
                  const Icon = icons[item.kind];
                  return (
                    <tr key={item.id}>
                      <td className="ov-title-col">
                        <button
                          className="ov-title"
                          data-media-id={item.id}
                          onClick={() => props.onEdit(item)}
                          aria-label={`Edit ${item.title}`}
                          title={item.title}
                        >
                          <span className="ov-artwork" aria-hidden="true">
                            <MediaThumbnail item={item} group={groupsByEntry.get(item.id)} />
                          </span>
                          <span className="ov-title-copy">
                            <span className="ov-title-name">
                              {item.title}
                              {item.year && <small className="ov-year">{item.year}</small>}
                              {item.notes && <MessageSquare size={13} aria-label="Has notes" />}
                            </span>
                            <span className="ov-creator">
                              {[
                                item.creator || typeNames[item.kind],
                                seriesLabel(item),
                                seasonCount(item),
                                item.owned && item.kind === "book" ? "Kindle" : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            <span className="ov-mobile-status">{statusNames[item.status]}</span>
                          </span>
                        </button>
                      </td>
                      <td className="ov-type-col">
                        <span className="ov-type">
                          <Icon size={14} />
                          {typeNames[item.kind]}
                        </span>
                      </td>
                      <td className="ov-status-col">
                        <span className={`ov-status ov-status-${item.status}`}>
                          <span />
                          {statusNames[item.status]}
                        </span>
                      </td>
                      <td className="ov-rating-col">
                        <button
                          className={`ov-score ${item.score === null ? "is-unrated" : ""}`}
                          aria-label={`Edit rating for ${item.title}`}
                          onClick={() => props.onEdit(item)}
                        >
                          {item.score === null ? (
                            "Unrated"
                          ) : (
                            <>
                              {item.score}
                              <small>/100</small>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="ov-progress-col">
                        <span>
                          {item.status === "progress" && item.progress
                            ? item.progress
                            : item.genre || "—"}
                        </span>
                      </td>
                      <td className="ov-date-col">{dateLabel(finishedOn(item))}</td>
                      <td className="ov-edit-col">
                        <button
                          className="bs-icon"
                          aria-label={`Edit details for ${item.title}`}
                          onClick={() => props.onEdit(item)}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="ov-pagination">
          <span aria-live="polite">
            {props.loading
              ? "Loading…"
              : rows.length
                ? `${currentPage * pageSize + 1}–${currentPage * pageSize + visible.length} of ${rows.length} titles${filtered ? ` · ${props.items.length} total` : ""}`
                : "0 titles"}
          </span>
          <div>
            <label>
              Rows{" "}
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Previous overview page"
              disabled={currentPage === 0 || props.loading}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              aria-label="Next overview page"
              disabled={currentPage + 1 >= pageCount || props.loading}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <footer className="ov-footer">
          <span>{props.demo ? "Sample collection" : <StorageLabel />}</span>
          {!props.demo && <button onClick={props.onSample}>Explore sample</button>}
        </footer>
      </main>
    </div>
  );
}
