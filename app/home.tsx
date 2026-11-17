import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  Tv,
  Upload,
} from "lucide-react";
import { seriesLabel, typeNames, type Media } from "../lib/media";
import {
  favourites,
  finishedOn,
  inProgress,
  recentlyFinished,
  upcomingReleases,
  upNext,
  yearStats,
} from "../lib/home";
import { localToday } from "../lib/calendar-date.mjs";
import { moviePosterFor } from "../lib/movie-gallery.mjs";
import { tvPosterFor } from "../lib/tv-gallery.mjs";
import { groupTV, type TVGroup } from "../lib/tv-guide.mjs";
import BookCover from "./book-cover";
import BookReveal, { type BookOrigin } from "./book-reveal";
import MediaNavigation from "./media-navigation";
import MediaThumbnail from "./media-thumbnail";
import MovieDetail from "./movie-detail";
import { ConnectButton, StorageLabel } from "./hub-context";
import "./home.css";

type Props = {
  items: Media[];
  loading: boolean;
  error: string;
  demo: boolean;
  connected: boolean;
  onNavigate: (section: string) => void;
  onEdit: (item?: Media) => void;
  onSave: (item: Media) => Promise<Media>;
  onImport: () => void;
  onExport: () => void;
  onStart: () => void;
  onSample: () => void;
  onRetry: () => void;
};

const icons = { book: BookOpen, movie: Clapperboard, tv: Tv };
const monthYear = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";
const fullDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
function greeting(hour = new Date().getHours()) {
  return hour < 5
    ? "Good evening"
    : hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
}

