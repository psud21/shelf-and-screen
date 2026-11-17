import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown, LoaderCircle, Sparkles, Trash2, X } from "lucide-react";
import { seriesLabel, statusNames, typeNames, yearLabel, type Media } from "../lib/media";
import { getPageCount } from "../lib/bookshelf.mjs";
import { fillInDetails, imdbIdFor } from "../lib/metadata";
import MediaThumbnail from "./media-thumbnail";
import "./media-editor.css";

type Props = {
  /** The title as it was when the editor opened; the draft is kept in here. */
  initial: Media;
  existing: boolean;
  demo: boolean;
  busy: boolean;
  error: string;
  focusIdentifier?: boolean;
  focusRecommendation?: boolean;
  onClose: () => void;
  onSave: (item: Media) => void;
  onRemove: () => void;
};

export default function MediaEditor({
  initial,
  existing,
  demo,
  busy,
  error,
  focusIdentifier = false,
  focusRecommendation = false,
  onClose,
  onSave,
  onRemove,
}: Props) {
  // Typing only redraws this panel, not the whole collection behind it.
  const [item, setItem] = useState(initial);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [lookup, setLookup] = useState<{ busy: boolean; message: string }>({
    busy: false,
    message: "",
  });
  const canLookUp = item.kind === "book" ? !!item.title.trim() : !!imdbIdFor(item);
  async function lookUpDetails() {
    setLookup({ busy: true, message: "" });
    try {
      const { item: found, filled } = await fillInDetails(item);
      // Apply only the filled fields, so anything typed meanwhile is kept.
      setItem((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.entries(found).filter(
            ([key, value]) => value !== item[key as keyof Media] && key !== "id",
          ),
        ),
      }));
      setLookup({
        busy: false,
        message: filled.length
          ? `Added ${filled.join(", ")}. Check it, then save.`
          : "Nothing new found. Everything available is already here.",
      });
    } catch (cause) {
      setLookup({ busy: false, message: (cause as Error).message });
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const title = existing
    ? `Edit ${item.kind === "tv" ? "TV show" : typeNames[item.kind].toLowerCase()}`
    : `Add ${item.kind === "tv" ? "a TV show" : item.kind === "movie" ? "a movie" : "a book"}`;
  const update = (patch: Partial<Media>) => setItem((current) => ({ ...current, ...patch }));
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const oldOverflow = document.body.style.overflow;
    const scrollTop = window.scrollY;
    document.body.style.overflow = "hidden";
    element?.showModal();
    element
      ?.querySelector<HTMLInputElement>("[data-initial-focus]")
      ?.focus({ preventScroll: true });
    window.scrollTo({ top: scrollTop, behavior: "instant" });
    return () => {
      element?.close();
      document.body.style.overflow = oldOverflow;
      const matching = Array.from(document.querySelectorAll<HTMLElement>("[data-media-id]")).find(
        (target) => target.dataset.mediaId === item.id,
      );
      const fallback = document.querySelector<HTMLElement>('.bs-header [aria-current="page"]');
      (previous?.isConnected ? previous : matching || fallback)?.focus({ preventScroll: true });
    };
  }, []);

  const identity = (
    <>
      <div className="form-row">
        <label>
          Media type
          <select
            value={item.kind}
            onChange={(event) =>
              update({
                kind: event.target.value as Media["kind"],
                ...(event.target.value !== "tv" ? { episodeTracker: undefined } : {}),
              })
            }
          >
            <option value="book">Book</option>
            <option value="movie">Movie</option>
            <option value="tv">TV show</option>
          </select>
        </label>
        <label>
          Year
          <input
            maxLength={10}
            value={item.year}
            placeholder="e.g. 2024"
            onChange={(event) => update({ year: event.target.value })}
          />
        </label>
      </div>
      <label>
        Title
        <input
          data-initial-focus={!existing || undefined}
          required
          maxLength={500}
          value={item.title}
          placeholder="What’s the next story?"
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <label>
        {item.kind === "book" ? "Author" : "Director or creator"}
        <input
          maxLength={300}
          value={item.creator}
          placeholder={item.kind === "book" ? "Author name" : "Creator name"}
          onChange={(event) => update({ creator: event.target.value })}
        />
      </label>
    </>
  );

  return (
    <dialog
      ref={dialog}
      className="editor-drawer"
      aria-labelledby="editor-drawer-title"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <header className="editor-drawer-head">
        <div>
          <span className="editor-kicker">YOUR COLLECTION</span>
          <h2 id="editor-drawer-title">{title}</h2>
        </div>
        <button
          type="button"
          className="editor-close"
          aria-label="Close editor"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(item);
        }}
        onInvalidCapture={(event) => {
          const section = (event.target as HTMLElement).closest("details");
          if (section) section.open = true;
        }}
      >
        <fieldset className="editor-body editor-drawer-body" disabled={busy}>
          {existing && (
            <div className="editor-story">
              <span className="editor-artwork" aria-hidden="true">
                <MediaThumbnail item={item} />
              </span>
              <div>
                <span className="editor-kicker">{typeNames[item.kind]}</span>
                <h3>{item.title}</h3>
                {(item.creator || item.year || item.series) && (
                  <p>
                    {[item.creator, yearLabel(item.year), seriesLabel(item)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
          )}
          {demo && (
            <p className="form-hint sample-hint">Sample library · edits stay in this demo.</p>
          )}
          {!existing && <div className="editor-identity">{identity}</div>}
          <div className="editor-section-label">RATING & PROGRESS</div>
          <div className="form-row">
            <label>
              {item.kind === "book" ? "Shelf" : "Viewing status"}
              <select
                value={item.status}
                onChange={(event) => update({ status: event.target.value as Media["status"] })}
              >
                {Object.entries(statusNames).map(([value, label]) => (
                  <option value={value} key={value}>
                    {value === "finished" && item.kind !== "book" ? "Watched" : label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Your rating <span className="field-note">out of 100</span>
              <input
                data-initial-focus={
                  (existing && !focusIdentifier && !focusRecommendation) || undefined
                }
                aria-label="Your rating out of 100"
                type="number"
                min={0}
                max={100}
                step={1}
                value={item.score ?? ""}
                placeholder="Unrated"
                onChange={(event) =>
                  update({ score: event.target.value === "" ? null : Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Your notes
            <textarea
              rows={4}
              maxLength={20000}
              value={item.notes}
              placeholder="What stayed with you?"
              onChange={(event) => update({ notes: event.target.value })}
            />
          </label>
          <label>
            Where you left off
            <input
              maxLength={100}
              value={item.progress}
              placeholder={
                item.kind === "tv"
                  ? "e.g. Season 2, episode 3"
                  : item.kind === "book"
                    ? "e.g. Page 120 of 340, or 35%"
                    : "e.g. 45 minutes in"
              }
              onChange={(event) => update({ progress: event.target.value })}
            />
          </label>
          {item.status === "finished" && (
            <label>
              Date finished
              <input
                type="date"
                value={item.completedAt}
                onInput={(event) => update({ completedAt: event.currentTarget.value })}
                onChange={(event) => update({ completedAt: event.target.value })}
              />
            </label>
          )}
          <details
            className="editor-section"
            open={focusRecommendation || !!(item.recommendedBy || item.recommendationNote)}
          >
            <summary>
              Recommendation
              <ChevronDown size={16} />
            </summary>
            <div className="editor-section-body">
              <label>
                Recommended by
                <input
                  data-initial-focus={focusRecommendation || undefined}
                  maxLength={300}
                  value={item.recommendedBy || ""}
                  placeholder="A friend, a podcast, a newsletter…"
                  onChange={(event) => update({ recommendedBy: event.target.value })}
                />
              </label>
              <label>
                Why it caught your eye
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={item.recommendationNote || ""}
                  placeholder="Save the reason you wanted to try it."
                  onChange={(event) => update({ recommendationNote: event.target.value })}
                />
              </label>
              <p className="form-hint">
                Find Up next titles in your Queue. Recommendation details stay with the title when
                you start or finish it.
              </p>
            </div>
          </details>
          <details className="editor-section" open={focusIdentifier || undefined}>
            <summary>
              Title & details
              <ChevronDown size={16} />
            </summary>
            <div className="editor-section-body">
              <div className="editor-lookup">
                <button
                  type="button"
                  className="secondary"
                  disabled={!canLookUp || lookup.busy}
                  onClick={lookUpDetails}
                >
                  {lookup.busy ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Fill in missing details
                </button>
                <span className="form-hint" role="status" aria-live="polite">
                  {lookup.message ||
                    (canLookUp
                      ? item.kind === "book"
                        ? "Summary, first-published year, genre and pages from Open Library."
                        : "Director, running time, genres and summary from Wikidata and Wikipedia."
                      : "Add the IMDb ID below to look this title up.")}
                </span>
              </div>
              {existing && identity}
              <div className="form-row">
                <label>
                  {item.kind === "book" ? "Format or where to read" : "Where to watch"}
                  <input
                    maxLength={200}
                    value={item.platform}
                    placeholder={
                      item.kind === "book"
                        ? "Kindle, paperback, library…"
                        : "Your service or cinema…"
                    }
                    onChange={(event) => update({ platform: event.target.value })}
                  />
                </label>
                <label>
                  Genre
                  <input
                    maxLength={150}
                    value={item.genre}
                    placeholder="Sci-fi, drama, memoir…"
                    onChange={(event) => update({ genre: event.target.value })}
                  />
                </label>
              </div>
              <label>
                {item.kind === "book" ? "Cover image link" : "Poster image link"}{" "}
                <span className="field-note">optional</span>
                <input
                  type="url"
                  pattern="https://.+"
                  title="A link starting with https://"
                  maxLength={2000}
                  value={item.coverUrl}
                  placeholder="https://…"
                  onChange={(event) => update({ coverUrl: event.target.value.trim() })}
                />
                <span className="form-hint">
                  {item.kind === "book"
                    ? "Books with an ISBN find a cover on their own. Paste an image address to choose a different one."
                    : "Paste the address of a poster image, for example from the title’s page on TMDB."}
                </span>
              </label>
              {item.kind === "book" && (
                <div className="form-row">
                  <label>
                    Series
                    <input
                      maxLength={300}
                      value={item.series || ""}
                      placeholder="e.g. The Stormlight Archive"
                      onChange={(event) => update({ series: event.target.value || undefined })}
                    />
                  </label>
                  <label>
                    Number in series
                    <input
                      maxLength={20}
                      value={item.seriesNumber || ""}
                      placeholder="e.g. 2"
                      onChange={(event) =>
                        update({ seriesNumber: event.target.value.trim() || undefined })
                      }
                    />
                  </label>
                </div>
              )}
              {item.kind === "movie" && (
                <label>
                  Running time <span className="field-note">minutes</span>
                  <input
                    type="number"
                    min={1}
                    max={1500}
                    step={1}
                    value={item.runtime ?? ""}
                    placeholder="Not known"
                    onChange={(event) =>
                      update({
                        runtime: event.target.value === "" ? undefined : Number(event.target.value),
                      })
                    }
                  />
                </label>
              )}
              <label>
                What it’s about
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={item.summary || ""}
                  placeholder="A short description of the story."
                  onChange={(event) =>
                    update({
                      summary: event.target.value || undefined,
                      // A summary you write yourself no longer comes from elsewhere.
                      summarySource: undefined,
                      summaryUrl: undefined,
                    })
                  }
                />
                {item.summarySource && (
                  <span className="form-hint">From {item.summarySource}.</span>
                )}
              </label>
              {item.kind === "book" && (
                <div className="form-row">
                  <label>
                    Number of pages
                    <input
                      type="number"
                      min={1}
                      max={30000}
                      step={1}
                      value={getPageCount(item) ?? ""}
                      placeholder="Not known"
                      onChange={(event) =>
                        update({
                          pageCount: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    ISBN
                    <input
                      data-initial-focus={focusIdentifier || undefined}
                      maxLength={30}
                      value={item.isbn}
                      placeholder="Optional edition ISBN"
                      onChange={(event) => update({ isbn: event.target.value })}
                    />
                  </label>
                </div>
              )}
              {item.kind !== "book" && (
                <label>
                  IMDb ID <span className="field-note">for Criticker export</span>
                  <input
                    data-initial-focus={focusIdentifier || undefined}
                    value={item.sourceId || ""}
                    maxLength={200}
                    placeholder="e.g. tt0111161"
                    onChange={(event) => update({ sourceId: event.target.value.trim() })}
                  />
                  <span className="form-hint">
                    The tt number in the title’s IMDb link. For a season rating, add _s2 for season
                    2.
                  </span>
                </label>
              )}
              <div className="check-options">
                {item.kind === "book" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={item.owned}
                      onChange={(event) =>
                        update({
                          owned: event.target.checked,
                          platform:
                            event.target.checked && !item.platform ? "Kindle" : item.platform,
                        })
                      }
                    />
                    I own this on Kindle
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={item.priority}
                    onChange={(event) => update({ priority: event.target.checked })}
                  />
                  Top of my list
                </label>
              </div>
              {item.sourceRating && (
                <p className="form-hint">
                  Original {item.source} rating: {item.sourceRating}. Current scores use your
                  100-point scale.{item.ratedAt && ` Rated on ${item.ratedAt}.`}
                </p>
              )}
            </div>
          </details>
          {item.kind !== "movie" && (
            <details className="editor-section" open={!!item.nextReleaseTitle}>
              <summary>
                <span>
                  <CalendarDays size={15} />
                  Next book or season
                </span>
                <ChevronDown size={16} />
              </summary>
              <div className="editor-section-body">
                <label>
                  What are you waiting for?
                  <input
                    maxLength={300}
                    value={item.nextReleaseTitle || ""}
                    placeholder={
                      item.kind === "book" ? "e.g. Red God · Red Rising #7" : "e.g. Season 3"
                    }
                    onChange={(event) => update({ nextReleaseTitle: event.target.value })}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Expected release date
                    <input
                      type="date"
                      value={item.nextReleaseDate || ""}
                      onInput={(event) =>
                        update({
                          nextReleaseDate: event.currentTarget.value,
                          releaseConfidence: event.currentTarget.value
                            ? item.releaseConfidence === "tba"
                              ? "tentative"
                              : item.releaseConfidence || "tentative"
                            : "tba",
                        })
                      }
                      onChange={(event) =>
                        update({
                          nextReleaseDate: event.target.value,
                          releaseConfidence: event.target.value
                            ? item.releaseConfidence === "tba"
                              ? "tentative"
                              : item.releaseConfidence || "tentative"
                            : "tba",
                        })
                      }
                    />
                  </label>
                  <label>
                    Date status
                    <select
                      value={item.releaseConfidence || "tba"}
                      onChange={(event) =>
                        update({
                          releaseConfidence: event.target.value as Media["releaseConfidence"],
                          ...(event.target.value === "tba" ? { nextReleaseDate: "" } : {}),
                        })
                      }
                    >
                      <option value="tba">Date to be announced</option>
                      <option value="tentative">Tentative estimate</option>
                      <option value="confirmed">Confirmed date</option>
                    </select>
                  </label>
                </div>
                <label>
                  Announcement or source link
                  <input
                    type="url"
                    maxLength={2000}
                    value={item.releaseSource || ""}
                    placeholder="https://…"
                    onChange={(event) => update({ releaseSource: event.target.value })}
                  />
                </label>
                <label>
                  Last checked
                  <input
                    type="date"
                    value={item.releaseCheckedAt || ""}
                    onInput={(event) => update({ releaseCheckedAt: event.currentTarget.value })}
                    onChange={(event) => update({ releaseCheckedAt: event.target.value })}
                  />
                </label>
                <p className="form-hint">
                  Leave an unknown date blank. Update these details as announcements arrive.
                </p>
                <label>
                  Release notes
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={item.releaseNote || ""}
                    placeholder="e.g. Renewed; premiere date not announced."
                    onChange={(event) => update({ releaseNote: event.target.value })}
                  />
                </label>
              </div>
            </details>
          )}
        </fieldset>
        {error && (
          <div className="editor-drawer-error error-box" role="alert">
            {error}
          </div>
        )}
        <footer className="editor-drawer-actions">
          {existing && (
            <button
              type="button"
              className="delete-button"
              disabled={busy}
              onClick={() => (confirmRemoval ? onRemove() : setConfirmRemoval(true))}
            >
              <Trash2 size={15} />
              {confirmRemoval ? "Confirm removal" : "Remove"}
            </button>
          )}
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}Save changes
          </button>
        </footer>
      </form>
    </dialog>
  );
}
