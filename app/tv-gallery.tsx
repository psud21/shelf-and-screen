import MediaNavigation from "./media-navigation";

import { useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  ChevronDown,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Tv,
  Upload,
  X,
} from "lucide-react";
import { blankMedia, statusNames, type Media } from "../lib/media";
import { groupTV, tvReleases, type TVGroup } from "../lib/tv-guide.mjs";
import { tvGalleryRows, tvGroupYear, tvPosterFor } from "../lib/tv-gallery.mjs";
import MovieDetail from "./movie-detail";
import EpisodeTracker from "./episode-tracker";
import "./movie-gallery.css";
import "./tv-gallery.css";
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

function showItem(group: TVGroup): Media {
  if (group.series[0]) return group.series[0];
  const latest = group.seasons.at(-1)?.item;
  return {
    ...blankMedia(),
    kind: "tv",
    title: group.title,
    year: tvGroupYear(group),
    sourceId: group.sourceId || undefined,
    status: latest?.status || "planned",
    platform: latest?.platform || "",
  };
}
function PosterImage({ group }: { group: TVGroup }) {
  const src = tvPosterFor(group),
    [failed, setFailed] = useState("");
  return src && failed !== src ? (
    <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
  ) : (
    <span className="mg-fallback">
      <Tv size={28} strokeWidth={1} />
      <strong>{group.title}</strong>
      <small>{tvGroupYear(group) || "TV show"}</small>
    </span>
  );
}
function dateLabel(date?: string) {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
}
function ShowExtras({
  group,
  item,
  disabled,
  demo,
  onSave,
  onSelect,
  onEdit,
  onBusyChange,
}: {
  group: TVGroup;
  item: Media;
  disabled: boolean;
  demo: boolean;
  onSave: Props["onSave"];
  onSelect: (id: string) => void;
  onEdit: (item: Media) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  return (
    <div className="tvg-extras">
      <EpisodeTracker
        group={group}
        item={item}
        disabled={disabled}
        demo={demo}
        onSave={onSave}
        onSelect={onSelect}
        onBusyChange={onBusyChange}
      />
      {tvReleases(group).map((release) => (
        <section className="tvg-release" key={release.id} aria-label="Next release">
          <CalendarDays size={16} />
          <div>
            <span className="story-note-label">NEXT RELEASE</span>
            <h3>{release.nextReleaseTitle}</h3>
            <p>
              {dateLabel(release.nextReleaseDate) || "Date TBA"}
              {release.nextReleaseDate &&
                ` · ${release.releaseConfidence === "confirmed" ? "Confirmed" : "Tentative"}`}
            </p>
            {release.releaseNote && <p>{release.releaseNote}</p>}
            <div className="tvg-provenance">
              {release.releaseCheckedAt && (
                <span>Last checked {dateLabel(release.releaseCheckedAt)}</span>
              )}
              {release.releaseSource && /^https?:\/\//i.test(release.releaseSource) && (
                <a href={release.releaseSource} target="_blank" rel="noreferrer">
                  Source <ArrowUpRight size={11} />
                </a>
              )}
            </div>
          </div>
          <button className="story-action" disabled={disabled} onClick={() => onEdit(release)}>
            Update release
          </button>
        </section>
      ))}
      {group.seasons.length > 0 && (
        <details className="tvg-history">
          <summary>
            Season history <span>Optional</span>
            <ChevronDown size={13} />
          </summary>
          <p>Season entries and any ratings you previously saved.</p>
          <div>
            {group.seasons.map((season) => (
              <div className="tvg-history-entry" key={season.item.id}>
                <button
                  disabled={disabled}
                  aria-label={`View ${season.item.title}`}
                  aria-pressed={item.id === season.item.id}
                  onClick={() => onSelect(season.item.id)}
                >
                  Season {season.number}
                </button>
                {season.item.score !== null && (
                  <span>
                    {season.item.score}
                    <small>/100</small>
                  </span>
                )}
                <button
                  className="tvg-history-edit"
                  disabled={disabled}
                  aria-label={`Edit ${season.item.title}`}
                  onClick={() => onEdit(season.item)}
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
          </div>
          {group.seasons.some((season) => season.item.id === item.id) && item.notes && (
            <p className="tvg-season-notes">{item.notes}</p>
          )}
        </details>
      )}
      {!tvReleases(group).length && (
        <button
          className="tvg-release-add"
          disabled={disabled}
          onClick={() => onEdit(group.series[0] || item)}
        >
          <CalendarDays size={13} />
          Track next release
        </button>
      )}
      {group.series.length > 1 && (
        <details className="tvg-history">
          <summary>
            Other saved entries
            <ChevronDown size={13} />
          </summary>
          {group.series.slice(1).map((entry) => (
            <button
              key={entry.id}
              className="tvg-release-add"
              disabled={disabled}
              onClick={() => onEdit(entry)}
            >
              {entry.title} {entry.year} · {entry.score ?? "Unrated"}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}

export default function TVGallery(props: Props) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("score");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null),
    [seasonId, setSeasonId] = useState<string | null>(null),
    [trackerBusy, setTrackerBusy] = useState(false);
  const groups = useMemo(() => groupTV(props.items), [props.items]);
  const shows = useMemo(() => groups.map((group) => ({ group, item: showItem(group) })), [groups]);
  const rows = useMemo(
    () => tvGalleryRows(props.items, { query, status, sort }) as TVGroup[],
    [props.items, query, status, sort],
  );
  const rated = groups.flatMap((group) =>
    group.series[0]?.score !== null && group.series[0]?.score !== undefined
      ? [group.series[0]]
      : [],
  );
  const average = rated.length
    ? Math.round(rated.reduce((sum, item) => sum + item.score!, 0) / rated.length)
    : null;
  const filtered = !!(query || status !== "all"),
    locked = props.loading || !!props.error;
  const selected = shows.find((show) =>
    show.group.entries.some((item) => item.id === selectedEntryId),
  );
  const selectedIndex = rows.findIndex((group) =>
    group.entries.some((item) => item.id === selectedEntryId),
  );
  function open(group: TVGroup) {
    setSeasonId(null);
    setSelectedEntryId(group.entries[0].id);
  }
  function edit(item: Media) {
    setSelectedEntryId(null);
    props.onEdit(item);
  }
  const addShow = () => props.onEdit({ ...blankMedia(), kind: "tv" });

  return (
    <div className="bookshelf-page movie-gallery-page tv-gallery-page">
      <MediaNavigation current="tv" onNavigate={props.onNavigate} />
      <main className="mg-main">
        <div className="mg-heading">
          <div>
            <span className="mg-eyebrow">THE SMALL SCREEN COLLECTION</span>
            <h1>TV</h1>
            <p>
              {props.loading ? (
                "Opening your collection…"
              ) : (
                <>
                  {groups.length} shows <span>·</span>{" "}
                  {shows.filter((show) => show.item.status === "finished").length} watched{" "}
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
            <button className="bs-add" onClick={addShow} disabled={locked}>
              <Plus size={16} />
              Add show
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
                aria-label="Search TV shows"
                value={query}
                placeholder="Find a show, creator, or note…"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button aria-label="Clear TV search" onClick={() => setQuery("")}>
                  <X size={16} />
                </button>
              )}
            </label>
            <label>
              <span className="sr-only">TV status</span>
              <select
                aria-label="Filter TV shows"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="all">All shows</option>
                <option value="planned">Up next</option>
                <option value="finished">Watched</option>
                <option value="progress">Watching</option>
                <option value="paused">On hold</option>
                <option value="dropped">Stopped</option>
                <option value="unrated">Unrated</option>
                <option value="upcoming">Tracked releases</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Sort TV shows</span>
              <select
                aria-label="Sort TV shows"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="score">Highest rated</option>
                <option value="year">Newest releases</option>
                <option value="oldest">Oldest releases</option>
                <option value="title">Title A–Z</option>
                <option value="recent">Recently added</option>
                <option value="release">Next release date</option>
              </select>
            </label>
          </div>
          <div className="mg-results">
            <span aria-live="polite">
              {props.loading
                ? "Loading…"
                : `${rows.length} ${rows.length === 1 ? "show" : "shows"}${filtered ? ` of ${groups.length}` : " in your collection"}`}
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
              <span>Choose a poster to step into the show</span>
            )}
          </div>
        </div>
        <section className="mg-grid" aria-label="TV poster gallery" aria-busy={props.loading}>
          {props.loading ? (
            <div className="mg-empty">
              <LoaderCircle size={24} className="spin" />
              <p>Loading your shows…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="mg-empty">
              <Tv size={30} strokeWidth={1} />
              <h2>{filtered ? "No matching shows" : "Make room for your next show"}</h2>
              <p>
                {filtered
                  ? "Try another search or change the filters."
                  : "Add a show or import your watchlist."}
              </p>
              {filtered ? (
                <button
                  className="bs-edit"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                >
                  Show all shows
                </button>
              ) : (
                <button className="bs-add" onClick={addShow}>
                  <Plus size={16} />
                  Add show
                </button>
              )}
            </div>
          ) : (
            rows.map((group) => {
              const item = shows.find((show) => show.group.key === group.key)!.item;
              return (
                <button
                  className="mg-card"
                  data-media-id={group.series[0]?.id || group.entries[0].id}
                  key={group.key}
                  onClick={() => open(group)}
                  aria-haspopup="dialog"
                  aria-label={`View ${group.title}`}
                  title={group.title}
                >
                  <span className="mg-poster">
                    <PosterImage group={group} />
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
                    <span className="mg-edit-hint">View show & notes</span>
                  </span>
                  <span className="mg-title">{group.title}</span>
                  <span className="mg-meta">
                    {tvGroupYear(group) || "Year unknown"}
                    <span>·</span>
                    {item.status === "finished" ? "Watched" : statusNames[item.status]}
                  </span>
                </button>
              );
            })
          )}
        </section>
        {!props.loading && rows.length > 0 && (
          <div className="mg-end">
            <span>
              You’re all caught up · {rows.length} {rows.length === 1 ? "show" : "shows"}
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
          item={selected.item}
          poster={<PosterImage group={selected.group} />}
          artwork={tvPosterFor(selected.group)}
          demo={props.demo}
          externalBusy={trackerBusy}
          onClose={() => setSelectedEntryId(null)}
          onEdit={() => edit(selected.item)}
          onSave={props.onSave}
          onPrevious={selectedIndex > 0 ? () => open(rows[selectedIndex - 1]) : undefined}
          onNext={
            selectedIndex >= 0 && selectedIndex + 1 < rows.length
              ? () => open(rows[selectedIndex + 1])
              : undefined
          }
          extras={(busy) => (
            <ShowExtras
              group={selected.group}
              item={
                selected.group.entries.find((item) => item.id === seasonId) ||
                selected.group.series[0] ||
                selected.group.entries[0]
              }
              disabled={busy || locked}
              demo={props.demo}
              onSave={props.onSave}
              onSelect={setSeasonId}
              onEdit={edit}
              onBusyChange={setTrackerBusy}
            />
          )}
        />
      )}
    </div>
  );
}