export default function Home(props: Props) {
  const [open, setOpen] = useState<{ id: string; origin: BookOrigin } | null>(null);
  const today = localToday();
  const groups = useMemo(() => groupTV(props.items), [props.items]);
  const groupOf = useMemo(
    () =>
      new Map(groups.flatMap((group) => group.entries.map((item) => [item.id, group] as const))),
    [groups],
  );
  const current = useMemo(() => inProgress(props.items), [props.items]);
  const next = useMemo(() => upNext(props.items), [props.items]);
  const recent = useMemo(() => recentlyFinished(props.items), [props.items]);
  const best = useMemo(() => favourites(props.items), [props.items]);
  const releases = useMemo(() => upcomingReleases(props.items, today), [props.items, today]);
  const stats = useMemo(() => yearStats(props.items, today.slice(0, 4)), [props.items, today]);
  const queueCount = props.items.filter((item) => item.status === "planned").length;
  const openItem = props.items.find((item) => item.id === open?.id);
  const locked = props.loading || !!props.error;

  function show(item: Media, event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setOpen({
      id: item.id,
      origin: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  }
  const artwork = (item: Media) =>
    item.kind === "movie"
      ? moviePosterFor(item)
      : item.kind === "tv"
        ? tvPosterFor(groupOf.get(item.id) ?? groupTV([item])[0])
        : "";

  return (
    <div className="bookshelf-page home-page">
      <MediaNavigation current="home" onNavigate={props.onNavigate} />
      <main className="home-main">
        <header className="home-heading">
          <div>
            <span className="collection-eyebrow">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <h1>
              {greeting()}
              <span className="home-dot">.</span>
            </h1>
            {!props.loading && props.items.length > 0 && (
              <p>
                {[
                  current.length ? `${current.length} in progress` : "",
                  queueCount ? `${queueCount} in your queue` : "",
                  stats
                    ? `${stats.books + stats.films + stats.shows} finished in ${stats.year}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="home-actions">
            <button className="ov-secondary" disabled={locked} onClick={props.onImport}>
              <Upload size={15} />
              Import
            </button>
            <button className="ov-secondary" disabled={locked} onClick={props.onExport}>
              <Download size={15} />
              Export
            </button>
            <button className="bs-add" disabled={locked} onClick={() => props.onEdit()}>
              <Plus size={16} />
              Add title
            </button>
          </div>
        </header>

        {props.demo && !props.loading && (
          <div className="ov-sample">
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

        {props.loading ? (
          <div className="home-empty">
            <LoaderCircle size={22} className="spin" />
            <p>Opening your collection…</p>
          </div>
        ) : props.items.length === 0 ? (
          <div className="home-empty">
            <h2>Your shelves are waiting.</h2>
            <p>Add a book, film or show, or bring in a list from Goodreads or Criticker.</p>
            <div className="home-empty-actions">
              <button className="bs-add" disabled={locked} onClick={() => props.onEdit()}>
                <Plus size={16} />
                Add a title
              </button>
              <button className="ov-secondary" disabled={locked} onClick={props.onImport}>
                <Upload size={15} />
                Import a list
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="home-section" aria-labelledby="home-now">
              <SectionHead id="home-now" title="Continue" />
              {current.length ? (
                <div className="home-now">
                  {current.slice(0, 3).map(({ item, fraction, detail }) => {
                    const Icon = icons[item.kind];
                    return (
                      <article key={item.id} className="home-now-card">
                        <button
                          className="home-now-art"
                          data-media-id={item.id}
                          aria-label={`Open ${item.title}`}
                          onClick={(event) => show(item, event)}
                        >
                          <MediaThumbnail item={item} group={groupOf.get(item.id)} />
                        </button>
                        <div className="home-now-copy">
                          <span className="home-kind">
                            <Icon size={12} />
                            {item.kind === "book" ? "Reading" : "Watching"}
                          </span>
                          <button className="home-now-title" onClick={(event) => show(item, event)}>
                            {item.title}
                          </button>
                          <p className="home-meta">
                            {[item.creator, seriesLabel(item)].filter(Boolean).join(" · ")}
                          </p>
                          {fraction !== null && (
                            <div
                              className="home-progress"
                              role="progressbar"
                              aria-label={`${item.title} progress`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(fraction * 100)}
                            >
                              <span style={{ width: `${Math.round(fraction * 100)}%` }} />
                            </div>
                          )}
                          <p className="home-meta">
                            {detail || (fraction === null ? "No progress noted yet" : "")}
                            {fraction !== null && ` · ${Math.round(fraction * 100)}%`}
                          </p>
                          <button
                            className="home-link"
                            disabled={locked}
                            onClick={() => props.onEdit(item)}
                          >
                            <Pencil size={13} />
                            Update progress
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="home-quiet">
                  <p>Nothing in progress right now.</p>
                  {next.length > 0 && (
                    <button className="home-link" onClick={() => props.onNavigate("queue")}>
                      Choose something from your queue <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              )}
            </section>

            {stats && (
              <section className="home-section" aria-labelledby="home-year">
                <SectionHead
                  id="home-year"
                  title={
                    stats.year === today.slice(0, 4) ? `${stats.year} so far` : `In ${stats.year}`
                  }
                />
                <dl className="home-stats">
                  <Stat label={stats.books === 1 ? "Book" : "Books"} value={stats.books} />
                  <Stat label={stats.films === 1 ? "Film" : "Films"} value={stats.films} />
                  <Stat label="Series & seasons" value={stats.shows} />
                  {stats.pages > 0 && (
                    <Stat label="Pages read" value={stats.pages.toLocaleString()} />
                  )}
                  {stats.minutes > 0 && (
                    <Stat label="Hours of film" value={Math.round(stats.minutes / 60)} />
                  )}
                  {stats.average !== null && (
                    <Stat label="Average rating" value={stats.average} suffix="/100" />
                  )}
                </dl>
              </section>
            )}

            {next.length > 0 && (
              <Shelf
                id="home-next"
                title="Up next"
                action={
                  <button className="home-link" onClick={() => props.onNavigate("queue")}>
                    Your queue <ArrowRight size={13} />
                  </button>
                }
                items={next}
                caption={(item) =>
                  item.recommendedBy ? `From ${item.recommendedBy}` : typeNames[item.kind]
                }
                groupOf={groupOf}
                onOpen={show}
              />
            )}

            {releases.length > 0 && (
              <section className="home-section" aria-labelledby="home-releases">
                <SectionHead id="home-releases" title="Coming soon" />
                <ul className="home-releases">
                  {releases.map((item) => (
                    <li key={item.id}>
                      <button onClick={(event) => show(item, event)}>
                        <span className="home-release-date">
                          <CalendarDays size={14} />
                          {item.nextReleaseDate
                            ? fullDate(item.nextReleaseDate)
                            : "Date to be announced"}
                        </span>
                        <span className="home-release-title">{item.nextReleaseTitle}</span>
                        <span className="home-meta">{item.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recent.length > 0 && (
              <Shelf
                id="home-recent"
                title="Recently finished"
                items={recent}
                caption={(item) => monthYear(finishedOn(item))}
                score
                groupOf={groupOf}
                onOpen={show}
              />
            )}

            {best.length > 0 && (
              <Shelf
                id="home-best"
                title="Highest rated"
                items={best}
                caption={(item) => typeNames[item.kind]}
                score
                groupOf={groupOf}
                onOpen={show}
              />
            )}

            <footer className="home-footer">
              <span>{props.demo ? "Sample collection" : <StorageLabel />}</span>
              <span>
                <button onClick={() => props.onNavigate("all")}>All titles</button>
                {!props.demo && <button onClick={props.onSample}>Explore sample</button>}
              </span>
            </footer>
          </>
        )}
      </main>

      {openItem?.kind === "book" && open && (
        <BookReveal
          book={openItem}
          cover={<BookCover key={openItem.id} book={openItem} />}
          origin={open.origin}
          onClose={() => setOpen(null)}
          onEdit={() => {
            setOpen(null);
            props.onEdit(openItem);
          }}
        />
      )}
      {openItem && openItem.kind !== "book" && (
        <MovieDetail
          item={openItem}
          poster={<MediaThumbnail item={openItem} group={groupOf.get(openItem.id)} />}
          artwork={artwork(openItem)}
          demo={props.demo}
          onClose={() => setOpen(null)}
          onEdit={() => {
            setOpen(null);
            props.onEdit(openItem);
          }}
          onSave={props.onSave}
        />
      )}
    </div>
  );
}

function SectionHead({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="home-section-head">
      <h2 id={id}>{title}</h2>
      {action}
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="home-stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {suffix && <small>{suffix}</small>}
      </dd>
    </div>
  );
}

function Shelf({
  id,
  title,
  action,
  items,
  caption,
  score = false,
  groupOf,
  onOpen,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  items: Media[];
  caption: (item: Media) => string;
  score?: boolean;
  groupOf: Map<string, TVGroup>;
  onOpen: (item: Media, event: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <section className="home-section" aria-labelledby={id}>
      <SectionHead id={id} title={title} action={action} />
      <ol className="home-shelf">
        {items.map((item) => (
          <li key={item.id}>
            <button
              className="home-card"
              data-media-id={item.id}
              aria-label={`Open ${item.title}`}
              onClick={(event) => onOpen(item, event)}
            >
              <span className="home-card-art">
                <MediaThumbnail item={item} group={groupOf.get(item.id)} />
                {score && item.score !== null && (
                  <span className="home-card-score">
                    {item.score}
                    <small>/100</small>
                  </span>
                )}
              </span>
              <span className="home-card-title">{item.title}</span>
              <span className="home-meta">{caption(item)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
