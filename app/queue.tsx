import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  BookmarkPlus,
  Clapperboard,
  Download,
  LoaderCircle,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Star,
  Tv,
  UserRound,
  X,
} from "lucide-react";
import { blankMedia, seriesLabel, typeNames, type Media } from "../lib/media";
import { prepareRecommendation, queueItems } from "../lib/queue";
import MediaNavigation from "./media-navigation";
import MediaThumbnail from "./media-thumbnail";
import "./queue.css";
import { ConnectButton } from "./hub-context";

type Props = {
  items: Media[];
  loading: boolean;
  error: string;
  demo: boolean;
  connected: boolean;
  onNavigate: (section: string) => void;
  onEdit: (item: Media) => void;
  onSave: (item: Media) => Promise<Media>;
  onExport: () => void;
  onNotice: (message: string) => void;
  onStart: () => void;
  onRetry: () => void;
};
const icons = { book: BookOpen, movie: Clapperboard, tv: Tv };
const filters = [
  ["all", "Everything"],
  ["book", "Books"],
  ["movie", "Movies"],
  ["tv", "TV"],
];

export default function Queue(props: Props) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [sort, setSort] = useState("priority"),
    [recommendedOnly, setRecommendedOnly] = useState(false);
  const [draft, setDraft] = useState<Media | null>(null),
    [busy, setBusy] = useState(""),
    [actionError, setActionError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    addButton = useRef<HTMLButtonElement>(null);
  const all = queueItems(props.items),
    visible = queueItems(props.items, { query, kind, sort, recommendedOnly });
  const filtered = !!(query || kind !== "all" || recommendedOnly),
    disabled = props.loading || !!props.error || !!busy;
  useEffect(() => {
    if (draft) titleInput.current?.focus();
  }, [!!draft]);
  function add() {
    if (draft) {
      titleInput.current?.focus();
      return;
    }
    setActionError("");
    setDraft({ ...blankMedia(), kind: "movie" });
  }
  function closeForm() {
    setDraft(null);
    setActionError("");
    addButton.current?.focus();
  }
  function clearFilters() {
    setQuery("");
    setKind("all");
    setRecommendedOnly(false);
  }
  async function saveRecommendation(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || disabled) return;
    setBusy("add");
    setActionError("");
    try {
      await props.onSave(prepareRecommendation(props.items, draft));
      setDraft(null);
      clearFilters();
      props.onNotice(
        props.demo
          ? "Recommendation saved in the sample queue"
          : "Recommendation saved to your queue",
      );
      requestAnimationFrame(() => addButton.current?.focus());
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function update(item: Media, patch: Partial<Media>, message: string) {
    if (disabled) return;
    setBusy(item.id);
    setActionError("");
    try {
      await props.onSave({ ...item, ...patch });
      props.onNotice(message);
      if (patch.status === "progress") requestAnimationFrame(() => searchInput.current?.focus());
    } catch (error) {
      setActionError((error as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="bookshelf-page queue-page">
      <MediaNavigation current="queue" onNavigate={props.onNavigate} />
      <main className="queue-main">
        <div className="queue-heading">
          <div>
            <span className="collection-eyebrow">GOOD STORIES. GOOD RECOMMENDATIONS.</span>
            <h1>
              Queue<span className="queue-title-dot">.</span>
            </h1>
            <p>A place for every “you have to watch this” and “read this next.”</p>
          </div>
          <div className="queue-heading-actions">
            <button className="queue-export" disabled={disabled} onClick={props.onExport}>
              <Download size={15} />
              Export
            </button>
            <button ref={addButton} className="bs-add" disabled={disabled} onClick={add}>
              <Plus size={16} />
              Add recommendation
            </button>
          </div>
        </div>
        {props.demo && !props.loading && (
          <div className="queue-sample">
            <span>Sample queue · recommendations here stay in this demo.</span>
            {props.connected ? (
              <button onClick={props.onStart}>
                Open my library <ArrowRight size={13} />
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
        {actionError && (
          <div className="queue-error" role="alert">
            {actionError}
          </div>
        )}
        {draft && (
          <form
            className="queue-composer"
            aria-label="Add a recommendation"
            onSubmit={saveRecommendation}
          >
            <div className="queue-composer-heading">
              <div>
                <MessageSquare size={17} />
                <h2>What should you try next?</h2>
              </div>
              <button
                type="button"
                className="bs-icon"
                aria-label="Cancel recommendation"
                disabled={!!busy}
                onClick={closeForm}
              >
                <X size={18} />
              </button>
            </div>
            <fieldset disabled={!!busy}>
              <div className="queue-form-grid">
                <label className="queue-title-field">
                  Title
                  <input
                    ref={titleInput}
                    required
                    maxLength={500}
                    value={draft.title}
                    placeholder="The title you don’t want to forget"
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={draft.kind}
                    onChange={(event) =>
                      setDraft({ ...draft, kind: event.target.value as Media["kind"] })
                    }
                  >
                    <option value="movie">Movie</option>
                    <option value="tv">TV show</option>
                    <option value="book">Book</option>
                  </select>
                </label>
                <label>
                  {draft.kind === "book" ? "Author (optional)" : "Creator or director (optional)"}
                  <input
                    maxLength={300}
                    value={draft.creator}
                    placeholder={draft.kind === "book" ? "Author name" : "Creator name"}
                    onChange={(event) => setDraft({ ...draft, creator: event.target.value })}
                  />
                </label>
                <label>
                  Recommended by (optional)
                  <input
                    maxLength={300}
                    value={draft.recommendedBy || ""}
                    placeholder="A friend, a podcast, a newsletter…"
                    onChange={(event) => setDraft({ ...draft, recommendedBy: event.target.value })}
                  />
                </label>
                <label className="queue-note-field">
                  Why it caught your eye (optional)
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={draft.recommendationNote || ""}
                    placeholder="What did they love about it? Save the reason here."
                    onChange={(event) =>
                      setDraft({ ...draft, recommendationNote: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="queue-form-actions">
                <label className="queue-check">
                  <input
                    type="checkbox"
                    checked={draft.priority}
                    onChange={(event) => setDraft({ ...draft, priority: event.target.checked })}
                  />
                  <Star size={14} />
                  Put it at the top of my list
                </label>
                <button className="bs-add" type="submit">
                  {busy === "add" ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <BookmarkPlus size={15} />
                  )}
                  Save to queue
                </button>
              </div>
            </fieldset>
          </form>
        )}
        <div className="queue-controls">
          <div className="queue-filters" aria-label="Queue media filters">
            {filters.map(([id, label]) => (
              <button key={id} aria-pressed={kind === id} onClick={() => setKind(id)}>
                {label}
                <span>
                  {id === "all" ? all.length : all.filter((item) => item.kind === id).length}
                </span>
              </button>
            ))}
          </div>
          <label className="queue-search">
            <Search size={16} />
            <input
              ref={searchInput}
              aria-label="Search queue"
              value={query}
              placeholder="Find a title or who recommended it…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Clear queue search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </label>
        </div>
        <div className="queue-options">
          <span aria-live="polite">
            {props.loading
              ? "Opening your queue…"
              : `${visible.length} ${visible.length === 1 ? "title" : "titles"} to look forward to`}
          </span>
          <div>
            <label className="queue-check">
              <input
                type="checkbox"
                checked={recommendedOnly}
                onChange={(event) => setRecommendedOnly(event.target.checked)}
              />
              Personal recommendations only
            </label>
            <label className="queue-sort">
              <span className="sr-only">Sort queue</span>
              <select
                aria-label="Sort queue"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="priority">Priority first</option>
                <option value="newest">Newest added</option>
                <option value="title">Title A–Z</option>
              </select>
            </label>
            {filtered && (
              <button className="queue-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="queue-list" aria-busy={props.loading}>
          {props.loading ? (
            <div className="queue-empty">
              <LoaderCircle size={24} className="spin" />
              <p>Opening your queue…</p>
            </div>
          ) : !visible.length ? (
            <div className="queue-empty">
              <BookmarkPlus size={29} />
              <h2>{filtered ? "No titles match just yet." : "The next good story starts here."}</h2>
              <p>
                {filtered
                  ? "Try a different title, type or recommender."
                  : "Save a recommendation for a book, movie or show so you can find it when you’re ready."}
              </p>
              <button
                className="queue-empty-action"
                disabled={disabled}
                onClick={filtered ? clearFilters : add}
              >
                {filtered ? "Clear filters" : "Add your first recommendation"}
                <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <ol>
              {visible.map((item, index) => {
                const Icon = icons[item.kind],
                  start = item.kind === "book" ? "Start reading" : "Start watching";
                return (
                  <li key={item.id} className={item.priority ? "is-priority" : ""}>
                    <span className="queue-position" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      className="queue-art"
                      aria-label={`Edit ${item.title}`}
                      data-media-id={item.id}
                      disabled={disabled}
                      onClick={() => props.onEdit(item)}
                    >
                      <MediaThumbnail item={item} />
                    </button>
                    <div className="queue-copy">
                      <div className="queue-type">
                        <Icon size={12} />
                        {typeNames[item.kind]}
                        {item.year && <span>· {item.year}</span>}
                        {item.kind === "book" && item.owned && (
                          <span className="queue-owned">On Kindle</span>
                        )}
                      </div>
                      <button
                        className="queue-title"
                        disabled={disabled}
                        onClick={() => props.onEdit(item)}
                      >
                        {item.title}
                      </button>
                      {(item.creator || item.series) && (
                        <p className="queue-creator">
                          {[item.creator, seriesLabel(item)].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {item.recommendedBy && (
                        <div className="queue-recommender">
                          <UserRound size={12} />
                          <span>
                            Recommended by <strong>{item.recommendedBy}</strong>
                          </span>
                        </div>
                      )}
                      {item.recommendationNote && (
                        <p className="queue-reason">{item.recommendationNote}</p>
                      )}
                    </div>
                    <div className="queue-row-actions">
                      <button
                        className={`queue-star ${item.priority ? "selected" : ""}`}
                        aria-label={`${item.priority ? "Remove priority from" : "Prioritize"} ${item.title}`}
                        aria-pressed={item.priority}
                        disabled={disabled}
                        onClick={() =>
                          update(
                            item,
                            { priority: !item.priority },
                            item.priority ? "Priority removed" : "Moved to the top of your queue",
                          )
                        }
                      >
                        <Star size={16} fill={item.priority ? "currentColor" : "none"} />
                      </button>
                      <button
                        className="queue-start"
                        aria-label={`${start} ${item.title}`}
                        disabled={disabled}
                        onClick={() =>
                          update(item, { status: "progress" }, `${item.title} moved to In progress`)
                        }
                      >
                        {busy === item.id ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <ArrowRight size={14} />
                        )}
                        <span>{start}</span>
                      </button>
                      <button
                        className="bs-icon queue-edit"
                        aria-label={`Edit recommendation for ${item.title}`}
                        disabled={disabled}
                        onClick={() => props.onEdit(item)}
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <footer className="queue-footer">
          <span>Your existing “Up next” titles live here too.</span>
          <span>Starting a title moves it to In progress in your library.</span>
        </footer>
      </main>
    </div>
  );
}
